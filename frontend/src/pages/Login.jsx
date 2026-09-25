import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();

  const openDashboard = () => {
    navigate("/dashboard");
  };

  return (
    <div className="reference-page login-page">

      {/* =================================
          EXACT LOGIN REFERENCE IMAGE
      ================================= */}

      <img
        src="/login-reference.jpeg"
        alt="Ocean Data Visualization System Login"
        className="reference-image"
      />

      {/* =================================
          TRANSPARENT LOGIN HOTSPOTS
      ================================= */}

      {/* Email / Username */}
      <button
        className="login-hotspot login-username"
        aria-label="Username"
        onClick={() => {}}
      />

      {/* Password */}
      <button
        className="login-hotspot login-password"
        aria-label="Password"
        onClick={() => {}}
      />

      {/* Remember me */}
      <button
        className="login-hotspot login-remember"
        aria-label="Remember me"
        onClick={() => {}}
      />

      {/* Forgot Password */}
      <button
        className="login-hotspot login-forgot"
        aria-label="Forgot Password"
        onClick={() => {}}
      />

      {/* =================================
          LOGIN → DASHBOARD
      ================================= */}

      <button
        className="login-hotspot login-button"
        aria-label="Login"
        onClick={openDashboard}
      />

      {/* =================================
          CONTINUE AS GUEST
      ================================= */}

      <button
        className="login-hotspot login-guest"
        aria-label="Continue as Guest"
        onClick={openDashboard}
      />

      {/* =================================
          LOGIN WITH SSO
      ================================= */}

      <button
        className="login-hotspot login-sso"
        aria-label="Login with SSO"
        onClick={openDashboard}
      />

    </div>
  );
}