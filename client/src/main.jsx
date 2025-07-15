import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
// Importing the main CSS file for Tailwind CSS styles
// import "tailwindcss";
// import "./tailwind.css"; // Ensure this path matches your project structure

// Importing the main CSS file for Tailwind CSS styles
import "./output.css"; // Ensure this path matches your project structure
import RestaurantLocator from "./placeCard/index.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    {/* <RestaurantLocator /> */}
  </StrictMode>
);
