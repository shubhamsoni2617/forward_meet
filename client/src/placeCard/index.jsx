import React, { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%",
};

const libraries = ["places"];

function RestaurantLocator() {
  const [center, setCenter] = useState(null);
  const [restaurants, setRestaurants] = useState([
    {
      place_id: "ChIJGdo6XIMWrjsR27K3QpD1ZXA",
      name: "Loading...",
      vicinity: "Loading...",
      lat: 12.9736048,
      lng: 77.6184025,
    },
  ]); // Placeholder for initial state
  console.log("🚀 ~ RestaurantLocator ~ restaurants:", restaurants);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: "TEST", // ⭐ IMPORTANT: Replace with your actual API key
    libraries,
  });

  // --- DEBUGGING: API Loading Status ---
  useEffect(() => {
    if (loadError) {
      console.error("Google Maps API Load Error:", loadError);
    } else if (isLoaded) {
      console.log("Google Maps API loaded successfully.");
    } else {
      console.log("Google Maps API is currently loading...");
    }
  }, [isLoaded, loadError]);

  // Get user's current location using Geolocation API
  useEffect(() => {
    console.log("Attempting to get user's geolocation...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter(userLocation);
          console.log("User location obtained:", userLocation);
        },
        (error) => {
          console.error("Error getting user location:", error);
          const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Default to Bengaluru
          setCenter(defaultLocation);
          console.warn(
            "Geolocation denied or unavailable. Defaulting to Bengaluru:",
            defaultLocation
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Default to Bengaluru
      setCenter(defaultLocation);
      console.warn(
        "Geolocation not supported by this browser. Defaulting to Bengaluru:",
        defaultLocation
      );
    }
  }, []);

  // Callback when the GoogleMap component itself loads
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    console.log(
      "✅ GoogleMap component loaded. mapRef.current is now:",
      mapRef.current
    );
  }, []);

  // Callback when the GoogleMap component unmounts (optional but good practice)
  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
    console.log("GoogleMap component unmounted. mapRef.current is now null.");
  }, []);

  // Function to search for restaurants using Places API
  const searchRestaurants = useCallback(async () => {
    console.log(
      "--- Inside searchRestaurants function (Attempting to search) ---"
    );
    console.log(
      `  - mapRef.current status: ${!!mapRef.current ? "DEFINED" : "UNDEFINED"}`
    );
    console.log(
      `  - window.google status: ${!!window.google ? "DEFINED" : "UNDEFINED"}`
    );
    console.log(`  - center status: ${!!center ? "DEFINED" : "UNDEFINED"}`);

    // This is the critical check. If any of these are false, it returns early.
    if (!mapRef.current || !window.google || !center) {
      console.log(
        "❌ Skipping search: One or more prerequisites are NOT defined."
      );
      return;
    }

    console.log("✅ All prerequisites met. Proceeding with Places search.");

    const service = new window.google.maps.places.PlacesService(mapRef.current);

    const request = {
      location: center,
      radius: 5000,
      type: ["restaurant"],
      keyword: "restaurant",
    };

    console.log(service, "Places API request:", request);

    try {
      // const { Place } = await window.google.maps.importLibrary("places");

      // const { places } = await Place.searchNearby(request);

      // console.log("Places API Response:", places);

      service.nearbySearch(request, (results, status) => {
        console.log("Places API Response Status:", status);
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          results
        ) {
          setRestaurants(results);
          console.log("Found restaurants:", results);
        } else if (
          status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          console.log("No restaurants found nearby with the given criteria.");
          setRestaurants([]);
        } else {
          console.error("Places search failed with status:", status);
          setRestaurants([]);
        }
      });
    } catch (error) {
      console.error("Error creating PlacesService or request:", error);
      return;
    }
  }, [center]); // No need to add mapRef.current here, as useCallback will be stable

  // ⭐⭐⭐ THE CRUCIAL FIX IS HERE ⭐⭐⭐
  // This useEffect will now only trigger searchRestaurants when mapRef.current is also available.
  useEffect(() => {
    setTimeout(() => {
      console.log(
        "--- Effect to trigger search running (Monitoring isLoaded, center, & mapRef.current) ---"
      );
      if (isLoaded && center && mapRef.current) {
        // <-- Added mapRef.current check
        console.log(
          "isLoaded, center, AND mapRef.current are all available. Calling searchRestaurants..."
        );
        searchRestaurants();
      } else {
        console.log(`  - isLoaded: ${isLoaded ? "true" : "false"}`);
        console.log(`  - center: ${!!center ? "true" : "false"}`);
        console.log(
          `  - mapRef.current: ${!!mapRef.current ? "DEFINED" : "UNDEFINED"}`
        );
        console.log("  Waiting for all prerequisites to be true...");
      }
    }, 1000);
  }, [isLoaded, center, searchRestaurants, mapRef.current]); // <-- mapRef.current ADDED TO DEPENDENCIES

  // --- Render Logic ---
  if (loadError) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "red",
          fontSize: "1.2em",
        }}
      >
        Error loading Google Maps API: {loadError.message}
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div style={{ padding: "20px", textAlign: "center", fontSize: "1.2em" }}>
        Loading Google Maps API...
      </div>
    );
  }
  if (!center) {
    return (
      <div style={{ padding: "20px", textAlign: "center", fontSize: "1.2em" }}>
        Getting your location or defaulting...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Left panel for restaurant list */}
      <div
        style={{
          width: "350px",
          overflowY: "auto",
          padding: "15px",
          borderRight: "1px solid #e0e0e0",
          boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            borderBottom: "2px solid #f0f0f0",
            paddingBottom: "10px",
            marginBottom: "15px",
            color: "#333",
          }}
        >
          Restaurants Near You
        </h2>
        {/* {restaurants.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {restaurants.map((restaurant) => (
              <li
                key={restaurant.place_id}
                style={{
                  marginBottom: "15px",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  backgroundColor: "#fff",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <h3 style={{ margin: "0 0 5px 0", color: "#007bff" }}>
                  {restaurant.name}
                </h3>
                <p
                  style={{
                    margin: "0 0 5px 0",
                    color: "#555",
                    fontSize: "0.9em",
                  }}
                >
                  {restaurant.vicinity}
                </p>
                {restaurant.rating && (
                  <p style={{ margin: "0", color: "#666", fontSize: "0.85em" }}>
                    ⭐ Rating: {restaurant.rating} (
                    {restaurant.user_ratings_total || 0} reviews)
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#777", textAlign: "center", paddingTop: "20px" }}>
            No restaurants found nearby. Try adjusting the search area or
            radius.
          </p>
        )} */}
      </div>

      {/* Right panel for the Google Map */}
      <div style={{ flexGrow: 1, position: "relative" }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.place_id}
              position={{
                lat: restaurant.lat,
                lng: restaurant.lng,
              }}
              title={restaurant.name}
            />
          ))}

          {center && (
            <Marker
              position={center}
              title="Your Location"
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(32, 32),
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export default RestaurantLocator;
