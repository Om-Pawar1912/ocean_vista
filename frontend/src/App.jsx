import React from "react";

import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Explorer from "./pages/Explorer";
import Analysis from "./pages/Analysis";
import Education from "./pages/Education";

export default function App() {
  return (
    <Routes>

      {/* =========================
          LANDING PAGE
      ========================= */}
      <Route
        path="/"
        element={<Landing />}
      />

      {/* =========================
          LOGIN PAGE
      ========================= */}
      <Route
        path="/login"
        element={<Login />}
      />

      {/* =========================
          MAIN OCEAN DASHBOARD
      ========================= */}
      <Route
        path="/dashboard"
        element={<Explorer />}
      />

      {/* Keep old explorer URL working */}
      <Route
        path="/explorer"
        element={<Explorer />}
      />

      {/* =========================
          3D INSTRUMENT ANALYSIS
      ========================= */}
      <Route
        path="/analysis/:instrumentId"
        element={<Analysis />}
      />

      {/* =========================
          EDUCATION PAGE
      ========================= */}
      <Route
        path="/education"
        element={<Education />}
      />

      {/* =========================
          UNKNOWN URL
      ========================= */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}