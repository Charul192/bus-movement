/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Import the polyline library
import * as polyline from '@mapbox/polyline';

// --- Interfaces for Stronger Typing ---
interface IBusRoute {
  start: { name: string };
  end: { name: string };
}

interface IBusData {
  busNumber: string;
  operator: string;
  headsign: string;
  startTime: string; // ISO 8601 date string
  route: IBusRoute;
  isAnimated?: boolean; // Optional because it's added at runtime
}

// --- Global Variables ---
let map: google.maps.Map;
let allBusData: IBusData[] = [];
const activeBusAnimators: BusAnimator[] = [];
const directionsService = new google.maps.DirectionsService();

/**
 * A class to manage the state and animation of a single bus.
 */
class BusAnimator {
  busData: IBusData;
  marker: google.maps.Marker | null = null;
  startMarker: google.maps.Marker | null = null;
  endMarker: google.maps.Marker | null = null;
  routeCoordinates: google.maps.LatLng[] = [];
  animationIndex = 0;
  animationTimeout: number | null = null;
  renderer: google.maps.DirectionsRenderer;
  onComplete: () => void;

  constructor(busData: IBusData, map: google.maps.Map, onComplete: () => void) {
    this.busData = busData;
    this.onComplete = onComplete; // Callback to run when animation finishes
    this.renderer = new google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: true, // We use our own custom markers
    });
  }

  /**
   * Fetches the route from the Directions Service and starts the animation.
   */
  async initialize(): Promise<void> {
    const request: google.maps.DirectionsRequest = {
      origin: this.busData.route.start.name,
      destination: this.busData.route.end.name,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidTolls: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.PESSIMISTIC,
      }
    };

    try {
      const result = await directionsService.route(request);
      const route = result.routes[0];

      if (!route || !route.legs || route.legs.length === 0) {
        throw new Error("No route legs found.");
      }

      this.renderer.setDirections(result);
      this.createRouteMarkers(route);

      const encodedPolyline = route.overview_polyline as string;
      this.routeCoordinates = this.decodePolyline(encodedPolyline);

      this.startAnimation();
      console.log(`Animation started for bus: ${this.busData.busNumber}`);
    } catch (e) {
      console.error(`Could not get route for bus ${this.busData.busNumber}:`, e);
    }
  }
  
  /**
   * Creates and displays custom markers for the start and end of the route.
   */
  private createRouteMarkers(route: google.maps.DirectionsRoute): void {
      const startLocation = route.legs[0].start_location;
      const endLocation = route.legs[0].end_location;

      this.startMarker = new google.maps.Marker({
        position: startLocation,
        map: map,
        title: `Start: ${route.legs[0].start_address}`,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
      });

      this.endMarker = new google.maps.Marker({
        position: endLocation,
        map: map,
        title: `End: ${route.legs[0].end_address}`,
        icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
      });
  }

  /**
   * Decodes an encoded polyline string into an array of LatLng objects.
   */
  private decodePolyline(encoded: string): google.maps.LatLng[] {
    const decoded: number[][] = polyline.decode(encoded);
    return decoded.map((point) => new google.maps.LatLng(point[0], point[1]));
  }

  /**
   * Initializes the animated bus marker and begins the animation loop.
   */
  private startAnimation(): void {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }

    this.animationIndex = 0;
    if (!this.marker) {
      this.marker = new google.maps.Marker({
        position: this.routeCoordinates[0],
        map: map,
        title: `${this.busData.operator} (${this.busData.headsign})`,
        icon: {
          url: "http://maps.gstatic.com/mapfiles/transit/iw2/6/bus2.png",
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20), // Center the icon
        },
      });
    } else {
      this.marker.setPosition(this.routeCoordinates[0]);
    }

    this.animateNextStep();
  }

  /**
   * The core animation loop. Moves the bus marker one step along the polyline.
   */
  private animateNextStep(): void {
    // Check if the animation is finished
    if (this.animationIndex >= this.routeCoordinates.length - 1) {
      console.log(`Animation finished for bus: ${this.busData.busNumber}`);
      this.cleanup();
      return;
    }

    const currentPos = this.routeCoordinates[this.animationIndex];
    const nextPos = this.routeCoordinates[this.animationIndex + 1];

    // Calculate time to next point based on a fixed speed
    const distanceBetweenPoints = google.maps.geometry.spherical.computeDistanceBetween(currentPos, nextPos);
    const averageSpeedMps = 11.11; // Assumed average speed of 40 km/h
    const timeForSegmentSeconds = distanceBetweenPoints / averageSpeedMps;

    this.animationTimeout = window.setTimeout(() => {
      this.animationIndex++;
      this.marker!.setPosition(this.routeCoordinates[this.animationIndex]);
      this.animateNextStep();
    }, timeForSegmentSeconds * 1000);
  }

  /**
   * Removes all map elements associated with this animator and calls the onComplete callback.
   */
  private cleanup(): void {
    this.marker?.setMap(null);
    this.renderer.setMap(null);
    this.startMarker?.setMap(null);
    this.endMarker?.setMap(null);
    this.onComplete(); // Important for fixing memory leak
  }
}

/**
 * Initializes the Google Map.
 */
function initMap(): void {
  map = new google.maps.Map(document.getElementById("map") as HTMLElement, {
    zoom: 8,
    center: { lat: 30.900965, lng: 75.857270 }, // Centered on Ludhiana
  });

  // Start the recurring check for buses to animate
  window.setInterval(checkForBusesToAnimate, 30000); // Check every 30 seconds
  checkForBusesToAnimate(); // Check once immediately
}

/**
 * Checks the master list of buses and starts animations for those whose time has come.
 */
function checkForBusesToAnimate(): void {
  const currentTime = new Date();
  let wasNewBusAdded = false;

  for (const bus of allBusData) {
    if (new Date(bus.startTime) <= currentTime && !bus.isAnimated) {
      console.log(`Bus ${bus.busNumber} is starting its journey at ${currentTime.toLocaleTimeString()}`);
      bus.isAnimated = true; // Mark as processed
      
      const onAnimationComplete = () => {
        // Find and remove the completed animator from the active list
        const index = activeBusAnimators.findIndex(anim => anim.busData.busNumber === bus.busNumber);
        if (index > -1) {
          activeBusAnimators.splice(index, 1);
          console.log(`Animator for bus ${bus.busNumber} removed from active list.`);
        }
      };
      
      const newAnimator = new BusAnimator(bus, map, onAnimationComplete);
      newAnimator.initialize();
      activeBusAnimators.push(newAnimator);
      wasNewBusAdded = true;
    }
  }

  // If a new bus was added, adjust the map view to show all active buses
  if (wasNewBusAdded && activeBusAnimators.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    activeBusAnimators.forEach(animator => {
      if (animator.marker) {
        bounds.extend(animator.marker.getPosition()!);
      }
    });
    map.fitBounds(bounds);
  }
}

/**
 * Main entry point: fetches bus data and then initializes the map.
 */
async function fetchAndInitMap(): Promise<void> {
  try {
    const response = await fetch('data.txt');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    allBusData = await response.json();
    initMap();
  } catch (error) {
    console.error("Could not load bus route data:", error);
    alert("Could not load bus route data. Please check the 'data.txt' file and the console for errors.");
  }
}

// --- Script Execution ---

// Start the application. This should be called after the Google Maps script has loaded.
fetchAndInitMap();

// This export statement ensures the file is treated as a module.
export {};