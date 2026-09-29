import React, {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Canvas,
  useThree,
} from "@react-three/fiber";

import {
  OrbitControls,
  Stars,
  useTexture,
} from "@react-three/drei";

import * as THREE from "three";

import { useNavigate } from "react-router-dom";

import "../styles/explorer.css";

const API_BASE_URL = "https://ocean-vista-1.onrender.com";

/* =========================================================
   VARIABLES
========================================================= */

const VARIABLES = [
  {
    id: "temperature",
    label: "Temperature",
    short: "°C",
    color: "#ff6333",
  },
  {
    id: "salinity",
    label: "Salinity",
    short: "S",
    color: "#39c9ff",
  },
  {
    id: "currents",
    label: "Currents",
    short: "≈",
    color: "#18d8ff",
  },
  {
    id: "chlorophyll",
    label: "Chlorophyll",
    short: "Ch",
    color: "#35e887",
  },
  {
    id: "oxygen",
    label: "Dissolved Oxygen",
    short: "O₂",
    color: "#9d78ff",
  },
];

/* =========================================================
   INSTRUMENT TYPES
========================================================= */

const INSTRUMENT_TYPES = [
  {
    id: "argo",
    label: "Argo",
    symbol: "◉",
  },
  {
    id: "float",
    label: "Float",
    symbol: "•",
  },
  {
    id: "ctd",
    label: "CTD",
    symbol: "◇",
  },
  {
    id: "bgc",
    label: "BGC",
    symbol: "✦",
  },
  {
    id: "moorings",
    label: "Moorings",
    symbol: "↕",
  },
  {
    id: "radar",
    label: "HF radar",
    symbol: "◌",
  },
  {
    id: "glider",
    label: "Glider",
    symbol: "◇",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function numberOrFallback(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getInstrumentTypeId(type) {
  const normalized =
    String(type || "").toLowerCase();

  if (normalized.includes("argo")) {
    return "argo";
  }

  /* IMPORTANT: GLIDER SUPPORT */
  if (normalized.includes("glider")) {
    return "glider";
  }

  if (normalized.includes("float")) {
    return "float";
  }

  if (normalized.includes("ctd")) {
    return "ctd";
  }

  if (normalized.includes("bgc")) {
    return "bgc";
  }

  if (
    normalized.includes("moor") ||
    normalized.includes("mooring")
  ) {
    return "moorings";
  }

  if (normalized.includes("radar")) {
    return "radar";
  }

  return "argo";
}

/* =========================================================
   NORMALIZE BACKEND INSTRUMENT
========================================================= */

function normalizeBackendInstrument(
  instrument
) {
  const profile =
    instrument?.profile || {};

  const variables =
    profile?.variables || {};

  const depthValues =
    Array.isArray(profile?.depth)
      ? profile.depth
      : [];

  const temperatureValues =
    Array.isArray(
      variables.temperature
    )
      ? variables.temperature
      : [];

  const salinityValues =
    Array.isArray(
      variables.salinity
    )
      ? variables.salinity
      : [];

  const temperature =
    temperatureValues.length > 0
      ? numberOrFallback(
          temperatureValues[0]
        )
      : 0;

  const salinity =
    salinityValues.length > 0
      ? numberOrFallback(
          salinityValues[0]
        )
      : 0;

  const maxDepth =
    depthValues.length > 0
      ? Math.max(
          ...depthValues.map(
            (value) =>
              numberOrFallback(value)
          )
        )
      : numberOrFallback(
          instrument.depth
        );

  return {
    id: String(
      instrument.id ?? ""
    ),

    type: String(
      instrument.type || "ARGO"
    ).toUpperCase(),

    latitude: numberOrFallback(
      instrument.latitude
    ),

    longitude: numberOrFallback(
      instrument.longitude
    ),

    depth: maxDepth,

    status:
      instrument.status ||
      "Active",

    time:
      instrument.time ||
      null,

    temperature,

    salinity,

    chlorophyll:
      Array.isArray(
        variables.chlorophyll
      )
        ? numberOrFallback(
            variables.chlorophyll[0]
          )
        : 0,

    oxygen:
      Array.isArray(
        variables.oxygen
      )
        ? numberOrFallback(
            variables.oxygen[0]
          )
        : 0,

    profile: {
      depth: depthValues,
      variables,
    },

    source: "backend",
  };
}

/* =========================================================
   LAT/LON → 3D POSITION
========================================================= */

function latLonToVector3(
  latitude,
  longitude,
  radius
) {
  const lat =
    THREE.MathUtils.degToRad(
      latitude
    );

  const lon =
    THREE.MathUtils.degToRad(
      longitude
    );

  return new THREE.Vector3(
    radius *
      Math.cos(lat) *
      Math.cos(lon),

    radius *
      Math.sin(lat),

    radius *
      Math.cos(lat) *
      Math.sin(lon)
  );
}

/* =========================================================
   EARTH
========================================================= */

function Earth() {
  const texture =
    useTexture(
      "/textures/earth_atmos_2048.jpg"
    );

  useEffect(() => {
    texture.colorSpace =
      THREE.SRGBColorSpace;

    texture.anisotropy = 8;

    texture.needsUpdate = true;
  }, [texture]);

  return (
    <group
      rotation={[
        0,
        -0.62,
        0,
      ]}
    >
      {/* EARTH */}

      <mesh>
        <sphereGeometry
          args={[
            2.5,
            128,
            128,
          ]}
        />

        <meshStandardMaterial
          map={texture}
          roughness={0.76}
          metalness={0.02}
        />
      </mesh>

      {/* ATMOSPHERIC GLOW */}

      <mesh scale={1.028}>
        <sphereGeometry
          args={[
            2.5,
            96,
            96,
          ]}
        />

        <meshBasicMaterial
          color="#0875b5"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* OCEAN GLOW */}

      <mesh scale={1.008}>
        <sphereGeometry
          args={[
            2.5,
            96,
            96,
          ]}
        />

        <meshBasicMaterial
          color="#063bff"
          transparent
          opacity={0.045}
          blending={
            THREE.AdditiveBlending
          }
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   VARIABLE LAYER
========================================================= */

function OceanVariableLayer({
  variable,
}) {
  const color = useMemo(() => {
    switch (variable) {
      case "temperature":
        return new THREE.Color(
          "#143cff"
        );

      case "salinity":
        return new THREE.Color(
          "#00a8ff"
        );

      case "currents":
        return new THREE.Color(
          "#00d8ff"
        );

      case "chlorophyll":
        return new THREE.Color(
          "#00ff88"
        );

      case "oxygen":
        return new THREE.Color(
          "#8b64ff"
        );

      default:
        return new THREE.Color(
          "#123dff"
        );
    }
  }, [variable]);

  return (
    <mesh
      scale={1.012}
      rotation={[
        0,
        -0.62,
        0,
      ]}
    >
      <sphereGeometry
        args={[
          2.5,
          96,
          96,
        ]}
      />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.075}
        blending={
          THREE.AdditiveBlending
        }
      />
    </mesh>
  );
}
/* =========================================================
   ARGO POINT MARKER
========================================================= */

function ArgoFloatModel({
  selected,
  onSelect,
}) {
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      scale={selected ? 1.35 : 1}
    >
      {/* MAIN YELLOW POINT */}
      <mesh>
        <sphereGeometry
          args={[
            selected ? 0.045 : 0.028,
            16,
            16,
          ]}
        />

        <meshBasicMaterial
          color="#ffd21f"
        />
      </mesh>

      {/* SUBTLE YELLOW GLOW */}
      <mesh>
        <sphereGeometry
          args={[
            selected ? 0.075 : 0.045,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color="#ffd21f"
          transparent
          opacity={
            selected
              ? 0.16
              : 0.045
          }
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* SELECTED RING */}
      {selected && (
        <mesh>
          <ringGeometry
            args={[
              0.075,
              0.10,
              24,
            ]}
          />

          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

/* =========================================================
   INSTRUMENT MARKER
   IMPORTANT:
   Marker uses same Earth rotation.
========================================================= */

function InstrumentMarker({
  instrument,
  selected,
  onSelect,
}) {
  const position =
    useMemo(() => {
      const vector =
        latLonToVector3(
          instrument.latitude,
          instrument.longitude,
          2.58
        );

      vector.applyAxisAngle(
        new THREE.Vector3(
          0,
          1,
          0
        ),
        -0.62
      );

      return vector;
    }, [
      instrument.latitude,
      instrument.longitude,
    ]);

  const isArgo =
    String(
      instrument.type
    ).toUpperCase() ===
    "ARGO";

  return (
    <group
      position={position}
    >
      {isArgo ? (
        <ArgoFloatModel
          selected={
            selected
          }
          onSelect={() =>
            onSelect(
              instrument
            )
          }
        />
      ) : (
        <GenericInstrumentMarker
          instrument={
            instrument
          }
          selected={
            selected
          }
          onSelect={
            onSelect
          }
        />
      )}
    </group>
  );
}

/* =========================================================
   GLOBE
========================================================= */

function Globe({
  variable,
  instruments,
  selectedInstrument,
  onSelectInstrument,
}) {
  return (
    <group>
      <Earth />

      <OceanVariableLayer
        variable={variable}
      />

      {instruments.map(
        (instrument) => (
          <InstrumentMarker
            key={`${instrument.type}-${instrument.id}`}
            instrument={
              instrument
            }
            selected={
              selectedInstrument?.id ===
              instrument.id
            }
            onSelect={
              onSelectInstrument
            }
          />
        )
      )}
    </group>
  );
}

/* =========================================================
   CAMERA
========================================================= */

function CameraSetup() {
  const { camera } =
    useThree();

  useEffect(() => {
    camera.position.set(
      0,
      0.25,
      7.2
    );

    camera.lookAt(
      0,
      0,
      0
    );
  }, [camera]);

  return null;
}

/* =========================================================
   GLOBE SCENE
========================================================= */

function GlobeScene({
  variable,
  instruments,
  selectedInstrument,
  onSelectInstrument,
}) {
  return (
    <>
      <CameraSetup />

      <color
        attach="background"
        args={[
          "#01070d",
        ]}
      />

      <ambientLight
        intensity={0.7}
      />

      <directionalLight
        position={[
          5,
          5,
          5,
        ]}
        intensity={1.7}
      />

      <pointLight
        position={[
          -5,
          2,
          4,
        ]}
        color="#0878bd"
        intensity={2}
        distance={12}
      />

      <Stars
        radius={70}
        depth={40}
        count={4500}
        factor={2}
        saturation={0}
        fade
        speed={0.2}
      />

      <Globe
        variable={
          variable
        }
        instruments={
          instruments
        }
        selectedInstrument={
          selectedInstrument
        }
        onSelectInstrument={
          onSelectInstrument
        }
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.055}
        minDistance={4.5}
        maxDistance={10}
        rotateSpeed={0.45}
        zoomSpeed={0.7}
      />
    </>
  );
}

/* =========================================================
   SEARCH
========================================================= */

function SearchBar({
  search,
  setSearch,
}) {
  return (
    <div className="search-container">
      <div className="search-icon">
        ⌕
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value
          )
        }
        placeholder="Search location, variable, or keyword..."
      />

      <div className="search-shortcut">
        ⌘ K
      </div>
    </div>
  );
}

/* =========================================================
   BRAND
========================================================= */

function BrandArea() {
  return (
    <div className="brand-area">
      <div className="copernicus-brand">
        <div className="eu-stars">
          
        </div>

        <div>
          <small>
            
          </small>

          <strong>
            
          </strong>
        </div>
      </div>

      <div className="brand-divider" />

      <div className="mercator-brand">
        <strong>
          
        </strong>

        <small>
          
        </small>
      </div>
    </div>
  );
}

/* =========================================================
   UPLOAD DATASET
========================================================= */

function UploadDataset({
  onDatasetLoaded,
  datasetName,
  uploadMessage,
  uploading,
  instrumentType,
  setInstrumentType,
}) {
  const [
    inputKey,
    setInputKey,
  ] = useState(0);

  const [
    uploadType,
    setUploadType,
  ] = useState(
    instrumentType || "argo"
  );

  const [
    showTypeSelector,
    setShowTypeSelector,
  ] = useState(false);

  useEffect(() => {
    if (instrumentType) {
      setUploadType(
        instrumentType
      );
    }
  }, [instrumentType]);

  const handleUploadClick = () => {
    if (uploading) {
      return;
    }

    setUploadType(
      instrumentType || "argo"
    );

    setShowTypeSelector(true);
  };

  const handleInstrumentSelect = (
    type
  ) => {
    setUploadType(type);

    setInstrumentType(type);

    setShowTypeSelector(false);

    setTimeout(() => {
      document
        .getElementById(
          "ocean-dataset-upload"
        )
        ?.click();
    }, 50);
  };

  const handleFile = async (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    await onDatasetLoaded(
      file,
      uploadType
    );

    setInputKey(
      (value) =>
        value + 1
    );
  };

  return (
    <div className="upload-wrapper">

      {/* =================================================
          HIDDEN FILE INPUT
      ================================================= */}

      <input
        key={inputKey}
        type="file"
        accept=".nc,.cdf,.csv,.txt"
        id="ocean-dataset-upload"
        style={{
          display: "none",
        }}
        onChange={
          handleFile
        }
      />

      {/* =================================================
          UPLOAD BUTTON
      ================================================= */}

      <button
        type="button"
        className="upload-dataset-button"
        onClick={
          handleUploadClick
        }
        disabled={uploading}
        style={{
          opacity:
            uploading
              ? 0.65
              : 1,

          pointerEvents:
            uploading
              ? "none"
              : "auto",

          cursor:
            uploading
              ? "default"
              : "pointer",
        }}
      >
        <span className="upload-icon">
          ↑
        </span>

        <span>
          {uploading
            ? "UPLOADING..."
            : "UPLOAD DATASET"}
        </span>
      </button>

      {/* =================================================
          INSTRUMENT TYPE SELECTOR
      ================================================= */}

      {showTypeSelector && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "rgba(0, 5, 12, 0.72)",
            backdropFilter:
              "blur(8px)",
          }}
          onClick={() =>
            setShowTypeSelector(false)
          }
        >
          <div
            style={{
              width: "360px",
              padding: "24px",
              border:
                "1px solid rgba(0, 210, 255, 0.55)",
              borderRadius: "18px",
              background:
                "rgba(3, 20, 32, 0.97)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.55)",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "1.8px",
                color: "#6f9db0",
                marginBottom: "8px",
              }}
            >
              DATASET UPLOAD
            </div>

            <h3
              style={{
                margin:
                  "0 0 20px",
                color: "#ffffff",
                fontSize: "20px",
              }}
            >
              Select Instrument
            </h3>

            <div
              style={{
                display: "grid",
                gap: "10px",
              }}
            >
              {INSTRUMENT_TYPES.map(
                (instrument) => {
                  const active =
                    uploadType ===
                    instrument.id;

                  return (
                    <button
                      key={
                        instrument.id
                      }
                      type="button"
                      onClick={() =>
                        handleInstrumentSelect(
                          instrument.id
                        )
                      }
                      style={{
                        width: "100%",
                        padding:
                          "15px 16px",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: "12px",
                        border:
                          active
                            ? "1px solid rgba(0, 210, 255, 0.75)"
                            : "1px solid rgba(0, 210, 255, 0.35)",
                        borderRadius:
                          "10px",
                        background:
                          active
                            ? "rgba(0, 110, 160, 0.38)"
                            : "rgba(0, 80, 120, 0.28)",
                        color:
                          "#ffffff",
                        cursor:
                          "pointer",
                        textAlign:
                          "left",
                      }}
                    >
                      <span
                        style={{
                          color:
                            instrument.id ===
                            "argo"
                              ? "#19d9ff"
                              : instrument.id ===
                                "glider"
                              ? "#b45cff"
                              : "#19d9ff",
                          fontSize:
                            "20px",
                          width:
                            "22px",
                          textAlign:
                            "center",
                        }}
                      >
                        {
                          instrument.symbol
                        }
                      </span>

                      <span>
                        <strong>
                          {
                            instrument.label
                          }
                        </strong>

                        <small
                          style={{
                            display:
                              "block",
                            marginTop:
                              "3px",
                            color:
                              "#79a6b8",
                          }}
                        >
                          {instrument.label}{" "}
                          NetCDF / CSV
                        </small>
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowTypeSelector(
                  false
                )
              }
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "10px",
                border: "none",
                background:
                  "transparent",
                color: "#6f9db0",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* =================================================
          UPLOAD STATUS
      ================================================= */}

      {datasetName && (
        <div className="upload-status">
          <span className="upload-status-dot" />

          <span>
            {datasetName}
          </span>
        </div>
      )}

      {uploadMessage && (
        <div className="upload-message">
          {uploadMessage}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   VARIABLES PANEL
========================================================= */

function VariablePanel({
  variable,
  setVariable,
  onDatasetLoaded,
  datasetName,
  uploadMessage,
  uploading,
  instrumentType,
  setInstrumentType,
}) {
  return (
    <aside className="variables-panel">
      <div className="variables-title">
        VARIABLES
      </div>

      <div className="variables-list">
        {VARIABLES.map(
          (item) => {
            const active =
              variable ===
              item.id;

            return (
              <button
                key={item.id}
                className={
                  active
                    ? "variable-item active"
                    : "variable-item"
                }
                onClick={() =>
                  setVariable(
                    item.id
                  )
                }
              >
                <span
                  className="variable-icon"
                  style={{
                    color:
                      item.color,

                    borderColor:
                      active
                        ? item.color
                        : undefined,
                  }}
                >
                  {item.short}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            );
          }
        )}
      </div>

      <UploadDataset
        onDatasetLoaded={
          onDatasetLoaded
        }
        datasetName={
          datasetName
        }
        uploadMessage={
          uploadMessage
        }
        uploading={
          uploading
        }
        instrumentType={
          instrumentType
        }
        setInstrumentType={
          setInstrumentType
        }
      />
    </aside>
  );
}

/* =========================================================
   COLOR SCALE
========================================================= */

function ColorScale({
  variable,
}) {
  let title =
    "TEMPERATURE";

  let top = "32";
  let middle = "15.0";
  let bottom = "-2";
  let unit = "°C";

  if (
    variable ===
    "salinity"
  ) {
    title = "SALINITY";
    top = "38";
    middle = "35";
    bottom = "32";
    unit = "PSU";
  }

  if (
    variable ===
    "currents"
  ) {
    title = "CURRENT";
    top = "2.0";
    middle = "1.0";
    bottom = "0";
    unit = "m/s";
  }

  if (
    variable ===
    "chlorophyll"
  ) {
    title =
      "CHLOROPHYLL";
    top = "5";
    middle = "1";
    bottom = "0";
    unit = "mg/m³";
  }

  if (
    variable ===
    "oxygen"
  ) {
    title = "OXYGEN";
    top = "10";
    middle = "5";
    bottom = "0";
    unit = "mg/L";
  }

  return (
    <div className="color-scale">
      <div className="scale-title">
        {title}
      </div>

      <div className="scale-content">
        <div className="gradient-scale" />

        <div className="scale-values">
          <span>
            {top}
          </span>

          <span>
            {middle}
          </span>

          <span>
            {bottom}
          </span>
        </div>
      </div>

      <div className="scale-unit">
        {unit}
      </div>
    </div>
  );
}

/* =========================================================
   INSTRUMENT SELECTOR
========================================================= */

function InstrumentSelector({
  instrumentType,
  setInstrumentType,
}) {
  return (
    <div className="instrument-selector">
      <div className="instrument-title">
        INSTRUMENTS
      </div>

      {INSTRUMENT_TYPES.map(
        (instrument) => {
          const active =
            instrumentType ===
            instrument.id;

          return (
            <button
              key={
                instrument.id
              }
              className={
                active
                  ? "instrument-item active"
                  : "instrument-item"
              }
              onClick={() =>
                setInstrumentType(
                  instrument.id
                )
              }
            >
              <span
                className={
                  active
                    ? "instrument-radio active"
                    : "instrument-radio"
                }
              />

              <span className="instrument-symbol">
                {
                  instrument.symbol
                }
              </span>

              <span>
                {
                  instrument.label
                }
              </span>
            </button>
          );
        }
      )}
    </div>
  );
}

/* =========================================================
   SELECTED INSTRUMENT CARD
========================================================= */

function SelectedInstrumentCard({
  instrument,
  onClose,
  onOpenAnalysis,
}) {
  if (!instrument) {
    return null;
  }

  return (
    <div className="selected-instrument-card">
      <button
        className="close-instrument"
        onClick={
          onClose
        }
      >
        ×
      </button>

      <div className="instrument-card-type">
        {instrument.type}
      </div>

      <h2>
        {instrument.id}
      </h2>

      <div className="instrument-card-grid">
        <div>
          <span>
            LATITUDE
          </span>

          <strong>
            {Number(
              instrument.latitude
            ).toFixed(2)}
            °
          </strong>
        </div>

        <div>
          <span>
            LONGITUDE
          </span>

          <strong>
            {Number(
              instrument.longitude
            ).toFixed(2)}
            °
          </strong>
        </div>

        <div>
          <span>
            DEPTH
          </span>

          <strong>
            {numberOrFallback(
              instrument.depth
            )}{" "}
            m
          </strong>
        </div>

        <div>
          <span>
            STATUS
          </span>

          <strong className="status-active">
            {instrument.status ||
              "Active"}
          </strong>
        </div>

        <div>
          <span>
            TEMPERATURE
          </span>

          <strong>
            {numberOrFallback(
              instrument.temperature
            ).toFixed(2)}{" "}
            °C
          </strong>
        </div>

        <div>
          <span>
            SALINITY
          </span>

          <strong>
            {numberOrFallback(
              instrument.salinity
            ).toFixed(2)}{" "}
            PSU
          </strong>
        </div>

        <div>
          <span>
            PROFILE LEVELS
          </span>

          <strong>
            {instrument.profile
              ?.depth
              ?.length || 0}
          </strong>
        </div>
      </div>

      <button
        className="open-analysis-button"
        onClick={
          onOpenAnalysis
        }
      >
        <span>
          OPEN 3D ANALYSIS
        </span>

        <span>
          →
        </span>
      </button>
    </div>
  );
}

/* =========================================================
   SELECTED STATUS
========================================================= */

function SelectedStatus({
  instrumentType,
  instrumentCount,
  datasetLoaded,
}) {
  const selected =
    INSTRUMENT_TYPES.find(
      (item) =>
        item.id ===
        instrumentType
    );

  return (
    <div className="selected-status">
      <span className="status-label">
        {datasetLoaded
          ? "DATASET INSTRUMENT"
          : "NO DATASET"}
      </span>

      <div className="status-value">
        <span className="status-dot" />

        <span>
          {datasetLoaded
            ? selected?.label ||
              "Argo"
            : "Upload dataset"}
        </span>

        {instrumentCount >
          0 && (
          <small>
            {instrumentCount}{" "}
            markers
          </small>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   TIMELINE
========================================================= */

const MONTHS = [
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
];

const TIMELINE_DATES = [
  "09/01/2025",
  "10/01/2025",
  "11/01/2025",
  "12/01/2025",
  "01/01/2026",
  "02/01/2026",
  "03/01/2026",
  "04/01/2026",
  "05/01/2026",
  "06/01/2026",
  "07/26/2026",
  "08/01/2026",
];

function Timeline({
  monthIndex,
  setMonthIndex,
  playing,
  setPlaying,
}) {
  const previous =
    () => {
      setMonthIndex(
        (value) =>
          value === 0
            ? MONTHS.length - 1
            : value - 1
      );
    };

  const next =
    () => {
      setMonthIndex(
        (value) =>
          value ===
          MONTHS.length - 1
            ? 0
            : value + 1
      );
    };

  const progress =
    (monthIndex /
      (MONTHS.length -
        1)) *
    100;

  return (
    <div className="timeline">
      <div className="timeline-controls">
        <button
          onClick={
            previous
          }
          className="timeline-arrow"
        >
          ‹
        </button>

        <button
          onClick={() =>
            setPlaying(
              (value) =>
                !value
            )
          }
          className="timeline-play"
        >
          {playing
            ? "Ⅱ"
            : "▶"}
        </button>

        <button
          onClick={
            next
          }
          className="timeline-arrow"
        >
          ›
        </button>
      </div>

      <div className="timeline-main">
        <div className="timeline-months">
          {MONTHS.map(
            (
              month,
              index
            ) => (
              <button
                key={month}
                className={
                  monthIndex ===
                  index
                    ? "timeline-month active"
                    : "timeline-month"
                }
                onClick={() =>
                  setMonthIndex(
                    index
                  )
                }
              >
                {month}
              </button>
            )
          )}
        </div>

        <div className="timeline-track">
          <div className="timeline-line" />

          <div
            className="timeline-progress"
            style={{
              width: `${progress}%`,
            }}
          />

          <div
            className="timeline-knob"
            style={{
              left: `${progress}%`,
            }}
          />
        </div>

        <div className="timeline-date">
          {
            TIMELINE_DATES[
              monthIndex
            ]
          }
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   CREDITS
========================================================= */

function CreditsButton() {
  const [
    open,
    setOpen,
  ] = useState(false);

  return (
    <>
      <button
        className="credits-button"
        onClick={() =>
          setOpen(
            (value) =>
              !value
          )
        }
      >
        ◉ &nbsp; Credits
      </button>

      {open && (
        <div className="credits-popup">
          <strong>
            OCEAN DATA VISUALIZATION SYSTEM
          </strong>

          <span>
            OceanVista
          </span>

          <span>
            Argo / Ocean Model Visualization
          </span>
        </div>
      )}
    </>
  );
}

/* =========================================================
   MAIN EXPLORER
========================================================= */

export default function Explorer() {
  const navigate =
    useNavigate();

  const [
    variable,
    setVariable,
  ] = useState(
    "temperature"
  );

  const [
    instrumentType,
    setInstrumentType,
  ] = useState(
    "argo"
  );

  const [
    selectedInstrument,
    setSelectedInstrument,
  ] = useState(
    null
  );

  const [
    monthIndex,
    setMonthIndex,
  ] = useState(
    10
  );

  const [
    playing,
    setPlaying,
  ] = useState(
    false
  );

  const [
    quality,
    setQuality,
  ] = useState(
    "HD"
  );

  const [
    dimension,
    setDimension,
  ] = useState(
    "3D"
  );

  const [
    search,
    setSearch,
  ] = useState(
    ""
  );

  /* =====================================================
     UPLOADED DATA
  ===================================================== */

  const [
    uploadedInstruments,
    setUploadedInstruments,
  ] = useState(
    []
  );

  const [
    datasetId,
    setDatasetId,
  ] = useState(
    ""
  );

  const [
    datasetName,
    setDatasetName,
  ] = useState(
    ""
  );

  const [
    uploadMessage,
    setUploadMessage,
  ] = useState(
    ""
  );

  const [
    uploading,
    setUploading,
  ] = useState(
    false
  );

  /* =====================================================
     TIMELINE PLAY
  ===================================================== */

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer =
      setInterval(() => {
        setMonthIndex(
          (value) =>
            value ===
            MONTHS.length - 1
              ? 0
              : value + 1
        );
      }, 1200);

    return () =>
      clearInterval(
        timer
      );
  }, [playing]);

  /* =====================================================
     UPLOAD DATASET
     API UNCHANGED
  ===================================================== */

  const handleDatasetLoaded =
    async (
      file,
      selectedUploadType
    ) => {
      if (!file) {
        return;
      }

      setUploadMessage("");

      setUploading(true);

      try {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase();

        const allowed = [
          "nc",
          "cdf",
          "csv",
          "txt",
        ];

        if (
          !allowed.includes(
            extension
          )
        ) {
          throw new Error(
            "Unsupported file type. Use .nc, .cdf, .csv or .txt."
          );
        }

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        /* =================================================
           EXISTING API
           DO NOT CHANGE
        ================================================= */

        const response =
          await fetch(
            `${API_BASE_URL}/api/datasets/upload`,
            {
              method:
                "POST",
              body: formData,
            }
          );

        let data = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data?.detail ||
              `Upload failed with status ${response.status}`
          );
        }

        /* =================================================
           NORMALIZE BACKEND INSTRUMENTS
        ================================================= */

        const backendInstruments =
          Array.isArray(
            data?.instruments
          )
            ? data.instruments.map(
                normalizeBackendInstrument
              )
            : [];

        const dataset =
          data?.dataset ||
          {};

        /* =================================================
           SAVE DATASET
        ================================================= */

        setDatasetId(
          dataset.id ||
            ""
        );

        setDatasetName(
          dataset.filename ||
            file.name
        );

        /* =================================================
           SAVE INSTRUMENTS
        ================================================= */

        setUploadedInstruments(
          backendInstruments
        );

        setSelectedInstrument(
          null
        );

        setSearch("");

        /* =================================================
           NO INSTRUMENTS
        ================================================= */

        if (
          backendInstruments.length ===
          0
        ) {
          setUploadMessage(
            "Dataset uploaded, but no instrument records with latitude/longitude were found."
          );

          return;
        }

        /* =================================================
           IMPORTANT FIX:
           KEEP THE USER'S SELECTED UPLOAD TYPE

           Example:
           Moorings selected
               ↓
           selectedUploadType = "moorings"
               ↓
           instrumentType = "moorings"

           API IS NOT CHANGED.
        ================================================= */

        const selectedTypeId =
          getInstrumentTypeId(
            selectedUploadType ||
              instrumentType
          );

        setInstrumentType(
          selectedTypeId
        );

        const firstType =
          backendInstruments[0]
            ?.type ||
          selectedTypeId;

        setUploadMessage(
          `${backendInstruments.length} ${firstType} instrument marker(s) loaded from backend.`
        );

        console.log(
          "OceanVista uploaded dataset:",
          data
        );
      } catch (error) {
        console.error(
          "Dataset upload error:",
          error
        );

        setUploadMessage(
          error?.message ||
            "Could not upload this dataset."
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /* =====================================================
     ACTIVE DATA

     ONLY UPLOADED DATASET.

     NO DEMO DATA.
  ===================================================== */

  const allInstruments =
    uploadedInstruments;

  const datasetLoaded =
    uploadedInstruments.length >
    0;

  /* =====================================================
     FILTER BY INSTRUMENT TYPE
  ===================================================== */

  const visibleInstruments =
    useMemo(() => {
      const selectedType =
        instrumentType ===
        "moorings"
          ? "MOORINGS"
          : instrumentType ===
            "radar"
          ? "RADAR"
          : instrumentType.toUpperCase();

      return allInstruments.filter(
        (instrument) =>
          String(
            instrument.type
          ).toUpperCase() ===
          selectedType
      );
    }, [
      allInstruments,
      instrumentType,
    ]);

  /* =====================================================
     SEARCH
  ===================================================== */

  const searchResults =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return allInstruments.filter(
        (instrument) =>
          String(
            instrument.id
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          String(
            instrument.type
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          String(
            instrument.latitude
          ).includes(
            query
          ) ||
          String(
            instrument.longitude
          ).includes(
            query
          )
      );
    }, [
      search,
      allInstruments,
    ]);

  /* =====================================================
     SELECT INSTRUMENT
  ===================================================== */

  const handleSelectInstrument =
    async (
      instrument
    ) => {
      if (!instrument) {
        return;
      }

      /* Immediately select marker */

      setSelectedInstrument(
        instrument
      );

      setInstrumentType(
        getInstrumentTypeId(
          instrument.type
        )
      );

      /* =================================================
         LOAD FULL PROFILE FROM BACKEND

         API UNCHANGED
      ================================================= */

      if (
        instrument.source !==
          "backend" ||
        !datasetId
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/instruments/${encodeURIComponent(
              instrument.id
            )}/profile`
          );

        if (
          !response.ok
        ) {
          return;
        }

        const data =
          await response.json();

        if (
          !data?.profile
        ) {
          return;
        }

        setSelectedInstrument(
          (current) => {
            if (
              !current ||
              current.id !==
                instrument.id
            ) {
              return current;
            }

            const variables =
              data
                .profile
                .variables ||
              {};

            return {
              ...current,

              profile: {
                depth:
                  data
                    .profile
                    .depth ||
                  [],

                variables,
              },

              temperature:
                Array.isArray(
                  variables.temperature
                )
                  ? numberOrFallback(
                      variables.temperature[0],
                      current.temperature
                    )
                  : current.temperature,

              salinity:
                Array.isArray(
                  variables.salinity
                )
                  ? numberOrFallback(
                      variables.salinity[0],
                      current.salinity
                    )
                  : current.salinity,
            };
          }
        );
      } catch (error) {
        console.warn(
          "Could not load instrument profile:",
          error
        );
      }
    };

  /* =====================================================
     OPEN ANALYSIS
  ===================================================== */

  const handleOpenAnalysis =
    () => {
      if (
        !selectedInstrument
      ) {
        return;
      }

      navigate(
        `/analysis/${encodeURIComponent(
          selectedInstrument.id
        )}`,
        {
          state: {
            instrument:
              selectedInstrument,

            datasetId,

            datasetName,
          },
        }
      );
    };

  /* =====================================================
     CLOSE INSTRUMENT
  ===================================================== */

  const closeInstrument =
    () => {
      setSelectedInstrument(
        null
      );
    };

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <main className="explorer-page">

      {/* =================================================
          3D OCEAN
      ================================================= */}

      <div className="explorer-canvas">
        <Canvas
          dpr={
            quality ===
            "HD"
              ? [1, 2]
              : [0.75, 1]
          }
          camera={{
            position: [
              0,
              0.25,
              7.2,
            ],
            fov: 45,
          }}
          gl={{
            antialias:
              quality ===
              "HD",

            alpha: false,

            powerPreference:
              "high-performance",
          }}
        >
          <Suspense
            fallback={null}
          >
            <GlobeScene
              variable={
                variable
              }
              instruments={
                visibleInstruments
              }
              selectedInstrument={
                selectedInstrument
              }
              onSelectInstrument={
                handleSelectInstrument
              }
            />
          </Suspense>
        </Canvas>
      </div>

      {/* =================================================
          SEARCH
      ================================================= */}

      <SearchBar
        search={search}
        setSearch={
          setSearch
        }
      />

      {/* =================================================
          SEARCH RESULTS
      ================================================= */}

      {searchResults.length >
        0 && (
        <div className="search-results">
          {searchResults.map(
            (
              instrument
            ) => (
              <button
                key={
                  instrument.id
                }
                onClick={() => {
                  handleSelectInstrument(
                    instrument
                  );

                  setSearch(
                    ""
                  );
                }}
              >
                <span>
                  {
                    instrument.id
                  }
                </span>

                <small>
                  {Number(
                    instrument.latitude
                  ).toFixed(
                    2
                  )}
                  °,{" "}
                  {Number(
                    instrument.longitude
                  ).toFixed(
                    2
                  )}
                  °
                </small>
              </button>
            )
          )}
        </div>
      )}

      {/* =================================================
          BRAND
      ================================================= */}

      <BrandArea />

      {/* =================================================
          VARIABLES + UPLOAD
      ================================================= */}

      <VariablePanel
        variable={
          variable
        }
        setVariable={
          setVariable
        }
        onDatasetLoaded={
          handleDatasetLoaded
        }
        datasetName={
          datasetName
        }
        uploadMessage={
          uploadMessage
        }
        uploading={
          uploading
        }
        instrumentType={
          instrumentType
        }
        setInstrumentType={
          setInstrumentType
        }
      />

      {/* =================================================
          COLOR SCALE
      ================================================= */}

      <ColorScale
        variable={
          variable
        }
      />

      {/* =================================================
          INSTRUMENT SELECTOR
      ================================================= */}

      <InstrumentSelector
        instrumentType={
          instrumentType
        }
        setInstrumentType={
          setInstrumentType
        }
      />

      {/* =================================================
          SELECTED INSTRUMENT CARD
      ================================================= */}

      <SelectedInstrumentCard
        instrument={
          selectedInstrument
        }
        onClose={
          closeInstrument
        }
        onOpenAnalysis={
          handleOpenAnalysis
        }
      />

      {/* =================================================
          DATASET STATUS
      ================================================= */}

      <SelectedStatus
        instrumentType={
          instrumentType
        }
        instrumentCount={
          visibleInstruments.length
        }
        datasetLoaded={
          datasetLoaded
        }
      />

      {/* =================================================
          TIMELINE
      ================================================= */}

      <Timeline
        monthIndex={
          monthIndex
        }
        setMonthIndex={
          setMonthIndex
        }
        playing={
          playing
        }
        setPlaying={
          setPlaying
        }
      />

      {/* =================================================
          CREDITS
      ================================================= */}

      <CreditsButton />

      {/* =================================================
          TITLE
      ================================================= */}

      <div className="explorer-system-title">
        OCEAN DATA VISUALIZATION SYSTEM
      </div>

      {/* =================================================
          ACTIVE VARIABLE
      ================================================= */}

      <div className="active-variable-status">
        <span className="active-variable-dot" />

        <span>
          {
            VARIABLES.find(
              (item) =>
                item.id ===
                variable
            )?.label
          }
        </span>
      </div>
    </main>
  );
}