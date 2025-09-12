// This is where you would place the decoded array from your polyline.
// For this example, we'll use a short sample array.
// In your project, replace this with the 'decodedCoordinates' array you generated.
const routeCoordinates = [
  { lat: 29.969513, lng: 76.878281 }, // Kurukshetra
  { lat: 29.97, lng: 76.879 },
  { lat: 29.98, lng: 76.88 },
  { lat: 29.99, lng: 76.881 },
  { lat: 30.00, lng: 76.882 },
  { lat: 30.01, lng: 76.883 },
  { lat: 30.02, lng: 76.884 },
  { lat: 30.03, lng: 76.885 },
  { lat: 30.04, lng: 76.886 },
  { lat: 30.05, lng: 76.887 },
  { lat: 30.06, lng: 76.888 },
];

let map;
let marker;
let currentStep = 0;
let simulationInterval;

async function initMap() {
  // Request needed libraries.
  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

  // The map, centered at the starting position
  map = new Map(document.getElementById("map"), {
    zoom: 15,
    center: routeCoordinates[0],
    mapId: "DEMO_MAP_ID",
  });

  // The marker, positioned at the starting point
  marker = new AdvancedMarkerElement({
    map: map,
    position: routeCoordinates[0],
    title: "Bus",
  });

  // Start the simulation after the map is fully loaded
  startSimulation();
}

function startSimulation() {
  // Use setInterval to update the marker's position every 500 milliseconds (0.5 seconds)
  simulationInterval = setInterval(() => {
    // Stop the simulation if the bus has reached the end of the route
    if (currentStep >= routeCoordinates.length - 1) {
      clearInterval(simulationInterval);
      console.log("Simulation finished. The bus has reached its destination!");
      return;
    }

    // Get the next position from our coordinates array
    currentStep++;
    const nextPosition = routeCoordinates[currentStep];
    
    // Animate the marker to the new position
    marker.position = nextPosition;

    // Log the current position and a random "speed"
    const randomVelocity = Math.floor(Math.random() * 50); // Random speed up to 50
    console.log(`Bus is at Lat: ${nextPosition.lat}, Lng: ${nextPosition.lng} - Speed: ${randomVelocity} km/h`);

  }, 500); // This is the update frequency in milliseconds
}

// Initialize the map
initMap();