import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add FontAwesome for icons
const fontAwesomeLink = document.createElement("link");
fontAwesomeLink.rel = "stylesheet";
fontAwesomeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css";
document.head.appendChild(fontAwesomeLink);

createRoot(document.getElementById("root")!).render(<App />);
