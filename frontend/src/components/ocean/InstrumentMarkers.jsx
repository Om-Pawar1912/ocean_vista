import React, { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* =========================================================
   PHASE 3 DEMO INSTRUMENT DATA

   These coordinates are temporary.

   Later:
   NetCDF / CSV / TXT
          ↓
   latitude / longitude / depth / variables
          ↓
   these markers will be generated automatically.
========================================================= */

export const INSTRUMENT_DATA = [
  {
    id: "ARGO-2903671",
    type: "argo",
    name: "ARGO-2903671",
    latitude: 17.85,
    longitude: 86.41,
    depth: 0,
    temperature: 29.3769,
    salinity: 34.2,
    chlorophyll: 0.82,
    status: "Active",
  },

  {
    id: "ARGO-2903672",
    type: "argo",
    name: "ARGO-2903672",
    latitude: 15.8,
    longitude: 82.5,
    depth: 0,
    temperature: 28.91,
    salinity: 34.55,
    chlorophyll: 0.71,
    status: "Active",
  },

  {
    id: "ARGO-2903673",
    type: "argo",
    name: "ARGO-2903673",
    latitude: 12.9,
    longitude: 88.7,
    depth: 0,
    temperature: 27.84,
    salinity: 35.01,
    chlorophyll: 0.63,
    status: "Active",
  },

  {
    id: "ARGO-2903674",
    type: "argo",
    name: "ARGO-2903674",
    latitude: 9.4,
    longitude: 77.2,
    depth: 0,
    temperature: 28.24,
    salinity: 34.8,
    chlorophyll: 0.91,
    status: "Active",
  },

  {
    id: "ARGO-2903675",
    type: "argo",
    name: "ARGO-2903675",
    latitude: 15.6,
    longitude: 88.3,
    depth: 0,
    temperature: 29.1,
    salinity: 35.2,
    chlorophyll: 0.76,
    status: "Active",
  },

  {
    id: "FLOAT-001",
    type: "float",
    name: "FLOAT-001",
    latitude: 5.2,
    longitude: 78.8,
    depth: 0,
    temperature: 28.1,
    salinity: 34.9,
    chlorophyll: 0.68,
    status: "Active",
  },

  {
    id: "CTD-001",
    type: "ctd",
    name: "CTD-001",
    latitude: 10.5,
    longitude: 72.8,
    depth: 50,
    temperature: 27.4,
    salinity: 35.1,
    chlorophyll: 0.54,
    status: "Survey",
  },

  {
    id: "BGC-001",
    type: "bgc",
    name: "BGC-001",
    latitude: 7.8,
    longitude: 91.2,
    depth: 10,
    temperature: 28.7,
    salinity: 34.7,
    chlorophyll: 1.42,
    status: "Active",
  },

  {
    id: "MOOR-001",
    type: "moorings",
    name: "MOOR-001",
    latitude: 13.4,
    longitude: 80.3,
    depth: 100,
    temperature: 27.8,
    salinity: 35.0,
    chlorophyll: 0.47,
    status: "Active",
  },

  {
    id: "RADAR-001",
    type: "radar",
    name: "HF-RADAR-001",
    latitude: 19.1,
    longitude: 72.9,
    depth: 0,
    temperature: 28.3,
    salinity: 34.6,
    chlorophyll: 0.38,
    status: "Online",
  },
];

/* =========================================================
   MARKER COLORS
========================================================= */

const MARKER_COLORS = {
  argo: "#00d9ff",
  float: "#65e5ff",
  ctd: "#ffd166",
  bgc: "#4de38b",
  moorings: "#ad86ff",
  radar: "#ff67c4",
};

/* =========================================================
   LAT/LON → 3D POSITION

   Earth radius = 2.45
   Markers sit slightly above the surface.
========================================================= */

export function latLonToVector3(
  latitude,
  longitude,
  radius = 2.5
) {
  const lat =
    THREE.MathUtils.degToRad(latitude);

  const lon =
    THREE.MathUtils.degToRad(longitude);

  const x =
    radius *
    Math.cos(lat) *
    Math.sin(lon);

  const y =
    radius *
    Math.sin(lat);

  const z =
    radius *
    Math.cos(lat) *
    Math.cos(lon);

  return new THREE.Vector3(x, y, z);
}

/* =========================================================
   PULSING RING
========================================================= */

function PulseRing({ color }) {
  const ringRef = useRef();

  useFrame((state) => {
    if (!ringRef.current) return;

    const time = state.clock.getElapsedTime();

    const wave =
      (Math.sin(time * 3) + 1) / 2;

    const scale =
      0.85 + wave * 0.8;

    ringRef.current.scale.set(
      scale,
      scale,
      scale
    );

    ringRef.current.material.opacity =
      0.65 - wave * 0.5;
  });

  return (
    <mesh ref={ringRef}>
      <ringGeometry
        args={[0.045, 0.06, 32]}
      />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* =========================================================
   SINGLE MARKER
========================================================= */

function InstrumentMarker({
  instrument,
  selected,
  onSelect,
}) {
  const color =
    MARKER_COLORS[instrument.type] ||
    "#00d9ff";

  const position = useMemo(
    () =>
      latLonToVector3(
        instrument.latitude,
        instrument.longitude,
        2.51
      ),
    [
      instrument.latitude,
      instrument.longitude,
    ]
  );

  /*
   * Rotate marker so it points away
   * from the Earth's center.
   */
  const quaternion = useMemo(() => {
    const normal =
      position.clone().normalize();

    const q =
      new THREE.Quaternion();

    q.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal
    );

    return q;
  }, [position]);

  return (
    <group
      position={position}
      quaternion={quaternion}
    >
      {/* Vertical marker stem */}
      <mesh position={[0, 0, 0.07]}>
        <cylinderGeometry
          args={[
            0.008,
            0.008,
            0.14,
            8,
          ]}
        />

        <meshBasicMaterial
          color={color}
        />
      </mesh>

      {/* Main marker */}
      <mesh
        position={[0, 0, 0.15]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(instrument);
        }}
      >
        <sphereGeometry
          args={[
            selected ? 0.085 : 0.065,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color={color}
        />
      </mesh>

      {/* Glow around marker */}
      <mesh
        position={[0, 0, 0.15]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(instrument);
        }}
      >
        <sphereGeometry
          args={[
            selected ? 0.17 : 0.13,
            16,
            16,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.09}
        />
      </mesh>

      {/* Animated pulse */}
      <group position={[0, 0, 0.15]}>
        <PulseRing color={color} />
      </group>

      {/* Label only for selected marker */}
      {selected && (
        <Html
          position={[0, 0, 0.28]}
          center
          distanceFactor={5}
          zIndexRange={[100, 0]}
        >
          <div
            className="instrument-marker-label"
            style={{
              borderColor: color,
              boxShadow:
                `0 0 18px ${color}44`,
            }}
          >
            <div className="marker-label-title">
              {instrument.name}
            </div>

            <div className="marker-label-type">
              {instrument.type.toUpperCase()}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* =========================================================
   ALL INSTRUMENT MARKERS
========================================================= */

export default function InstrumentMarkers({
  selectedInstrument,
  selectedMarker,
  onSelect,
}) {
  const visibleMarkers = useMemo(() => {
    return INSTRUMENT_DATA.filter(
      (instrument) =>
        instrument.type ===
        selectedInstrument
    );
  }, [selectedInstrument]);

  return (
    <group>
      {visibleMarkers.map((instrument) => (
        <InstrumentMarker
          key={instrument.id}
          instrument={instrument}
          selected={
            selectedMarker?.id ===
            instrument.id
          }
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}