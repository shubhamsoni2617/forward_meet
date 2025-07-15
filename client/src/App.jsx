import React, { useState, useEffect, useRef } from "react";

// Main App component
const App = () => {
  // State variables for input locations, search results, loading status, and errors
  const [location1, setLocation1] = useState("");
  const [location2, setLocation2] = useState("");
  // Changed to store an array of restaurants
  const [midwayRestaurants, setMidwayRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // New state for LLM-generated invitation
  const [invitationDraft, setInvitationDraft] = useState("");
  const [generatingInvitation, setGeneratingInvitation] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  // New state for search mode: 'time' or 'distance'
  const [searchMode, setSearchMode] = useState("time"); // Default to 'time'
  // New state for user-selected search radius in kilometers
  const [searchRadius, setSearchRadius] = useState(7); // Default to 7 km
  // New state for user's current location for autocomplete biasing
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  // New state to manage the geolocation permission message
  const [showGeolocationPrompt, setShowGeolocationPrompt] = useState(false);

  // NEW STATE: For selected date and time for traffic prediction
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; //YYYY-MM-DD
  });
  const [selectedTime, setSelectedTime] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1); // Default to 1 hour from now
    now.setMinutes(0); // Round to the hour
    return now.toTimeString().slice(0, 5); // HH:MM
  });

  // NEW STATE: For selected place type (restaurant, bar, cafe, etc.)
  const [placeType, setPlaceType] = useState("restaurant"); // Default to 'restaurant'

  // NEW STATE: For pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
      // Ensure 'libraries=places', 'routes', and 'geometry' are included for autocomplete, directions, and route calculations
      // IMPORTANT: Replace 'YOUR_GOOGLE_MAPS_API_KEY' with your actual Google Maps API Key
      script.src = `https://maps.googleapis.com/maps/api/js?key=&libraries=places,routes,geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Initialize map after script loads
        initMap();
      };
      document.head.appendChild(script);
    } else {
      // If already loaded, just initialize the map
      initMap();
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
      console.log(
        "Google Maps Places library available. Initializing autocomplete."
      );
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
        // Change types to include 'establishment' for businesses and 'geocode' for specific locations
        types: ["geocode", "establishment"],
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
        // autocompleteOptions.strictBounds = false; // Ensure strictBounds is false to allow suggestions outside the immediate bias
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
        });
      }
    }
  };

  // Effect to update map markers and draw routes when midwayRestaurants changes
  useEffect(() => {
    if (
      map &&
      midwayRestaurants.length > 0 &&
      directionsService &&
      directionsRenderer
    ) {
      // Clear existing markers and directions
      markers.forEach((marker) => marker.setMap(null));
      directionsRenderer.setDirections({ routes: [] }); // Clear previous route
      const newMarkers = [];

      // For simplicity, use the first restaurant in the list to get location coords for origin 1 and 2
      // assuming all restaurants in the list will have the same origin coordinates
      const firstRestaurant = midwayRestaurants[0];

      // Add marker for Location 1
      const loc1Coords = {
        lat: firstRestaurant.loc1_lat,
        lng: firstRestaurant.loc1_lon,
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
        lat: firstRestaurant.loc2_lat,
        lng: firstRestaurant.loc2_lon,
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

      // Add markers for all suggested midway restaurants
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(loc1Coords);
      bounds.extend(loc2Coords);

      midwayRestaurants.forEach((restaurant, index) => {
        const restCoords = {
          lat: restaurant.lat,
          lng: restaurant.lon,
        };
        const restMarker = new window.google.maps.Marker({
          position: restCoords,
          map: map,
          title: restaurant.name,
          label: String.fromCharCode(65 + index), // A, B, C...
          icon: {
            url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png", // Red dot for restaurants
          },
        });
        newMarkers.push(restMarker);
        bounds.extend(restCoords);
      });

      setMarkers(newMarkers);

      // Fit map to bounds of all markers
      map.fitBounds(bounds);

      // For simplicity, display the route to the first (best) restaurant only
      const bestRestaurant = midwayRestaurants[0];
      if (bestRestaurant) {
        const request = {
          origin: loc1Coords,
          destination: loc2Coords,
          waypoints: [
            {
              location: { lat: bestRestaurant.lat, lng: bestRestaurant.lon },
              stopover: true,
            },
          ], // Restaurant is a stopover
          travelMode: "DRIVING", // Default to driving as travelMode selection is removed
        };

        directionsService.route(request, (response, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(response);
          } else {
            console.error("Directions request failed due to " + status);
            // Provide more specific error if possible
            if (status === "ZERO_RESULTS") {
              setError(
                "Could not find a route between locations. This might happen for very long distances or specific travel modes (e.g., transit might not have direct routes)."
              );
            } else if (status === "NOT_FOUND") {
              setError(
                "One or more locations could not be geocoded for routing."
              );
            } else {
              setError(
                "Could not display route on map for the best restaurant. Directions service failed: " +
                  status
              );
            }
          }
        });
      }
    }
  }, [map, midwayRestaurants, directionsService, directionsRenderer]);

  // Function to handle the search submission
  const handleSearch = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError("");
    setMidwayRestaurants([]); // Clear previous results
    setInvitationDraft(""); // Clear previous invitation
    setInvitationError(""); // Clear previous invitation error
    setCurrentPage(1); // Reset to first page on new search
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] }); // Clear route on new search
    }

    // Calculate departure_time Unix timestamp
    let departureTime = null;
    // Since travelMode selection is removed, we default to 'driving' for traffic prediction
    const currentTravelMode = "driving";
    if (currentTravelMode === "driving" && selectedDate && selectedTime) {
      const dateTimeString = `${selectedDate}T${selectedTime}:00`;
      const selectedDateTime = new Date(dateTimeString);
      // Ensure the selected time is in the future for traffic prediction
      if (selectedDateTime.getTime() > Date.now()) {
        departureTime = Math.floor(selectedDateTime.getTime() / 1000); // Unix timestamp in seconds
      } else {
        // If selected time is not in the future, set it to 'now' for current traffic
        departureTime = Math.floor(Date.now() / 1000);
      }
    }

    try {
      // Make a request to your Node.js backend
      // Ensure this URL matches your Node.js server's address and port
      const response = await fetch(
        "http://localhost:8080/api/find_midway_restaurant", // Changed port to 5000 as per node backend
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          // Pass searchRadius, travelMode (defaulted to 'driving'), departureTime, AND placeType to backend
          body: JSON.stringify({
            location1,
            location2,
            searchMode,
            searchRadius,
            travelMode: currentTravelMode,
            departureTime,
            placeType,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMidwayRestaurants(data); // Set the array of restaurants
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
          "Failed to connect to the server. Please ensure the backend is running and accessible at http://localhost:8080."
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

  // Function to generate invitation using LLM for a specific restaurant
  const generateInvitation = async (place) => {
    setGeneratingInvitation(true);
    setInvitationDraft("");
    setInvitationError("");

    if (!place) {
      setInvitationError("No place selected to generate an invitation.");
      setGeneratingInvitation(false);
      return;
    }

    try {
      const payload = {
        place_name: place.name,
        place_address: place.address,
        travel_time_from_loc1: place.travel_time_from_loc1_min,
        travel_time_from_loc2: place.travel_time_from_loc2_min,
        location1_name: location1,
        location2_name: location2,
      };

      const response = await fetch(
        "http://localhost:8080/api/generate_invitation", // Changed port to 5000 as per node backend
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

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = midwayRestaurants.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(midwayRestaurants.length / itemsPerPage);

  const handleNextPage = () => {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 font-inter flex flex-col md:flex-row md:pr-1/2">
      {/* Left Content Area (Form and Results) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-6">
            Midway Place Finder
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Find the perfect place nearly midway between two locations.
            (Optimized for distances under 100 km)
          </p>

          {showGeolocationPrompt && (
            <div
              className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg text-sm"
              role="alert"
            >
              <p className="font-bold mb-1">Geolocation Access Needed!</p>
              <p>
                To get smarter autocomplete suggestions for nearby places,
                please allow location access for this website in your browser
                settings.
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
                ref={location1InputRef}
                className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={location1}
                onChange={(e) => setLocation1(e.target.value)}
                placeholder="e.g., Jayanagar, Bengaluru"
                autoComplete="off"
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
                ref={location2InputRef}
                className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={location2}
                onChange={(e) => setLocation2(e.target.value)}
                placeholder="e.g., Indiranagar, Bengaluru"
                autoComplete="off"
                required
              />
            </div>

            {/* Place Type Selection */}
            <div className="mt-4">
              <label
                htmlFor="placeType"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                What kind of place are you looking for?
              </label>
              <select
                id="placeType"
                value={placeType}
                onChange={(e) => setPlaceType(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Coffee Shop</option>
                <option value="bar">Bar</option>
                <option value="night_club">Night Club</option>
                <option value="establishment">
                  Any Establishment (Broad Search)
                </option>
                <option value="co_working_space">Co-working Space</option>
              </select>
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

            {/* Departure Date and Time (only for Driving mode) */}
            <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <p className="block text-gray-700 text-sm font-bold mb-2">
                Traffic Prediction (Driving Only):
              </p>
              <div className="flex gap-4">
                <div>
                  <label
                    htmlFor="selectedDate"
                    className="block text-gray-600 text-xs font-semibold mb-1"
                  >
                    Date:
                  </label>
                  <input
                    type="date"
                    id="selectedDate"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="selectedTime"
                    className="block text-gray-600 text-xs font-semibold mb-1"
                  >
                    Time:
                  </label>
                  <input
                    type="time"
                    id="selectedTime"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                (Predictions use historical traffic. For real-time current
                traffic, select time in past or near now.)
              </p>
            </div>

            {/* Search Radius Slider */}
            <div className="mt-4">
              <label
                htmlFor="searchRadius"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Search Radius from Midpoint:{" "}
                <span className="text-blue-600">{searchRadius} km</span>
              </label>
              <input
                type="range"
                id="searchRadius"
                min="1"
                max="50"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg accent-blue-600"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? "Finding..." : "Find Midway Places"}
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

          {midwayRestaurants.length > 0 && (
            <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl shadow-md">
              <h2 className="text-2xl font-bold text-green-800 mb-4">
                Suggested Places:
              </h2>
              {currentItems.map((place, index) => (
                <div
                  key={index}
                  className="mb-6 p-4 bg-white rounded-xl shadow-lg border border-gray-200"
                >
                  {/* Google Venue Card Header */}
                  <div className="flex items-center mb-3">
                    {/* Display multiple photos in a grid/flex layout */}
                    {place.photo_references &&
                    place.photo_references.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 mr-4 flex-shrink-0 w-[168px] h-[168px]">
                        {" "}
                        {/* Explicitly set size for 2x2 images + gap */}
                        {place.photo_references.map((photoRef, photoIndex) => (
                          <img
                            key={photoIndex}
                            src={`http://localhost:8080/api/place_photo?photoreference=${photoRef}&maxwidth=400`} // Use the new proxy endpoint
                            alt={`${place.name} photo ${photoIndex + 1}`}
                            className="w-full h-full rounded-lg object-cover" // Fill grid cell
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://placehold.co/80x80/cccccc/000000?text=No+Image";
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <img
                        src={`https://placehold.co/80x80/E0E7FF/4338CA?text=${place.name.charAt(
                          0
                        )}`}
                        alt={place.name}
                        className="w-20 h-20 rounded-lg mr-4 object-cover flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "https://placehold.co/80x80/cccccc/000000?text=No+Image";
                        }}
                      />
                    )}

                    <div>
                      <h3 className="text-xl font-extrabold text-gray-900">
                        {String.fromCharCode(65 + index + indexOfFirstItem)}.{" "}
                        {place.name}
                      </h3>
                      {place.rating && place.user_ratings_total && (
                        <p className="text-sm text-gray-600 flex items-center mt-1">
                          <span className="text-yellow-500 mr-1">★</span>
                          {place.rating} ({place.user_ratings_total} reviews)
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {placeType
                          .replace("_", " ")
                          .split(" ")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                          )
                          .join(" ")}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons - Similar to Google Card */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {place.Maps_url && (
                      <a
                        href={place.Maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.828 0L6.343 16.657m10.314-10.314L13.414 3.1a1.998 1.998 0 00-2.828 0L6.343 6.343m10.314 10.314H18a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-4.586-4.586a2 2 0 00-1.414-.586H7.414a2 2 0 00-1.414.586L1.414 5.828A2 2 0 00.586 7.243V17a2 2 0 002 2h2.057m10.314-10.314H6.343"
                          />
                        </svg>
                        Directions
                      </a>
                    )}
                    {/* Placeholder for Reserve a table Button - requires Place Details API */}
                    <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 opacity-70">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Reserve
                    </button>
                    {place.website && (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        Website
                      </a>
                    )}
                    {place.phone && (
                      <a
                        href={`tel:${place.phone}`}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        Call
                      </a>
                    )}
                    <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 opacity-70">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                        />
                      </svg>
                      Share
                    </button>
                    <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 opacity-70">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                      Save
                    </button>
                  </div>

                  {/* Overview/Details Section */}
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      Overview
                    </h4>
                    <p className="text-md text-gray-700 mb-2">
                      <span className="font-semibold">Address:</span>{" "}
                      {place.address}
                    </p>
                    {place.opening_hours && (
                      <div className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Hours:</span>
                        {place.opening_hours.map((day, i) => (
                          <p key={i} className="ml-2">
                            {day}
                          </p>
                        ))}
                      </div>
                    )}
                    {place.phone && (
                      <p className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Phone:</span>{" "}
                        <a
                          href={`tel:${place.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {place.phone}
                        </a>
                      </p>
                    )}
                    {place.website && (
                      <p className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Website:</span>{" "}
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {
                            place.website
                              .replace(/^(https?:\/\/)?(www\.)?/, "")
                              .split("/")[0]
                          }
                        </a>
                      </p>
                    )}
                    {/* Placeholder for Menu - link to website if available */}
                    {place.website && (
                      <p className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Menu:</span>{" "}
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Menu (via Website)
                        </a>
                      </p>
                    )}
                    {/* Placeholder for Reservations - link to website if available */}
                    {place.website && (
                      <p className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Reservations:</span>{" "}
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Book Now (via Website)
                        </a>
                      </p>
                    )}
                    {/* Service Options */}
                    {(place.serves_vegetarian_food ||
                      place.serves_vegan_food ||
                      place.serves_gluten_free_food) && (
                      <div className="text-md text-gray-700 mb-2">
                        <span className="font-semibold">Service options:</span>
                        <ul className="list-disc list-inside ml-2">
                          {place.serves_vegetarian_food && (
                            <li>Vegetarian options</li>
                          )}
                          {place.serves_vegan_food && <li>Vegan options</li>}
                          {place.serves_gluten_free_food && (
                            <li>Gluten-free options</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Travel Time/Distance Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700 text-sm mt-4 border-t border-gray-200 pt-4">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold">
                        Travel from Location 1 (Driving):
                      </p>
                      <p>{place.travel_time_from_loc1_min} minutes</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold">
                        Travel from Location 2 (Driving):
                      </p>
                      <p>{place.travel_time_from_loc2_min} minutes</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold">
                        Distance from Location 1 (Driving):
                      </p>
                      <p>{place.travel_distance_from_loc1_km} km</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold">
                        Distance from Location 2 (Driving):
                      </p>
                      <p>{place.travel_distance_from_loc2_km} km</p>
                    </div>
                  </div>
                  <p className="mt-3 text-gray-700 text-sm">
                    <span className="font-semibold">
                      {searchMode === "time"
                        ? "Time Difference:"
                        : "Distance Difference:"}
                    </span>{" "}
                    {searchMode === "time"
                      ? `${place.time_difference_min} minutes`
                      : `${place.distance_difference_km} km`}
                  </p>

                  <button
                    onClick={() => generateInvitation(place)}
                    className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                    disabled={generatingInvitation}
                  >
                    {generatingInvitation ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                </div>
              ))}

              {/* Pagination Controls */}
              {midwayRestaurants.length > itemsPerPage && (
                <div className="flex justify-center items-center mt-6 space-x-4">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-gray-700 font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
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

          {invitationError && (
            <div
              className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm"
              role="alert"
            >
              {invitationError}
            </div>
          )}
        </div>
      </div>

      {/* Google Map container - Fixed to the right */}
      <div
        ref={mapRef}
        className="w-full h-96 bg-gray-200 rounded-xl shadow-lg mt-8 md:mt-0 md:w-1/2 md:h-screen md:fixed md:right-0 md:top-0"
      >
        {/* Map will be rendered here */}
      </div>
    </div>
  );
};

export default App;
