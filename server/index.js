// Import necessary modules
const express = require("express");
const cors = require("cors"); // For handling Cross-Origin Resource Sharing
const axios = require("axios"); // For making HTTP requests to external APIs

// Initialize the Express application
const app = express();
const PORT = process.env.PORT || 8080; // Use port 5000 or an environment variable

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable parsing of JSON request bodies

// --- Configuration (IMPORTANT: Replace with your actual API Keys) ---
// These keys are for the BACKEND (Geocoding, Places, Directions, and Gemini APIs)
// Keep these keys secure and do not expose them in your frontend code.
const Maps_API_KEY = "";
const GEMINI_API_KEY = ""; // Leave this empty, Canvas will inject the key for Gemini API calls

// --- Helper Functions ---

/**
 * Converts an address string to latitude and longitude coordinates
 * using the Google Geocoding API.
 * @param {string} address - The address string to geocode.
 * @returns {Promise<{lat: number, lng: number}|null>} - A promise that resolves to an object with lat/lng or null.
 */
async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${Maps_API_KEY}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } else {
      console.error(
        `Geocoding error for ${address}:`,
        response.data.status,
        response.data.error_message
      );
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding address ${address}:`, error.message);
    return null;
  }
}

/**
 * Calculates travel time and distance between two points using Google Directions API.
 * @param {{lat: number, lng: number}} origin - Origin coordinates.
 * @param {{lat: number, lng: number}} destination - Destination coordinates.
 * @param {string} travelMode - 'driving', 'walking', 'bicycling', 'transit'.
 * @param {number} [departureTime] - Unix timestamp for departure time (for traffic prediction).
 * @returns {Promise<{duration_min: number, distance_km: number}|null>} - Travel time in minutes and distance in km.
 */
async function getTravelDetails(
  origin,
  destination,
  travelMode,
  departureTime = null
) {
  let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=${travelMode}&key=${Maps_API_KEY}`;

  if (departureTime && travelMode === "driving") {
    url += `&departure_time=${departureTime}`;
    // You can also add 'traffic_model=best_guess' or 'optimistic' or 'pessimistic'
    // url += `&traffic_model=best_guess`;
  }

  try {
    const response = await axios.get(url);
    if (response.data.status === "OK" && response.data.routes.length > 0) {
      const route = response.data.routes[0].legs[0];
      const duration_min = route.duration_in_traffic
        ? Math.round(route.duration_in_traffic.value / 60)
        : Math.round(route.duration.value / 60);
      const distance_km = (route.distance.value / 1000).toFixed(2);
      return { duration_min, distance_km };
    } else {
      console.error(
        `Directions API error (${travelMode}):`,
        response.data.status,
        response.data.error_message
      );
      return null;
    }
  } catch (error) {
    console.error(
      `Error getting travel details (${travelMode}):`,
      error.message
    );
    return null;
  }
}

/**
 * Finds places near a given midpoint using Google Places API (Text Search).
 * @param {{lat: number, lng: number}} midpoint - The central point for the search.
 * @param {string} type - Type of place (e.g., 'restaurant', 'cafe', 'bar').
 * @param {number} radius - Search radius in meters.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of place objects.
 */
async function findPlacesNearMidpoint(midpoint, type, radius) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midpoint.lat},${midpoint.lng}&radius=${radius}&type=${type}&key=${Maps_API_KEY}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      // Filter out places that don't have a name or geometry (location)
      return response.data.results.filter(
        (place) => place.name && place.geometry && place.geometry.location
      );
    } else {
      console.error(
        "Places API error:",
        response.data.status,
        response.data.error_message
      );
      return [];
    }
  } catch (error) {
    console.error("Error finding places:", error.message);
    return [];
  }
}

/**
 * Fetches detailed information for a specific place using Google Places API (Place Details).
 * @param {string} placeId - The Place ID of the establishment.
 * @returns {Promise<Object|null>} - A promise that resolves to a detailed place object or null.
 */
async function getPlaceDetails(placeId) {
  // Request comprehensive fields including opening_hours, website, formatted_phone_number,
  // and all photo references for a richer display.
  // Also include business_status, price_level, reviews for a complete card.
  // New: Added 'serves_vegetarian_food', 'serves_vegan_food', 'serves_gluten_free_food'
  const fields =
    "name,formatted_address,geometry,rating,user_ratings_total,photos,url,website,formatted_phone_number,opening_hours,business_status,price_level,serves_vegetarian_food";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${Maps_API_KEY}`;

  try {
    const response = await axios.get(url);
    if (response.data.status === "OK") {
      const details = response.data.result;
      // Extract photo references if available
      const photo_references = details.photos
        ? details.photos.map((photo) => photo.photo_reference)
        : [];

      return {
        name: details.name,
        address: details.formatted_address,
        lat: details.geometry.location.lat,
        lon: details.geometry.location.lng,
        rating: details.rating,
        user_ratings_total: details.user_ratings_total,
        Maps_url: details.url,
        website: details.website,
        phone: details.formatted_phone_number,
        opening_hours: details.opening_hours?.weekday_text || null,
        business_status: details.business_status,
        price_level: details.price_level, // 1-4, or undefined
        photo_references: photo_references, // Array of photo_reference strings
        serves_vegetarian_food: details.serves_vegetarian_food || false,
        serves_vegan_food: details.serves_vegan_food || false,
        serves_gluten_free_food: details.serves_gluten_free_food || false,
      };
    } else {
      console.error(
        "Place Details API error:",
        response.data.status,
        response.data.error_message
      );
      return null;
    }
  } catch (error) {
    console.error("Error fetching place details:", error.message);
    return null;
  }
}

// --- Routes ---

// API endpoint to find a midway restaurant
app.post("/api/find_midway_restaurant", async (req, res) => {
  const {
    location1,
    location2,
    searchMode,
    searchRadius,
    travelMode,
    departureTime,
    placeType,
  } = req.body;

  if (!location1 || !location2) {
    return res.status(400).json({ error: "Please provide both locations." });
  }

  try {
    // 1. Geocode both locations
    const loc1Coords = await geocodeAddress(location1);
    const loc2Coords = await geocodeAddress(location2);

    if (!loc1Coords) {
      return res.status(404).json({ error: "Could not find Location 1." });
    }
    if (!loc2Coords) {
      return res.status(404).json({ error: "Could not find Location 2." });
    }

    // 2. Find midpoint - simple average for now
    const midpoint = {
      lat: (loc1Coords.lat + loc2Coords.lat) / 2,
      lng: (loc1Coords.lng + loc2Coords.lng) / 2,
    };

    // Convert searchRadius from km to meters for Places API
    const searchRadiusMeters = searchRadius * 1000;

    // 3. Find places near the midpoint
    const places = await findPlacesNearMidpoint(
      midpoint,
      placeType,
      searchRadiusMeters
    ); // Use placeType from frontend

    if (places.length === 0) {
      return res.status(404).json({
        error: "No places found near the midpoint with the given criteria.",
      });
    }

    const restaurantsWithDetails = [];

    // Process places in parallel to speed up responses
    await Promise.all(
      places.map(async (place) => {
        const placeDetails = await getPlaceDetails(place.place_id);

        if (placeDetails) {
          // Calculate travel times and distances from both locations to the current place
          const travel1 = await getTravelDetails(
            loc1Coords,
            { lat: placeDetails.lat, lng: placeDetails.lon },
            travelMode,
            departureTime
          );
          const travel2 = await getTravelDetails(
            loc2Coords,
            { lat: placeDetails.lat, lng: placeDetails.lon },
            travelMode,
            departureTime
          );

          if (travel1 && travel2) {
            const timeDifference = Math.abs(
              travel1.duration_min - travel2.duration_min
            );
            const distanceDifference = Math.abs(
              travel1.distance_km - travel2.distance_km
            );

            restaurantsWithDetails.push({
              ...placeDetails, // Spread all fetched details
              travel_time_from_loc1_min: travel1.duration_min,
              travel_distance_from_loc1_km: travel1.distance_km,
              travel_time_from_loc2_min: travel2.duration_min,
              travel_distance_from_loc2_km: travel2.distance_km,
              time_difference_min: timeDifference,
              distance_difference_km: distanceDifference,
              loc1_lat: loc1Coords.lat, // Include original location coordinates for map
              loc1_lon: loc1Coords.lng,
              loc2_lat: loc2Coords.lat,
              loc2_lon: loc2Coords.lng,
            });
          }
        }
      })
    );

    // Sort the restaurants based on the selected search mode
    if (searchMode === "time") {
      restaurantsWithDetails.sort(
        (a, b) => a.time_difference_min - b.time_difference_min
      );
    } else {
      // Default to distance if searchMode is 'distance' or any other value
      restaurantsWithDetails.sort(
        (a, b) => a.distance_difference_km - b.distance_difference_km
      );
    }

    if (restaurantsWithDetails.length === 0) {
      return res.status(404).json({
        error:
          "No suitable places found with travel details. Try adjusting the search radius or criteria.",
      });
    }

    res.json(restaurantsWithDetails);
  } catch (error) {
    console.error("Error in find_midway_restaurant:", error);
    res.status(500).json({ error: "An internal server error occurred." });
  }
});

// New API endpoint to proxy Google Place Photos
app.get("/api/place_photo", async (req, res) => {
  const { photoreference, maxwidth = 400 } = req.query; // Default maxwidth to 400

  if (!photoreference) {
    return res.status(400).json({ error: "Missing photoreference." });
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${photoreference}&key=${Maps_API_KEY}`;

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" }); // Important for image data

    // Set the appropriate content type based on the response from Google
    // Google Photos API redirects, and the final URL's content-type might be what we need
    // Or we can assume JPEG for typical photo references.
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/jpeg"
    );
    res.send(response.data);
  } catch (error) {
    console.error("Error proxying place photo:", error.message);
    // Google's API might return 404 for invalid photo references or other errors
    const statusCode = error.response ? error.response.status : 500;
    const errorMessage = error.response
      ? error.response.statusText
      : "Failed to fetch image";
    res
      .status(statusCode)
      .json({ error: `Failed to load image: ${errorMessage}` });
  }
});

// API endpoint to generate an invitation using Gemini API
app.post("/api/generate_invitation", async (req, res) => {
  const {
    place_name,
    place_address,
    travel_time_from_loc1,
    travel_time_from_loc2,
    location1_name,
    location2_name,
  } = req.body;

  if (
    !place_name ||
    !place_address ||
    !travel_time_from_loc1 ||
    !travel_time_from_loc2 ||
    !location1_name ||
    !location2_name
  ) {
    return res.status(400).json({
      error: "Missing required information for invitation generation.",
    });
  }

  const prompt = `Draft a friendly and concise invitation message for two people meeting at a midway location.
  Location 1: ${location1_name}
  Location 2: ${location2_name}
  Midway Place: ${place_name} at ${place_address}
  Travel time from ${location1_name} to ${place_name}: approximately ${travel_time_from_loc1} minutes.
  Travel time from ${location2_name} to ${place_name}: approximately ${travel_time_from_loc2} minutes.
  
  The invitation should:
  - Be warm and inviting.
  - Clearly state the name and address of the meeting place.
  - Mention the approximate travel times for both parties to show it's a convenient midway point.
  - Suggest a casual tone suitable for friends or colleagues.
  - Keep it under 100 words.
  
  Example: "Hey [Friend's Name]! How about we meet at [Place Name] ([Address])? It's roughly X mins for you and Y mins for me. Looking forward to it!"`;

  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  try {
    const geminiResponse = await axios.post(geminiApiUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });

    if (
      geminiResponse.data.candidates &&
      geminiResponse.data.candidates[0] &&
      geminiResponse.data.candidates[0].content &&
      geminiResponse.data.candidates[0].content.parts &&
      geminiResponse.data.candidates[0].content.parts[0] &&
      geminiResponse.data.candidates[0].content.parts[0].text
    ) {
      const generatedText =
        geminiResponse.data.candidates[0].content.parts[0].text;
      return res.json({ invitation: generatedText });
    } else {
      console.error(
        `Unexpected Gemini API response structure:`,
        geminiResponse.data
      );
      return res.status(500).json({
        error:
          "Failed to get text from Gemini API. Unexpected response structure.",
      });
    }
  } catch (error) {
    console.error(
      `Error calling Gemini API:`,
      error.response ? error.response.data : error.message
    );
    return res.status(500).json({
      error: `Failed to connect to Gemini API: ${error.message}. Please check your API key and network connection.`,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
