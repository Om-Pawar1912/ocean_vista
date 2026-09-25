import React, { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Stars,
  Text,
} from "@react-three/drei";
import { useNavigate, useParams } from "react-router-dom";
import * as THREE from "three";

import { getInstrument } from "../data/instruments";
import "../styles/ocean-analysis.css";

/* -------------------------------------------------------
   DEPTH PROFILE
------------------------------------------------------- */

const PROFILE = [
  { depth: 0, temperature: 28.24, salinity: 34.8, oxygen: 6.2 },
  { depth: 50, temperature: 27.62, salinity: 34.86, oxygen: 5.9 },
  { depth: 100, temperature: 26.85, salinity: 34.94, oxygen: 5.5 },
  { depth: 200, temperature: 24.4, salinity: 35.02, oxygen: 4.9 },
  { depth: 300, temperature: 21.2, salinity: 35.18, oxygen: 4.4 },
  { depth: 500, temperature: 17.3, salinity: 35.35, oxygen: 3.9 },
  { depth: 750, temperature: 13.7, salinity: 35.51, oxygen: 3.6 },
  { depth: 1000, temperature: 10.4, salinity: 35.72, oxygen: 3.2 },
  { depth: 1500, temperature: 7.1, salinity: 36.32, oxygen: 2.8 },
  { depth: 2000, temperature: 5.37, salinity: 37.24, oxygen: 2.4 },
];

/* -------------------------------------------------------
   COLOR HELPERS
------------------------------------------------------- */

function temperatureColor(value) {
  const min = 4;
  const max = 30;

  const t = THREE.MathUtils.clamp(
    (value - min) / (max - min),
    0,
    1
  );

  const color = new THREE.Color();

  color.setHSL(
    0.67 - t * 0.67,
    0.95,
    0.5
  );

  return color;
}

/* -------------------------------------------------------
   WATER LAYERS
------------------------------------------------------- */

function WaterColumn({ variable }) {
  const layers = useMemo(() => {
    return PROFILE.map((point, index) => {
      const y = -(point.depth / 2000) * 7;

      let color;

      if (variable === "temperature") {
        color = temperatureColor(point.temperature);
      } else if (variable === "salinity") {
        const t = THREE.MathUtils.clamp(
          (point.salinity - 34.5) / 3,
          0,
          1
        );

        color = new THREE.Color().setHSL(
          0.58 - t * 0.15,
          0.85,
          0.48
        );
      } else {
        const t = THREE.MathUtils.clamp(
          point.oxygen / 7,
          0,
          1
        );

        color = new THREE.Color().setHSL(
          0.55 - t * 0.25,
          0.85,
          0.48
        );
      }

      return {
        ...point,
        y,
        color,
        radius: 1.65 - index * 0.045,
      };
    });
  }, [variable]);

  return (
    <group>
      {layers.map((layer, index) => (
        <group key={layer.depth}>
          <mesh position={[0, layer.y, 0]}>
            <cylinderGeometry
              args={[
                layer.radius,
                layer.radius + 0.03,
                0.65,
                64,
                1,
                false,
              ]}
            />

            <meshPhysicalMaterial
              color={layer.color}
              transparent
              opacity={0.18}
              roughness={0.25}
              metalness={0}
              transmission={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>

          {index < layers.length - 1 && (
            <mesh
              position={[0, layer.y - 0.33, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry
                args={[
                  layer.radius * 0.82,
                  layer.radius,
                  64,
                ]}
              />

              <meshBasicMaterial
                color={layer.color}
                transparent
                opacity={0.22}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* -------------------------------------------------------
   OCEAN FLOOR
------------------------------------------------------- */

function OceanFloor() {
  return (
    <mesh
      position={[0, -7.15, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[1.65, 64]} />

      <meshStandardMaterial
        color="#07141c"
        roughness={0.9}
        metalness={0.05}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

/* -------------------------------------------------------
   DEPTH GRID
------------------------------------------------------- */

function DepthGrid() {
  const depths = [0, 100, 200, 500, 1000, 1500, 2000];

  return (
    <group>
      {depths.map((depth) => {
        const y = -(depth / 2000) * 7;

        return (
          <group key={depth}>
            <mesh position={[0, y, 0]}>
              <torusGeometry
                args={[1.67, 0.008, 8, 96]}
              />

              <meshBasicMaterial color="#16c9ff" />
            </mesh>

            <Text
              position={[1.95, y, 0]}
              fontSize={0.12}
              color="#6e8795"
              anchorX="left"
              anchorY="middle"
            >
              {depth} m
            </Text>
          </group>
        );
      })}
    </group>
  );
}

/* -------------------------------------------------------
   ARGO PROFILE LINE
------------------------------------------------------- */

function InstrumentProfile() {
  const points = PROFILE.map((point) => {
    const y = -(point.depth / 2000) * 7;

    const x =
      ((point.temperature - 5) / 25) * 1.1 - 0.55;

    return new THREE.Vector3(x, y, 0);
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(points);
    return geo;
  }, []);

  return (
    <group>
      <line geometry={geometry}>
        <lineBasicMaterial
          color="#ff3f7f"
          linewidth={3}
        />
      </line>

      {points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#ff4b87" />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------------------------------
   INSTRUMENT
------------------------------------------------------- */

function InstrumentObject() {
  return (
    <group position={[0, 0.18, 0]}>
      <mesh>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshBasicMaterial color="#6beaff" />
      </mesh>

      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.35, 12]} />
        <meshBasicMaterial color="#b7f7ff" />
      </mesh>

      <pointLight
        color="#24d8ff"
        intensity={2}
        distance={3}
      />
    </group>
  );
}

/* -------------------------------------------------------
   3D SCENE
------------------------------------------------------- */

function OceanScene({ variable }) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[8, 4, 9]}
        fov={45}
      />

      <color attach="background" args={["#02080e"]} />

      <ambientLight intensity={0.65} />

      <directionalLight
        position={[5, 8, 6]}
        intensity={1.4}
      />

      <pointLight
        position={[-5, 3, 5]}
        intensity={1}
        color="#087da8"
      />

      <Stars
        radius={50}
        depth={30}
        count={2500}
        factor={2}
        saturation={0}
        fade
      />

      <WaterColumn variable={variable} />

      <OceanFloor />

      <DepthGrid />

      <InstrumentProfile />

      <InstrumentObject />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={6}
        maxDistance={18}
        target={[0, -3.3, 0]}
      />
    </>
  );
}

/* -------------------------------------------------------
   TOP BAR
------------------------------------------------------- */

function Header({ instrument, onBack }) {
  return (
    <header className="analysis-header">
      <button
        className="analysis-back"
        onClick={onBack}
      >
        ←
      </button>

      <div className="analysis-title">
        <span>OCEAN DATA VISUALIZATION SYSTEM</span>

        <strong>
          3D Ocean Analysis
        </strong>
      </div>

      <div className="analysis-instrument">
        <span>SELECTED INSTRUMENT</span>
        <strong>{instrument.id}</strong>
      </div>
    </header>
  );
}

/* -------------------------------------------------------
   LEFT CONTROL PANEL
------------------------------------------------------- */

function ControlPanel({
  variable,
  setVariable,
  depth,
  setDepth,
}) {
  return (
    <aside className="analysis-panel left-panel">

      <div className="panel-section">
        <div className="section-title">
          LAYERS
        </div>

        <label className="check-row active">
          <input
            type="checkbox"
            defaultChecked
          />
          <span>Ocean Volume</span>
        </label>

        <label className="check-row active">
          <input
            type="checkbox"
            defaultChecked
          />
          <span>Instrument Profile</span>
        </label>

        <label className="check-row">
          <input type="checkbox" />
          <span>Model Field</span>
        </label>
      </div>

      <div className="panel-section">
        <div className="section-title">
          VARIABLES
        </div>

        {[
          ["temperature", "Temperature"],
          ["salinity", "Salinity"],
          ["oxygen", "Dissolved Oxygen"],
          ["chlorophyll", "Chlorophyll"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`variable-button ${
              variable === value ? "selected" : ""
            }`}
            onClick={() => setVariable(value)}
          >
            <span className="variable-dot" />
            {label}
          </button>
        ))}
      </div>

      <div className="panel-section">
        <div className="section-title">
          DEPTH SLICE
        </div>

        <select
          value={depth}
          onChange={(event) =>
            setDepth(event.target.value)
          }
          className="depth-select"
        >
          <option value="surface">
            Surface
          </option>

          <option value="50">
            50 m
          </option>

          <option value="100">
            100 m
          </option>

          <option value="200">
            200 m
          </option>

          <option value="500">
            500 m
          </option>

          <option value="1000">
            1000 m
          </option>

          <option value="1500">
            1500 m
          </option>

          <option value="2000">
            2000 m
          </option>
        </select>
      </div>

      <div className="panel-section">
        <div className="section-title">
          VISUALIZATION MODE
        </div>

        <button className="mode-button active">
          3D Volume
        </button>

        <button className="mode-button">
          Depth Slice
        </button>

        <button className="mode-button">
          Profile
        </button>
      </div>

      <div className="panel-section">
        <div className="section-title">
          VISUAL CONTROLS
        </div>

        <label className="range-label">
          Opacity
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            defaultValue="0.65"
          />
        </label>

        <label className="range-label">
          Vertical Exaggeration
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            defaultValue="1"
          />
        </label>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------
   RIGHT INFORMATION PANEL
------------------------------------------------------- */

function InformationPanel({ instrument }) {
  return (
    <aside className="analysis-panel right-panel">

      <div className="info-heading">
        INSTRUMENT
      </div>

      <h2>{instrument.id}</h2>

      <div className="type-badge">
        {instrument.type}
      </div>

      <div className="status-line">
        <span />
        {instrument.status}
      </div>

      <div className="info-grid">

        <div>
          <small>LATITUDE</small>
          <strong>
            {instrument.latitude.toFixed(2)}°
          </strong>
        </div>

        <div>
          <small>LONGITUDE</small>
          <strong>
            {instrument.longitude.toFixed(2)}°
          </strong>
        </div>

        <div>
          <small>MAX DEPTH</small>
          <strong>
            {instrument.depth} m
          </strong>
        </div>

        <div>
          <small>TEMPERATURE</small>
          <strong>
            {instrument.temperature} °C
          </strong>
        </div>

        <div>
          <small>SALINITY</small>
          <strong>
            {instrument.salinity} PSU
          </strong>
        </div>

        <div>
          <small>CHLOROPHYLL</small>
          <strong>
            {instrument.chlorophyll} mg/m³
          </strong>
        </div>

      </div>

      <div className="profile-title">
        DEPTH PROFILE
      </div>

      <div className="mini-profile">
        {PROFILE.map((item, index) => (
          <div
            key={index}
            className="profile-row"
          >
            <span>
              {item.depth}m
            </span>

            <div className="profile-bar">
              <div
                style={{
                  width: `${Math.max(
                    8,
                    ((item.temperature - 5) /
                      25) *
                      100
                  )}%`,
                }}
              />
            </div>

            <strong>
              {item.temperature.toFixed(1)}°
            </strong>
          </div>
        ))}
      </div>

    </aside>
  );
}

/* -------------------------------------------------------
   COLOR LEGEND
------------------------------------------------------- */

function ColorLegend({ variable }) {
  let title = "TEMPERATURE";
  let unit = "°C";

  if (variable === "salinity") {
    title = "SALINITY";
    unit = "PSU";
  }

  if (variable === "oxygen") {
    title = "DISSOLVED OXYGEN";
    unit = "mg/L";
  }

  if (variable === "chlorophyll") {
    title = "CHLOROPHYLL";
    unit = "mg/m³";
  }

  return (
    <div className="analysis-legend">

      <div className="legend-title">
        {title}
      </div>

      <div className="legend-body">

        <div className="gradient-bar" />

        <div className="legend-values">
          <span>32</span>
          <span>24</span>
          <span>16</span>
          <span>8</span>
          <span>0</span>
        </div>

      </div>

      <div className="legend-unit">
        {unit}
      </div>

    </div>
  );
}

/* -------------------------------------------------------
   BOTTOM STATUS
------------------------------------------------------- */

function BottomBar({ instrument }) {
  return (
    <div className="analysis-bottom">

      <div>
        <span>LOCATION</span>
        <strong>
          {instrument.latitude.toFixed(2)}°N{" "}
          {instrument.longitude.toFixed(2)}°E
        </strong>
      </div>

      <div>
        <span>DEPTH RANGE</span>
        <strong>
          0 — {instrument.depth} m
        </strong>
      </div>

      <div>
        <span>DATA SOURCE</span>
        <strong>
          Argo Observation
        </strong>
      </div>

      <div className="analysis-live">
        ● LIVE VIEW
      </div>

    </div>
  );
}

/* -------------------------------------------------------
   MAIN PAGE
------------------------------------------------------- */

export default function OceanAnalysis() {
  const { id } = useParams();

  const navigate = useNavigate();

  const instrument =
    getInstrument(id) ||
    getInstrument("ARGO-2903674");

  const [variable, setVariable] =
    useState("temperature");

  const [depth, setDepth] =
    useState("surface");

  return (
    <main className="ocean-analysis">

      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
        }}
      >
        <Suspense fallback={null}>
          <OceanScene variable={variable} />
        </Suspense>
      </Canvas>

      <Header
        instrument={instrument}
        onBack={() => navigate("/")}
      />

      <ControlPanel
        variable={variable}
        setVariable={setVariable}
        depth={depth}
        setDepth={setDepth}
      />

      <InformationPanel
        instrument={instrument}
      />

      <ColorLegend
        variable={variable}
      />

      <BottomBar
        instrument={instrument}
      />

      <div className="analysis-center-label">
        <span>SELECTED LOCATION</span>
        <strong>
          {instrument.latitude.toFixed(2)}°N
          {" "}
          {instrument.longitude.toFixed(2)}°E
        </strong>
      </div>

    </main>
  );
}