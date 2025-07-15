import React, { useState, useEffect, useRef } from "react";

// Main App component
const App = () => {
  // State variables for input locations, search results, loading status, and errors
  const [location1, setLocation1] = useState("");
  const [location2, setLocation2] = useState("");
  const [midwayRestaurant, setMidwayRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // New state for LLM-generated invitation
  const [invitationDraft, setInvitationDraft] = useState("");
  const [generatingInvitation, setGeneratingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  // New state for search mode: 'time' or 'distance'
  const [searchMode, setSearchMode] = useState("time"); // Default to 'time'
  // New state for user's current location for autocomplete biasing
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  // New state to manage the geolocation permission message
  const [showGeolocationPrompt, setShowGeolocationPrompt] = useState(false);

  // Refs for the Google Map container and input fields for autocomplete
  const mapRef = useRef(null);
  const location1InputRef = useRef(null);
  const location2InputRef = useRef(null);

  // State to store the Google Map instance and markers
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  // New states for Directions Service and Renderer
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);

  // Load Google Maps script and get user location when the component mounts
  useEffect(() => {
    // Function to get user's current location
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setShowGeolocationPrompt(false); // Hide prompt if successful
            console.log(
              "User location obtained:",
              position.coords.latitude,
              position.coords.longitude
            );
          },
          (err) => {
            console.warn(`ERROR(${err.code}): ${err.message}`);
            // Show prompt if geolocation fails, but don't set a hard error
            setShowGeolocationPrompt(true);
            console.log(
              "Geolocation failed. Autocomplete suggestions might not be biased to your current location."
            );
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        console.log("Geolocation is not supported by this browser.");
        setShowGeolocationPrompt(true); // Show prompt if not supported
        console.log(
          "Geolocation not supported by your browser. Autocomplete suggestions might not be biased."
        );
      }
    };

    // Attempt to get user location on mount
    getUserLocation();

    // Check if Google Maps script is already loaded
    if (!window.google) {
      const script = document.createElement("script");
      // Ensure 'libraries=places' and 'routes' are included for autocomplete and directions functionality
      script.src = `https://maps.googleapis.com/maps/api/js?key=&libraries=places,routes`; // Replace with your actual API key
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Initialize map after script loads
        initMap();
        // Autocomplete initialization depends on userLocation, so it's in a separate effect
      };
      document.head.appendChild(script);
    } else {
      // If already loaded, just initialize the map
      initMap();
      // Autocomplete initialization depends on userLocation, so it's in a separate effect
    }

    // Cleanup function for markers and directions when component unmounts
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

  // Effect to initialize autocomplete once Google Maps is loaded AND userLocation is available (or not)
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      if (userLocation) {
        initAutocomplete(true); // Use bounds if location is available
      } else {
        initAutocomplete(false); // Initialize without bounds if location is not available
      }
    }
  }, [userLocation]); // Re-run when userLocation changes (becomes available)

  // Function to initialize the Google Map
  const initMap = () => {
    if (mapRef.current && window.google) {
      const googleMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, // Center of India as default
        zoom: 5,
        mapId: "DEMO_MAP_ID", // Use a map ID for custom styling if needed
      });
      setMap(googleMap);
      // Initialize DirectionsService and DirectionsRenderer
      setDirectionsService(new window.google.maps.DirectionsService());
      setDirectionsRenderer(
        new window.google.maps.DirectionsRenderer({
          map: googleMap,
          suppressMarkers: true,
        })
      ); // Suppress default markers
    }
  };

  // Function to initialize Google Places Autocomplete for input fields
  // Takes an optional parameter to indicate whether to use bounds
  const initAutocomplete = (useBounds = true) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      const autocompleteOptions = {
        types: ["address"], // Restrict to addresses
        componentRestrictions: { country: ["in"] }, // Optional: Restrict to India
      };

      if (useBounds && userLocation) {
        const center = new window.google.maps.LatLng(
          userLocation.lat,
          userLocation.lng
        );
        // Create a LatLngBounds object to bias results around the user's location
        // This creates a square of roughly 100km x 100km around the user for biasing
        const bounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(
            userLocation.lat - 0.45,
            userLocation.lng - 0.45
          ),
          new window.google.maps.LatLng(
            userLocation.lat + 0.45,
            userLocation.lng + 0.45
          )
        );
        autocompleteOptions.bounds = bounds;
        // autocompleteOptions.strictBounds = true; // Uncomment this if you want to strictly limit results to the bounds
      }

      // Autocomplete for Location 1
      if (location1InputRef.current) {
        const autocomplete1 = new window.google.maps.places.Autocomplete(
          location1InputRef.current,
          autocompleteOptions
        );
        autocomplete1.addListener("place_changed", () => {
          const place = autocomplete1.getPlace();
          if (place.formatted_address) {
            setLocation1(place.formatted_address);
          } else if (place.name) {
            setLocation1(place.name); // Fallback to name if formatted_address is not available
          }
        });
      }

      // Autocomplete for Location 2
      if (location2InputRef.current) {
        const autocomplete2 = new window.google.maps.places.Autocomplete(
          location2InputRef.current,
          autocompleteOptions
        );
        autocomplete2.addListener("place_changed", () => {
          const place = autocomplete2.getPlace();
          if (place.formatted_address) {
            setLocation2(place.formatted_address);
          } else if (place.name) {
            setLocation2(place.name); // Fallback to name if formatted_address is not available
          }
          // No need to clear the state, as the input value will be updated
        });
      }
    }
  };

  // Effect to update map markers and draw routes when midwayRestaurant changes
  useEffect(() => {
    if (map && midwayRestaurant && directionsService && directionsRenderer) {
      // Clear existing markers and directions
      markers.forEach((marker) => marker.setMap(null));
      directionsRenderer.setDirections({ routes: [] }); // Clear previous route
      const newMarkers = [];

      // Add marker for Location 1
      const loc1Coords = {
        lat: midwayRestaurant.loc1_lat,
        lng: midwayRestaurant.loc1_lon,
      };
      const loc1Marker = new window.google.maps.Marker({
        position: loc1Coords,
        map: map,
        title: "Location 1",
        label: "1",
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // Blue dot for origin
        },
      });
      newMarkers.push(loc1Marker);

      // Add marker for Location 2
      const loc2Coords = {
        lat: midwayRestaurant.loc2_lat,
        lng: midwayRestaurant.loc2_lon,
      };
      const loc2Marker = new window.google.maps.Marker({
        position: loc2Coords,
        map: map,
        title: "Location 2",
        label: "2",
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", // Blue dot for origin
        },
      });
      newMarkers.push(loc2Marker);

      // Add marker for Midway Restaurant
      const restCoords = {
        lat: midwayRestaurant.lat,
        lng: midwayRestaurant.lon,
      };
      const restMarker = new window.google.maps.Marker({
        position: restCoords,
        map: map,
        title: midwayRestaurant.name,
        label: "R",
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png", // Red dot for restaurant
        },
      });
      newMarkers.push(restMarker);

      setMarkers(newMarkers);

      // Calculate and display routes
      const waypoints = [
        { location: restCoords, stopover: true }, // Restaurant is a stopover
      ];

      directionsService.route(
        {
          origin: loc1Coords,
          destination: loc2Coords,
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(response);
            // Fit map to bounds of the route
            map.fitBounds(response.routes[0].bounds);
          } else {
            console.error("Directions request failed due to " + status);
            setError(
              "Could not display route on map. Directions service failed."
            );
          }
        }
      );
    }
  }, [map, midwayRestaurant, directionsService, directionsRenderer]); // Dependencies for this effect

  // Function to handle the search submission
  const handleSearch = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError("");
    setMidwayRestaurant(null); // Clear previous results
    setInvitationDraft(""); // Clear previous invitation
    setInvitationError(""); // Clear previous invitation error
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] }); // Clear route on new search
    }

    try {
      // Make a request to your Node.js backend
      // Ensure this URL matches your Node.js server's address and port
      const response = await fetch(
        "http://localhost:8080/api/find_midway_restaurant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ location1, location2, searchMode }), // Pass searchMode to backend
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMidwayRestaurant(data);
      } else {
        // If response is not OK, it means the backend returned an error status
        setError(
          data.error ||
            `Server error: ${response.status} ${response.statusText}`
        );
        console.error("Backend error response:", data);
      }
    } catch (err) {
      // This catch block handles network errors (like "Failed to fetch")
      console.error("Fetch error:", err);
      // Provide a more informative error message to the user
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(
          "Failed to connect to the server. Please ensure the backend is running and accessible at http://localhost:5000."
        );
      } else {
        setError(
          `An unexpected error occurred: ${err.message}. Please check console for details.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to generate invitation using LLM
  const generateInvitation = async () => {
    setGeneratingInvitation(true);
    setInvitationDraft("");
    setInvitationError("");

    if (!midwayRestaurant) {
      setInvitationError("No restaurant selected to generate an invitation.");
      setGeneratingInvitation(false);
      return;
    }

    try {
      const payload = {
        restaurant_name: midwayRestaurant.name,
        restaurant_address: midwayRestaurant.address,
        travel_time_from_loc1: midwayRestaurant.travel_time_from_loc1_min,
        travel_time_from_loc2: midwayRestaurant.travel_time_from_loc2_min,
        location1_name: location1, // Pass original location names for context
        location2_name: location2,
      };

      const response = await fetch(
        "http://localhost:8080/api/generate_invitation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setInvitationDraft(data.invitation);
      } else {
        setInvitationError(
          data.error ||
            `Failed to generate invitation: ${response.status} ${response.statusText}`
        );
        console.error("LLM backend error response:", data);
      }
    } catch (err) {
      console.error("Fetch error for invitation generation:", err);
      setInvitationError(
        "Failed to connect to the LLM server. Please ensure the backend is running."
      );
    } finally {
      setGeneratingInvitation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-4 font-inter flex flex-col items-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mt-8">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-6">
          Midway Restaurant Finder
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Find the perfect restaurant nearly midway between two locations.
          (Optimized for distances under 100 km)
        </p>

        {showGeolocationPrompt && (
          <div
            className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg text-sm"
            role="alert"
          >
            <p className="font-bold mb-1">Geolocation Access Needed!</p>
            <p>
              To get smarter autocomplete suggestions for nearby places, please
              allow location access for this website in your browser settings.
            </p>
            <p className="mt-2 text-xs">
              (Usually, you can click the padlock icon next to the URL in your
              browser's address bar to manage site permissions.)
            </p>
          </div>
        )}

        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label
              htmlFor="location1"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Location 1:
            </label>
            <input
              type="text"
              id="location1"
              ref={location1InputRef} // Attach ref for autocomplete
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={location1}
              onChange={(e) => setLocation1(e.target.value)}
              placeholder="e.g., Jayanagar, Bengaluru"
              required
            />
          </div>
          <div>
            <label
              htmlFor="location2"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Location 2:
            </label>
            <input
              type="text"
              id="location2"
              ref={location2InputRef} // Attach ref for autocomplete
              className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={location2}
              onChange={(e) => setLocation2(e.target.value)}
              placeholder="e.g., Indiranagar, Bengaluru"
              required
            />
          </div>

          {/* Search Mode Selection */}
          <div className="flex items-center justify-center space-x-6 mt-4">
            <span className="text-gray-700 font-bold">Search by:</span>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-blue-600"
                name="searchMode"
                value="time"
                checked={searchMode === "time"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span className="ml-2 text-gray-700">Time</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-purple-600"
                name="searchMode"
                value="distance"
                checked={searchMode === "distance"}
                onChange={(e) => setSearchMode(e.target.value)}
              />
              <span className="ml-2 text-gray-700">Distance</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Finding..." : "Find Midway Restaurant"}
          </button>
        </form>

        {error && (
          <div
            className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"
            role="alert"
          >
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {midwayRestaurant && (
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold text-green-800 mb-4">
              Recommended Restaurant:
            </h2>
            <p className="text-lg text-gray-800 mb-2">
              <span className="font-semibold">Name:</span>{" "}
              {midwayRestaurant.name}
            </p>
            <p className="text-lg text-gray-800 mb-4">
              <span className="font-semibold">Address:</span>{" "}
              {midwayRestaurant.address}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
              {searchMode === "time" ? (
                <>
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold">Travel from Location 1:</p>
                    <p>{midwayRestaurant.travel_time_from_loc1_min} minutes</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold">Travel from Location 2:</p>
                    <p>{midwayRestaurant.travel_time_from_loc2_min} minutes</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold">Distance from Location 1:</p>
                    <p>{midwayRestaurant.travel_distance_from_loc1_km} km</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                    <p className="font-semibold">Distance from Location 2:</p>
                    <p>{midwayRestaurant.travel_distance_from_loc2_km} km</p>
                  </div>
                </>
              )}
            </div>
            <p className="mt-4 text-gray-700 text-sm">
              <span className="font-semibold">
                {searchMode === "time"
                  ? "Time Difference:"
                  : "Distance Difference:"}
              </span>{" "}
              {searchMode === "time"
                ? `${midwayRestaurant.time_difference_min} minutes`
                : `${midwayRestaurant.distance_difference_km} km`}
            </p>

            <button
              onClick={generateInvitation}
              className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={generatingInvitation}
            >
              {generatingInvitation ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Drafting...
                </>
              ) : (
                <>✨ Draft Invitation</>
              )}
            </button>

            {invitationError && (
              <div
                className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm"
                role="alert"
              >
                {invitationError}
              </div>
            )}

            {invitationDraft && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-inner">
                <h3 className="text-xl font-bold text-blue-800 mb-3">
                  Your Invitation Draft:
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {invitationDraft}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Map container */}
      <div
        ref={mapRef}
        className="w-full max-w-2xl h-96 bg-gray-200 rounded-xl shadow-lg mt-8 mb-8"
      >
        {/* Map will be rendered here */}
      </div>
    </div>
  );
};

export default App;
