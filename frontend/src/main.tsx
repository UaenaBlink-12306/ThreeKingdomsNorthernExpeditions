import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import RootErrorBoundary from "./components/RootErrorBoundary";
import { queryClient } from "./query/client";
import { setupGlobalErrorLogging } from "./utils/errorLogger";
import "leaflet/dist/leaflet.css";
import "./styles.css";

setupGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
