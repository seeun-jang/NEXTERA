import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DemoProvider } from "./state/DemoContext";
import { RunProvider } from "./state/run";
import { TourProvider } from "./tour/TourProvider";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/landing.css";
import "./styles/tour.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <DemoProvider>
        <RunProvider>
          <TourProvider>
            <App />
          </TourProvider>
        </RunProvider>
      </DemoProvider>
    </BrowserRouter>
  </StrictMode>,
);
