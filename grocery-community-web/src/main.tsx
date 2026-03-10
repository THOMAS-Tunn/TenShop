import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import App from "./App";
import { AppSettingsProvider } from "./lib/app-settings";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
