/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
// Import the polyline library
import * as polyline from '@mapbox/polyline';

let map: google.maps.Map;
let marker: google.maps.Marker | null = null;
let routeCoordinates: google.maps.LatLng[] = [];
let animationIndex = 0;
let animationInterval: number | null = null;

function initMap(): void {
  map = new google.maps.Map(document.getElementById("map") as HTMLElement, {
    zoom: 5,
    center: { lat: 29.970830, lng: 76.850000 }, // Australia.
  });

  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    draggable: false,
    map,
    panel: document.getElementById("panel") as HTMLElement,
  });

  directionsRenderer.addListener("directions_changed", () => {
    const directions = directionsRenderer.getDirections();

    if (directions) {
      computeTotalDistance(directions);
      // Get the encoded polyline string from the route — corrected line:
      const encodedPolyline = directions.routes[0].overview_polyline as string;
      if (encodedPolyline) {
        routeCoordinates = decodePolyline(encodedPolyline);
        startBusSimulation();
      }
    }
  });

  displayRoute("Kurukshetra, Haryana, India", "Amritsar, Punjab, India", directionsService, directionsRenderer);
}

function decodePolyline(encoded: string): google.maps.LatLng[] {
  const decoded: number[][] = polyline.decode(encoded);
  return decoded.map((point) => new google.maps.LatLng(point[0], point[1]));
}

function startBusSimulation(): void {
  if (animationInterval) {
    clearInterval(animationInterval);
  }
  animationIndex = 0;

  if (!marker) {
    marker = new google.maps.Marker({
      position: routeCoordinates[0],
      map: map,
      title: "Bus",
      icon: {
        url: "https://maps.google.com/mapfiles/kml/shapes/bus.png",
        scaledSize: new google.maps.Size(40, 40),
      },
    });
  } else {
    marker.setPosition(routeCoordinates[0]);
  }

  animationInterval = window.setInterval(() => {
    animationIndex++;
    if (animationIndex >= routeCoordinates.length) {
      clearInterval(animationInterval!);
      return;
    }
    marker!.setPosition(routeCoordinates[animationIndex]);
  }, 1000);
}

function displayRoute(
  origin: string,
  destination: string,
  service: google.maps.DirectionsService,
  display: google.maps.DirectionsRenderer
) {
  service
    .route({
      origin: origin,
      destination: destination,
      waypoints: [
        { location: "Chandigarh, India" },
      ],
      travelMode: google.maps.TravelMode.DRIVING,
      avoidTolls: true,
    })
    .then((result: google.maps.DirectionsResult) => {
      display.setDirections(result);
    })
    .catch((e) => {
      alert("Could not display directions due to: " + e);
    });
}

function computeTotalDistance(result: google.maps.DirectionsResult) {
  let total = 0;
  const myroute = result.routes[0];

  if (!myroute) {
    return;
  }

  for (let i = 0; i < myroute.legs.length; i++) {
    total += myroute.legs[i]!.distance!.value;
  }

  total = total / 1000;
  (document.getElementById("total") as HTMLElement).innerHTML = total + " km";
}

declare global {
  interface Window {
    initMap: () => void;
  }
}
window.initMap = initMap;
export {};

