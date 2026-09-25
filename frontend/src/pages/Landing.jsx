import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="reference-page">

      {/* Exact reference image */}
      <img
        src="/landing-reference.jpeg"
        alt="Ocean Data Visualization System"
        className="reference-image"
      />

      {/* =========================
          TRANSPARENT HOTSPOTS
      ========================= */}

      {/* Get Started */}
      <button
        className="landing-hotspot landing-get-started"
        onClick={() => navigate("/login")}
        aria-label="Get Started"
      />

      {/* Explore 3D Ocean */}
      <button
        className="landing-hotspot landing-explore"
        onClick={() => navigate("/login")}
        aria-label="Explore 3D Ocean"
      />

      {/* Education Purpose */}
      <button
        type="button"
        className="landing-hotspot landing-education"
        onClick={(e) => {
          e.stopPropagation();
          navigate("/education");
        }}
        aria-label="Education Purpose"
      />







      {/* Navbar Explore */}
      <button
        className="landing-nav-hotspot landing-nav-explore"
        onClick={() => navigate("/login")}
        aria-label="Explore"
      />

      {/* Navbar Visualize */}
      <button
        className="landing-nav-hotspot landing-nav-visualize"
        onClick={() => navigate("/login")}
        aria-label="Visualize"
      />

      {/* Navbar Analyze */}
      <button
        className="landing-nav-hotspot landing-nav-analyze"
        onClick={() => navigate("/login")}
        aria-label="Analyze"
      />

    </div>
  );
}