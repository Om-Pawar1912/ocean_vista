import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useParams } from "react-router-dom";

import {
  Canvas,
  useFrame,
} from "@react-three/fiber";

import {
  OrbitControls,
  PerspectiveCamera,
  Stars,
  Text,
} from "@react-three/drei";

import * as THREE from "three";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import "../styles/analysis.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://ocean-vista-1.onrender.com";

/* =========================================================
   CONSTANTS
========================================================= */

const DEPTH_LEVELS = [
  0,
  50,
  100,
  200,
  500,
];

const VARIABLES = [
  {
    key: "temperature",
    label: "Temperature",
    unit: "°C",
    icon: "♨",
  },
  {
    key: "salinity",
    label: "Salinity",
    unit: "PSU",
    icon: "♒",
  },
  {
    key: "current",
    label: "Current (U/V)",
    unit: "",
    icon: "↝",
  },
  {
    key: "chlorophyll",
    label: "Chlorophyll",
    unit: "mg/m³",
    icon: "♧",
  },
  {
    key: "oxygen",
    label: "Dissolved Oxygen",
    unit: "µmol/kg",
    icon: "♢",
  },
  {
    key: "density",
    label: "Density",
    unit: "kg/m³",
    icon: "◈",
  },
  {
    key: "depth",
    label: "Depth",
    unit: "m",
    icon: "⇅",
  },
  {
    key: "nutrients",
    label: "Nutrients",
    unit: "µmol/L",
    icon: "✦",
  },
  {
    key: "nitrates",
    label: "Nitrates",
    unit: "µmol/L",
    icon: "♧",
  },
  {
    key: "bathymetry",
    label: "Bathymetry",
    unit: "m",
    icon: "⌁",
  },
  {
    key: "ssh",
    label: "Sea Surface Height",
    unit: "m",
    icon: "⌁",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatNumber(value, digits = 2) {
  const number = safeNumber(value);

  if (number === null) {
    return "--";
  }

  return number.toFixed(digits);
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function getValueFromObject(
  object,
  names
) {
  if (
    !object ||
    typeof object !== "object"
  ) {
    return null;
  }

  for (const name of names) {
    if (
      object[name] !== undefined &&
      object[name] !== null
    ) {
      return object[name];
    }
  }

  return null;
}

function normalizeProfileResponse(data) {
  if (!data) {
    return {
      instrument: null,
      profile: null,
      dataset: null,
    };
  }

  const instrument =
    data.instrument ||
    data.instruments?.[0] ||
    data;

  const profile =
    data.profile ||
    instrument?.profile ||
    data.data?.profile ||
    null;

  const dataset =
    data.dataset ||
    instrument?.dataset ||
    data.data?.dataset ||
    null;

  return {
    instrument,
    profile,
    dataset,
  };
}

function extractDepths(profile) {
  if (!profile) {
    return [];
  }

  const depths =
    profile.depth ||
    profile.depths ||
    profile.depth_values ||
    profile.pressure ||
    [];

  if (!Array.isArray(depths)) {
    return [];
  }

  return depths
    .map((value) => safeNumber(value))
    .filter(
      (value) => value !== null
    );
}

function extractVariableValues(
  profile,
  variable
) {
  if (!profile) {
    return [];
  }

  const variables =
    profile.variables || {};

  const aliases = {
    temperature: [
      "temperature",
      "temp",
      "TEMP",
      "thetao",
    ],

    salinity: [
      "salinity",
      "salt",
      "PSAL",
      "so",
    ],

    current: [
      "current",
      "current_u",
      "u",
      "uo",
    ],

    current_u: [
      "current_u",
      "u",
      "uo",
    ],

    current_v: [
      "current_v",
      "v",
      "vo",
    ],

    chlorophyll: [
      "chlorophyll",
      "chl",
      "CHLA",
    ],

    oxygen: [
      "oxygen",
      "dissolved_oxygen",
      "DOXY",
    ],

    density: [
      "density",
      "rho",
      "DENSITY",
    ],

    depth: [
      "depth",
      "DEPTH",
    ],

    nutrients: [
      "nutrients",
    ],

    nitrates: [
      "nitrates",
      "nitrate",
      "NO3",
    ],

    bathymetry: [
      "bathymetry",
    ],

    ssh: [
      "ssh",
      "sea_surface_height",
    ],
  };

  const possibleNames =
    aliases[variable] || [
      variable,
    ];

  for (const name of possibleNames) {
    if (
      Array.isArray(
        variables[name]
      )
    ) {
      return variables[name].map(
        (value) =>
          safeNumber(value)
      );
    }
  }

  for (const name of possibleNames) {
    if (
      Array.isArray(
        profile[name]
      )
    ) {
      return profile[name].map(
        (value) =>
          safeNumber(value)
      );
    }
  }

  return [];
}

function calculateStats(values) {
  const valid = values.filter(
    (value) =>
      safeNumber(value) !== null
  );

  if (!valid.length) {
    return {
      min: null,
      max: null,
      range: null,
    };
  }

  const numbers =
    valid.map(Number);

  const min = Math.min(
    ...numbers
  );

  const max = Math.max(
    ...numbers
  );

  return {
    min,
    max,
    range: max - min,
  };
}

function getNearestIndex(
  depths,
  targetDepth
) {
  if (!depths.length) {
    return -1;
  }

  let nearestIndex = 0;

  let nearestDistance =
    Math.abs(
      depths[0] -
      targetDepth
    );

  for (
    let i = 1;
    i < depths.length;
    i += 1
  ) {
    const distance =
      Math.abs(
        depths[i] -
        targetDepth
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance =
        distance;

      nearestIndex = i;
    }
  }

  return nearestIndex;
}

function getVariableDefinition(
  variable
) {
  return (
    VARIABLES.find(
      (item) =>
        item.key === variable
    ) ||
    VARIABLES[0]
  );
}

function getInstrumentType(
  instrument,
  instrumentId
) {
  const rawType =
    getValueFromObject(
      instrument,
      [
        "instrument_type",
        "instrumentType",
        "platform_type",
        "platformType",
        "type",
        "source",
        "instrument",
      ]
    );

  if (rawType) {
    const type =
      String(
        rawType
      ).toLowerCase();

    if (
      type.includes("glider")
    ) {
      return "glider";
    }

    if (
      type.includes("argo") ||
      type.includes("float")
    ) {
      return "argo";
    }
  }

  const id =
    String(
      instrumentId || ""
    ).toLowerCase();

  if (
    id.startsWith("sg") ||
    id.includes("glider")
  ) {
    return "glider";
  }

  return "argo";
}

/* =========================================================
   SCIENTIFIC COLOR SCALE
========================================================= */

function scientificColor(
  value,
  min,
  max
) {
  const numericValue =
    safeNumber(value);

  const numericMin =
    safeNumber(min);

  const numericMax =
    safeNumber(max);

  if (
    numericValue === null ||
    numericMin === null ||
    numericMax === null
  ) {
    return "#0b8fff";
  }

  if (
    numericMax ===
    numericMin
  ) {
    return "#16c7ff";
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (numericValue -
        numericMin) /
        (numericMax -
          numericMin)
    )
  );

  const stops = [
    {
      p: 0,
      c: [30, 55, 210],
    },
    {
      p: 0.16,
      c: [0, 125, 255],
    },
    {
      p: 0.32,
      c: [0, 205, 255],
    },
    {
      p: 0.48,
      c: [20, 225, 150],
    },
    {
      p: 0.64,
      c: [220, 225, 40],
    },
    {
      p: 0.8,
      c: [255, 155, 0],
    },
    {
      p: 1,
      c: [245, 35, 35],
    },
  ];

  let left = stops[0];

  let right =
    stops[
      stops.length - 1
    ];

  for (
    let i = 0;
    i <
    stops.length - 1;
    i += 1
  ) {
    if (
      t >= stops[i].p &&
      t <= stops[i + 1].p
    ) {
      left = stops[i];
      right =
        stops[i + 1];

      break;
    }
  }

  const localT =
    (t - left.p) /
    Math.max(
      0.000001,
      right.p - left.p
    );

  const r = Math.round(
    left.c[0] +
      (right.c[0] -
        left.c[0]) *
        localT
  );

  const g = Math.round(
    left.c[1] +
      (right.c[1] -
        left.c[1]) *
        localT
  );

  const b = Math.round(
    left.c[2] +
      (right.c[2] -
        left.c[2]) *
        localT
  );

  return `rgb(${r}, ${g}, ${b})`;
}

/* =========================================================
   DEPTH -> Y POSITION
========================================================= */

function depthToY(
  depth,
  maxDepth
) {
  const topY = 1.35;
  const bottomY = -1.35;

  const ratio = Math.max(
    0,
    Math.min(
      1,
      depth /
        Math.max(
          maxDepth,
          1
        )
    )
  );

  return (
    topY -
    ratio *
      (topY - bottomY)
  );
}

/* =========================================================
   ARGO FLOAT
========================================================= */

function ArgoFloat({
  selected = false,
  onSelect,
}) {
  return (
    <group
      scale={
        selected
          ? 1.3
          : 1
      }
      onClick={(event) => {
        event.stopPropagation();

        if (onSelect) {
          onSelect();
        }
      }}
    >
      <mesh>
        <cylinderGeometry
          args={[
            0.055,
            0.055,
            0.34,
            18,
          ]}
        />

        <meshBasicMaterial
          color="#ffd21f"
        />
      </mesh>

      <mesh
        position={[
          0,
          -0.22,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.022,
            0.022,
            0.14,
            12,
          ]}
        />

        <meshBasicMaterial
          color="#eeeeee"
        />
      </mesh>

      <mesh
        position={[
          0,
          0.21,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.042,
            16,
            16,
          ]}
        />

        <meshBasicMaterial
          color="#101010"
        />
      </mesh>

      {selected && (
        <>
          <mesh>
            <sphereGeometry
              args={[
                0.13,
                20,
                20,
              ]}
            />

            <meshBasicMaterial
              color="#ffe900"
              transparent
              opacity={0.16}
              depthWrite={false}
            />
          </mesh>

          <mesh
            rotation={[
              -Math.PI / 2,
              0,
              0,
            ]}
          >
            <ringGeometry
              args={[
                0.12,
                0.15,
                32,
              ]}
            />

            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.9}
              side={
                THREE.DoubleSide
              }
            />
          </mesh>
        </>
      )}
    </group>
  );
}

/* =========================================================
   GLIDER
========================================================= */

function Glider({
  selected = false,
}) {
  return (
    <group
      scale={
        selected
          ? 1.2
          : 1
      }
    >
      <mesh
        rotation={[
          0,
          0,
          Math.PI / 2,
        ]}
      >
        <capsuleGeometry
          args={[
            0.055,
            0.25,
            8,
            16,
          ]}
        />

        <meshBasicMaterial
          color="#e14cff"
        />
      </mesh>

      <mesh
        position={[
          0.16,
          0,
          0,
        ]}
      >
        <coneGeometry
          args={[
            0.08,
            0.16,
            12,
          ]}
        />

        <meshBasicMaterial
          color="#a932ff"
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   OCEAN CURRENT PARTICLES
========================================================= */

function OceanParticles({
  count = 240,
}) {
  const ref =
    useRef(null);

  const particles =
    useMemo(() => {
      return Array.from(
        {
          length: count,
        },
        (_, index) => ({
          x:
            -1.9 +
            Math.random() *
              3.8,

          y:
            -1.25 +
            Math.random() *
              2.45,

          z:
            -1.4 +
            Math.random() *
              2.8,

          speed:
            0.0015 +
            Math.random() *
              0.003,

          phase:
            Math.random() *
            Math.PI *
            2,

          size:
            0.008 +
            Math.random() *
              0.018,

          index,
        })
      );
    }, [count]);

  useFrame(
    (state) => {
      if (!ref.current) {
        return;
      }

      const positions =
        ref.current.geometry
          .attributes.position
          .array;

      particles.forEach(
        (particle, index) => {
          const i =
            index * 3;

          let x =
            particle.x +
            state.clock.elapsedTime *
              particle.speed;

          if (x > 1.95) {
            x = -1.95;
          }

          positions[i] =
            x;

          positions[i + 1] =
            particle.y +
            Math.sin(
              state.clock.elapsedTime *
                0.5 +
                particle.phase
            ) *
              0.025;

          positions[i + 2] =
            particle.z;
        }
      );

      ref.current.geometry.attributes.position.needsUpdate =
        true;
    }
  );

  const positions =
    useMemo(() => {
      const array =
        new Float32Array(
          count * 3
        );

      particles.forEach(
        (particle, index) => {
          array[index * 3] =
            particle.x;

          array[index * 3 + 1] =
            particle.y;

          array[index * 3 + 2] =
            particle.z;
        }
      );

      return array;
    }, [particles, count]);

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>

      <pointsMaterial
        color="#50d9ff"
        size={0.018}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  );
}

/* =========================================================
   OCEAN FLOOR
========================================================= */

function OceanFloor({
  visible = true,
}) {
  if (!visible) {
    return null;
  }

  return (
    <group>
      <mesh
        position={[
          0,
          -1.42,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <planeGeometry
          args={[
            4.0,
            3.0,
            35,
            35,
          ]}
        />

        <meshBasicMaterial
          color="#0b3e59"
          transparent
          opacity={0.72}
          side={
            THREE.DoubleSide
          }
        />
      </mesh>

      <mesh
        position={[
          0,
          -1.415,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <planeGeometry
          args={[
            4,
            3,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color="#155e78"
          wireframe
          transparent
          opacity={0.38}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   OCEAN WIREFRAME BOX
========================================================= */

function OceanWireframe() {
  const edges =
    useMemo(() => {
      const geometry =
        new THREE.BoxGeometry(
          4.0,
          2.8,
          3.0
        );

      return new THREE.EdgesGeometry(
        geometry
      );
    }, []);

  return (
    <lineSegments
      geometry={edges}
    >
      <lineBasicMaterial
        color="#08a9e8"
        transparent
        opacity={0.72}
      />
    </lineSegments>
  );
}

/* =========================================================
   OCEAN GLASS VOLUME
========================================================= */

function OceanGlass({
  opacity = 75,
}) {
  return (
    <mesh>
      <boxGeometry
        args={[
          4,
          2.8,
          3,
        ]}
      />

      <meshBasicMaterial
        color="#006eb5"
        transparent
        opacity={
          0.045 *
          (opacity / 100)
        }
        side={
          THREE.DoubleSide
        }
        depthWrite={false}
      />
    </mesh>
  );
}

/* =========================================================
   SURFACE TEMPERATURE FIELD
========================================================= */

function OceanSurface({
  values,
  stats,
  visible = true,
  opacity = 75,
}) {
  if (!visible) {
    return null;
  }

  const segments = 12;

  const cells =
    useMemo(() => {
      const result = [];

      for (
        let x = 0;
        x < segments;
        x++
      ) {
        for (
          let z = 0;
          z < segments;
          z++
        ) {
          const normalized =
            (x + z) /
            (segments * 2);

          const sourceIndex =
            Math.floor(
              normalized *
                Math.max(
                  values.length,
                  1
                )
            );

          const value =
            values[
              sourceIndex
            ] ??
            stats?.min ??
            0;

          result.push({
            x,
            z,
            value,
          });
        }
      }

      return result;
    }, [
      values,
      stats,
    ]);

  return (
    <group
      position={[
        0,
        1.405,
        0,
      ]}
    >
      {cells.map(
        (cell) => {
          const cellSize =
            4 / segments;

          const cellDepth =
            3 / segments;

          const x =
            -2 +
            cellSize / 2 +
            cell.x *
              cellSize;

          const z =
            -1.5 +
            cellDepth / 2 +
            cell.z *
              cellDepth;

          const color =
            scientificColor(
              cell.value,
              stats?.min,
              stats?.max
            );

          return (
            <mesh
              key={`${cell.x}-${cell.z}`}
              position={[
                x,
                0,
                z,
              ]}
              rotation={[
                -Math.PI / 2,
                0,
                0,
              ]}
            >
              <planeGeometry
                args={[
                  cellSize * 1.03,
                  cellDepth * 1.03,
                ]}
              />

              <meshBasicMaterial
                color={color}
                transparent
                opacity={
                  0.68 *
                  (opacity / 100)
                }
                side={
                  THREE.DoubleSide
                }
              />
            </mesh>
          );
        }
      )}

      <gridHelper
        args={[
          4,
          18,
          "#20bce8",
          "#087ea9",
        ]}
        rotation={[
          0,
          0,
          0,
        ]}
        position={[
          0,
          0.002,
          0,
        ]}
      />
    </group>
  );
}

/* =========================================================
   COLORED DEPTH LAYERS
========================================================= */

function VariableColorLayers({
  depths = [],
  values = [],
  min = null,
  max = null,
  maxDepth = 2000,
  opacity = 75,
}) {
  if (
    !depths.length ||
    !values.length ||
    min === null ||
    max === null
  ) {
    return null;
  }

  const layerCount =
    Math.min(
      depths.length,
      values.length
    );

  return (
    <group>
      {Array.from(
        {
          length:
            layerCount,
        },
        (_, index) => {
          const depth =
            safeNumber(
              depths[index]
            );

          const value =
            safeNumber(
              values[index]
            );

          if (
            depth === null ||
            value === null
          ) {
            return null;
          }

          const y =
            depthToY(
              depth,
              maxDepth
            );

          const color =
            scientificColor(
              value,
              min,
              max
            );

          return (
            <mesh
              key={`layer-${index}-${depth}`}
              position={[
                0,
                y,
                0,
              ]}
              rotation={[
                -Math.PI / 2,
                0,
                0,
              ]}
            >
              <planeGeometry
                args={[
                  3.9,
                  2.9,
                  10,
                  10,
                ]}
              />

              <meshBasicMaterial
                color={color}
                transparent
                opacity={
                  0.075 *
                  (opacity / 100)
                }
                side={
                  THREE.DoubleSide
                }
                depthWrite={false}
              />
            </mesh>
          );
        }
      )}
    </group>
  );
}

/* =========================================================
   SELECTED DEPTH SLICE
========================================================= */

function OceanSlice({
  depth = 1000,
  depths = [],
  values = [],
  min = null,
  max = null,
  maxDepth = 2000,
  opacity = 75,
}) {
  const meshRef =
    useRef(null);

  const selectedIndex =
    useMemo(() => {
      if (
        !depths.length ||
        !values.length
      ) {
        return -1;
      }

      return getNearestIndex(
        depths,
        depth
      );
    }, [
      depths,
      values,
      depth,
    ]);

  const selectedValue =
    selectedIndex >= 0
      ? safeNumber(
          values[
            selectedIndex
          ]
        )
      : null;

  const sliceColor =
    scientificColor(
      selectedValue,
      min,
      max
    );

  const sliceY =
    depthToY(
      depth,
      maxDepth
    );

  useFrame(
    (state) => {
      if (!meshRef.current) {
        return;
      }

      meshRef.current.position.z =
        Math.sin(
          state.clock.elapsedTime *
            0.15
        ) *
        0.008;
    }
  );

  if (
    selectedValue === null
  ) {
    return null;
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[
          0,
          sliceY,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <planeGeometry
          args={[
            3.95,
            2.95,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color={sliceColor}
          transparent
          opacity={
            0.22 *
            (opacity / 100)
          }
          side={
            THREE.DoubleSide
          }
          depthWrite={false}
        />
      </mesh>

      <mesh
        position={[
          0,
          sliceY,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <planeGeometry
          args={[
            3.98,
            2.98,
          ]}
        />

        <meshBasicMaterial
          color="#ffffff"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   DEPTH AXIS
========================================================= */

function DepthAxis({
  maxDepth = 2000,
}) {
  const labels = [
    0,
    500,
    1000,
    1500,
    2000,
  ];

  return (
    <group
      position={[
        -2.25,
        0,
        0,
      ]}
    >
      <mesh>
        <cylinderGeometry
          args={[
            0.006,
            0.006,
            2.8,
            8,
          ]}
        />

        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.7}
        />
      </mesh>

      {labels.map(
        (depth) => {
          const y =
            depthToY(
              depth,
              Math.max(
                2000,
                maxDepth
              )
            );

          return (
            <group
              key={depth}
              position={[
                0,
                y,
                0,
              ]}
            >
              <mesh>
                <boxGeometry
                  args={[
                    0.12,
                    0.006,
                    0.006,
                  ]}
                />

                <meshBasicMaterial
                  color="#ffffff"
                />
              </mesh>

              <Text
                position={[
                  -0.18,
                  0,
                  0,
                ]}
                fontSize={0.11}
                color="#d7efff"
                anchorX="right"
                anchorY="middle"
              >
                {depth} m
              </Text>
            </group>
          );
        }
      )}
    </group>
  );
}

/* =========================================================
   LONGITUDE / LATITUDE LABELS
========================================================= */

function CoordinateLabels({
  longitude,
}) {
  const center =
    safeNumber(longitude) ?? 86;

  const labels = [
    center - 2,
    center,
    center + 2,
    center + 4,
  ];

  return (
    <group
      position={[
        0,
        1.65,
        0,
      ]}
    >
      {labels.map(
        (value, index) => {
          const x =
            -1.6 +
            index * 1.05;

          return (
            <Text
              key={index}
              position={[
                x,
                0,
                0,
              ]}
              fontSize={0.105}
              color="#ccecff"
              anchorX="center"
              anchorY="middle"
            >
              {Math.round(
                value
              )}
              °E
            </Text>
          );
        }
      )}
    </group>
  );
}

/* =========================================================
   ARGO VERTICAL TRACK
========================================================= */

function ArgoTrack({
  maxDepth = 2000,
}) {
  const points =
    useMemo(() => {
      return [
        new THREE.Vector3(
          0,
          1.34,
          0
        ),
        new THREE.Vector3(
          0,
          depthToY(
            Math.min(
              maxDepth,
              1800
            ),
            maxDepth
          ),
          0
        ),
      ];
    }, [maxDepth]);

  const geometry =
    useMemo(() => {
      return new THREE.BufferGeometry().setFromPoints(
        points
      );
    }, [points]);

  return (
    <group>
      <line geometry={geometry}>
        <lineBasicMaterial
          color="#ffe600"
          transparent
          opacity={0.9}
        />
      </line>

      <mesh
        position={[
          0,
          points[1].y,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.06,
            18,
            18,
          ]}
        />

        <meshBasicMaterial
          color="#ffffff"
        />
      </mesh>
    </group>
  );
}

/* =========================================================
   GLIDER TRAJECTORY
========================================================= */

function GliderTrajectory() {
  const points =
    useMemo(() => {
      return [
        new THREE.Vector3(
          -1.25,
          0.65,
          0.2
        ),

        new THREE.Vector3(
          -0.85,
          0.35,
          0.12
        ),

        new THREE.Vector3(
          -0.45,
          -0.05,
          0.06
        ),

        new THREE.Vector3(
          -0.15,
          -0.55,
          0
        ),
      ];
    }, []);

  const geometry =
    useMemo(() => {
      return new THREE.BufferGeometry().setFromPoints(
        points
      );
    }, [points]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color="#ed42ff"
        transparent
        opacity={0.85}
      />
    </line>
  );
}

/* =========================================================
   OCEAN BOX
========================================================= */

function OceanBox({
  selectedDepth,
  opacity,
  verticalExaggeration,
  layerVisibility,
  surfaceVisibility,
  bathymetryVisibility,
  instrument,
  instrumentType,
  longitude,
  depths = [],
  variableValues = [],
  stats = null,
  maxDepth = 2000,
}) {
  const actualMaxDepth =
    Math.max(
      2000,
      maxDepth
    );

  return (
    <group
      scale={[
        1,
        Math.max(
          1,
          verticalExaggeration /
            100
        ),
        1,
      ]}
    >
      <OceanGlass
        opacity={opacity}
      />

      <OceanWireframe />

      <OceanSurface
        values={
          variableValues
        }
        stats={stats}
        visible={
          surfaceVisibility
        }
        opacity={opacity}
      />

      {layerVisibility && (
        <VariableColorLayers
          depths={depths}
          values={
            variableValues
          }
          min={stats?.min}
          max={stats?.max}
          maxDepth={
            actualMaxDepth
          }
          opacity={opacity}
        />
      )}

      <OceanSlice
        depth={
          selectedDepth
        }
        depths={depths}
        values={
          variableValues
        }
        min={stats?.min}
        max={stats?.max}
        maxDepth={
          actualMaxDepth
        }
        opacity={opacity}
      />

      <OceanParticles />

      <OceanFloor
        visible={
          bathymetryVisibility
        }
      />

      {/* =====================================================
          ONLY SELECTED INSTRUMENT IS SHOWN
      ===================================================== */}

      {instrumentType === "argo" && (
        <>
          <ArgoTrack
            maxDepth={
              actualMaxDepth
            }
          />

          <group
            position={[
              0,
              1.42,
              0,
            ]}
          >
            <ArgoFloat
              selected
            />
          </group>
        </>
      )}

      {instrumentType === "glider" && (
        <>
          <GliderTrajectory />

          <group
            position={[
              -1.25,
              0.65,
              0.2,
            ]}
            rotation={[
              0,
              0,
              -0.45,
            ]}
          >
            <Glider />
          </group>
        </>
      )}

      <mesh
        position={[
          0,
          -1.37,
          0,
        ]}
      >
        <sphereGeometry
          args={[
            0.045,
            16,
            16,
          ]}
        />

        <meshBasicMaterial
          color="#ffffff"
        />
      </mesh>

      <DepthAxis
        maxDepth={
          actualMaxDepth
        }
      />

      <CoordinateLabels
        longitude={
          longitude
        }
      />
    </group>
  );
}

/* =========================================================
   OCEAN SCENE
========================================================= */

function OceanScene({
  selectedDepth,
  opacity,
  verticalExaggeration,
  layerVisibility,
  surfaceVisibility,
  bathymetryVisibility,
  instrument,
  instrumentType,
  longitude,
  depths,
  variableValues,
  stats,
  maxDepth,
  controlsRef,
  cameraRef,
}) {
  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[
          5.4,
          3.5,
          5.8,
        ]}
        fov={45}
      />

      <ambientLight
        intensity={1.25}
      />

      <pointLight
        position={[
          3,
          5,
          5,
        ]}
        intensity={1.8}
      />

      <pointLight
        position={[
          -4,
          1,
          -3,
        ]}
        intensity={0.7}
      />

      <Stars
        radius={50}
        depth={30}
        count={700}
        factor={1.1}
        saturation={0}
        fade
      />

      <OceanBox
        selectedDepth={
          selectedDepth
        }
        opacity={opacity}
        verticalExaggeration={
          verticalExaggeration
        }
        layerVisibility={
          layerVisibility
        }
        surfaceVisibility={
          surfaceVisibility
        }
        bathymetryVisibility={
          bathymetryVisibility
        }
        instrument={
          instrument
        }
        instrumentType={
          instrumentType
        }
        longitude={
          longitude
        }
        depths={depths}
        variableValues={
          variableValues
        }
        stats={stats}
        maxDepth={maxDepth}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableZoom
        enableRotate
        minDistance={3.5}
        maxDistance={11}
        target={[
          0,
          0,
          0,
        ]}
      />
    </>
  );
}

/* =========================================================
   ARGO CROSS SECTION MINI MAP
========================================================= */

function ArgoMiniMap({
  latitude,
  longitude,
  instrumentId,
}) {
  const lat = safeNumber(latitude);
  const lon = safeNumber(longitude);

  /*
   * If the API has no valid coordinates, show the same
   * cross-section area without trying to create a map.
   */
  if (
    lat === null ||
    lon === null
  ) {
    return (
      <div className="cross-section-map-empty">
        <span>
          No Argo location
        </span>
      </div>
    );
  }

  /*
   * Custom Argo marker.
   * This avoids the normal Leaflet marker image-path
   * problem in Vite/React applications.
   */
  const argoIcon = L.divIcon({
    className:
      "argo-mini-marker-wrapper",

    html: `
      <div class="argo-mini-marker">
        <div class="argo-mini-marker-core"></div>
        <div class="argo-mini-marker-ring"></div>
      </div>
    `,

    iconSize: [
      20,
      20,
    ],

    iconAnchor: [
      10,
      10,
    ],

    popupAnchor: [
      0,
      -10,
    ],
  });

  /*
   * The map shows a small geographic area around
   * the selected Argo position.
   */
  const latOffset = 1.8;
  const lonOffset = 2.5;

  const bounds = [
    [
      lat - latOffset,
      lon - lonOffset,
    ],
    [
      lat + latOffset,
      lon + lonOffset,
    ],
  ];

  return (
    <div className="cross-section-map">

      <MapContainer
        center={[
          lat,
          lon,
        ]}
        bounds={bounds}
        boundsOptions={{
          padding: [
            8,
            8,
          ],
        }}
        zoom={5}
        minZoom={3}
        maxZoom={9}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging
        zoomControl={false}
        attributionControl={false}
        keyboard={false}
        style={{
          width: "100%",
          height: "100%",
          background:
            "#061d2e",
        }}
      >

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <Marker
          position={[
            lat,
            lon,
          ]}
          icon={argoIcon}
        >
          <Popup>
            <div className="argo-map-popup">

              <strong>
                Argo Float
              </strong>

              <div>
                {instrumentId ||
                  "--"}
              </div>

              <div>
                {lat.toFixed(
                  4
                )}
                °N
              </div>

              <div>
                {lon.toFixed(
                  4
                )}
                °E
              </div>

            </div>
          </Popup>
        </Marker>

      </MapContainer>

      <div className="mini-map-location-badge">
        {lat.toFixed(2)}
        °N,{" "}
        {lon.toFixed(2)}
        °E
      </div>

      <div className="mini-map-north-arrow">
        <span>N</span>
        <span>▲</span>
      </div>

    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Analysis() {
  const {
    instrumentId,
  } = useParams();

  const controlsRef =
    useRef(null);

  const cameraRef =
    useRef(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    instrument,
    setInstrument,
  ] = useState(null);

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    dataset,
    setDataset,
  ] = useState(null);

  const [
    variable,
    setVariable,
  ] = useState(
    "temperature"
  );

  const [
    selectedDepth,
    setSelectedDepth,
  ] = useState(1000);

  const [
    opacity,
    setOpacity,
  ] = useState(75);

  const [
    verticalExaggeration,
    setVerticalExaggeration,
  ] = useState(150);

  const [
    visualMode,
    setVisualMode,
  ] = useState("3d");

  const [
    layerVisibility,
    setLayerVisibility,
  ] = useState(true);

  const [
    surfaceVisibility,
    setSurfaceVisibility,
  ] = useState(true);

  const [
    bathymetryVisibility,
    setBathymetryVisibility,
  ] = useState(true);

  const [
    observationType,
    setObservationType,
  ] = useState("argo");

  const [
    comparisonMetric,
    setComparisonMetric,
  ] = useState(
    "correlation"
  );

  const [
    playing,
    setPlaying,
  ] = useState(false);

  const [
    comparisonResult,
    setComparisonResult,
  ] = useState(null);

  const [
    comparisonLoading,
    setComparisonLoading,
  ] = useState(false);

  const [
    comparisonError,
    setComparisonError,
  ] = useState("");

  /* =====================================================
     LOAD PROFILE
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!instrumentId) {
        setError(
          "No instrument selected."
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${API_BASE}/api/instruments/${encodeURIComponent(
              instrumentId
            )}/profile`
          );

        if (!response.ok) {
          throw new Error(
            `Backend returned ${response.status}`
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        const normalized =
          normalizeProfileResponse(
            data
          );

        setInstrument(
          normalized.instrument
        );

        setProfile(
          normalized.profile
        );

        setDataset(
          normalized.dataset
        );

        const temperature =
          extractVariableValues(
            normalized.profile,
            "temperature"
          );

        const salinity =
          extractVariableValues(
            normalized.profile,
            "salinity"
          );

        if (temperature.length) {
          setVariable(
            "temperature"
          );
        } else if (
          salinity.length
        ) {
          setVariable(
            "salinity"
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Failed to load instrument profile:",
            err
          );

          setError(
            err.message ||
              "Unable to load instrument profile."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [instrumentId]);

  /* =====================================================
     DATA
  ===================================================== */

  const depths = useMemo(
    () =>
      extractDepths(
        profile
      ),
    [profile]
  );

  const variableDefinition =
    getVariableDefinition(
      variable
    );

  const variableValues =
    useMemo(
      () =>
        extractVariableValues(
          profile,
          variable
        ),
      [profile, variable]
    );

  const stats = useMemo(
    () =>
      calculateStats(
        variableValues
      ),
    [variableValues]
  );

  /* =====================================================
     AVAILABLE VARIABLES
  ===================================================== */

  const availableVariables =
    useMemo(() => {
      return VARIABLES.map(
        (item) => {
          const values =
            extractVariableValues(
              profile,
              item.key
            );

          return {
            ...item,
            available:
              values.some(
                (value) =>
                  safeNumber(
                    value
                  ) !== null
              ),
          };
        }
      );
    }, [profile]);

  /* =====================================================
     MAX DEPTH
  ===================================================== */

  const maxDepth =
    useMemo(() => {
      if (!depths.length) {
        return 2000;
      }

      return Math.max(
        2000,
        ...depths
      );
    }, [depths]);

  /* =====================================================
     SELECTED DEPTH
  ===================================================== */

  useEffect(() => {
    if (!depths.length) {
      return;
    }

    const index =
      getNearestIndex(
        depths,
        selectedDepth
      );

    if (index >= 0) {
      const actualDepth =
        depths[index];

      if (
        actualDepth !==
        selectedDepth
      ) {
        setSelectedDepth(
          actualDepth
        );
      }
    }
  }, [
    depths,
    selectedDepth,
  ]);

  /* =====================================================
     CHART DATA
  ===================================================== */

  const comparisonMatches =
    comparisonResult?.result?.matches ?? [];

  const comparisonMetrics =
    comparisonResult?.result?.metrics ?? {};

  const chartData =
    useMemo(() => {
      if (!comparisonMatches.length) {
        return [];
      }

      return comparisonMatches.map(
        (item) => ({
          depth: safeNumber(
            item.depth
          ),
          observation:
            safeNumber(
              item.observation
            ),
          model: safeNumber(
            item.model
          ),
        })
      );
    }, [comparisonMatches]);

  /* =====================================================
     SELECTED VALUE
  ===================================================== */

  const selectedDepthIndex =
    useMemo(
      () =>
        getNearestIndex(
          depths,
          selectedDepth
        ),
      [
        depths,
        selectedDepth,
      ]
    );

  const selectedValue =
    selectedDepthIndex >= 0
      ? variableValues[
          selectedDepthIndex
        ]
      : null;

  /* =====================================================
     INSTRUMENT INFO
  ===================================================== */

  const actualInstrumentId =
    getValueFromObject(
      instrument,
      [
        "id",
        "instrument_id",
        "float_id",
        "platform_id",
        "PLATFORM_NUMBER",
      ]
    ) ||
    instrumentId;

  const instrumentType =
    getInstrumentType(
      instrument,
      actualInstrumentId
    );

  const latitude =
    safeNumber(
      getValueFromObject(
        instrument,
        [
          "latitude",
          "lat",
          "LATITUDE",
        ]
      )
    );

  const longitude =
    safeNumber(
      getValueFromObject(
        instrument,
        [
          "longitude",
          "lon",
          "lng",
          "LONGITUDE",
        ]
      )
    );

  const instrumentTime =
    getValueFromObject(
      instrument,
      [
        "time",
        "date",
        "timestamp",
        "juld",
        "JULD",
      ]
    );

  /* =====================================================
     MODEL VS OBSERVATION
  ===================================================== */

  useEffect(() => {
    if (
      !actualInstrumentId ||
      !instrumentType ||
      !variable
    ) {
      console.log(
        "MODEL COMPARISON SKIPPED:",
        {
          actualInstrumentId,
          instrumentType,
          variable,
        }
      );

      return;
    }

    if (
      instrumentType !== "argo" &&
      instrumentType !== "glider"
    ) {
      console.log(
        "MODEL COMPARISON INVALID TYPE:",
        instrumentType
      );

      return;
    }

    let cancelled = false;

    async function loadModelComparison() {
      try {
        setComparisonLoading(true);
        setComparisonError("");

        const params =
          new URLSearchParams({
            instrument_id:
              String(
                actualInstrumentId
              ),

            instrument_type:
              String(
                instrumentType
              ),

            variable:
              String(variable),

            max_time_difference_hours:
              "24",
          });

        console.log(
          "CALLING MODEL COMPARISON:",
          `${API_BASE}/api/match-model-observations?${params.toString()}`
        );

        const response =
          await fetch(
            `${API_BASE}/api/match-model-observations?${params.toString()}`
          );

        const data =
          await response.json();

        console.log(
          "FULL MODEL RESPONSE JSON:",
          JSON.stringify(
            data,
            null,
            2
          )
        );

        console.log(
          "MODEL METRICS JSON:",
          JSON.stringify(
            data?.result?.metrics,
            null,
            2
          )
        );

        console.log(
          "MODEL COMPARISON RESPONSE:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              "Failed to load model comparison."
          );
        }

        if (!cancelled) {
          setComparisonResult(
            data
          );
        }
      } catch (err) {
        console.error(
          "MODEL COMPARISON ERROR:",
          err
        );

        if (!cancelled) {
          setComparisonResult(
            null
          );

          setComparisonError(
            err.message ||
              "Unable to load model comparison."
          );
        }
      } finally {
        if (!cancelled) {
          setComparisonLoading(
            false
          );
        }
      }
    }

    loadModelComparison();

    return () => {
      cancelled = true;
    };
  }, [
    actualInstrumentId,
    instrumentType,
    variable,
  ]);

  /* =====================================================
     RANGES
  ===================================================== */

  const temperatureStats =
    useMemo(
      () =>
        calculateStats(
          extractVariableValues(
            profile,
            "temperature"
          )
        ),
      [profile]
    );

  const salinityStats =
    useMemo(
      () =>
        calculateStats(
          extractVariableValues(
            profile,
            "salinity"
          )
        ),
      [profile]
    );

  const chlorophyllStats =
    useMemo(
      () =>
        calculateStats(
          extractVariableValues(
            profile,
            "chlorophyll"
          )
        ),
      [profile]
    );

  const oxygenStats =
    useMemo(
      () =>
        calculateStats(
          extractVariableValues(
            profile,
            "oxygen"
          )
        ),
      [profile]
    );

  const nitrateStats =
    useMemo(
      () =>
        calculateStats(
          extractVariableValues(
            profile,
            "nitrates"
          )
        ),
      [profile]
    );

  /* =====================================================
     DEPTH CONTROLS
  ===================================================== */

  function handleDepthButton(
    depth
  ) {
    if (!depths.length) {
      setSelectedDepth(
        depth
      );

      return;
    }

    const index =
      getNearestIndex(
        depths,
        depth
      );

    if (index >= 0) {
      setSelectedDepth(
        depths[index]
      );
    }
  }

  function handleDepthSlider(
    event
  ) {
    const value =
      Number(
        event.target.value
      );

    if (
      !Number.isFinite(value)
    ) {
      return;
    }

    if (!depths.length) {
      setSelectedDepth(
        value
      );

      return;
    }

    const index =
      getNearestIndex(
        depths,
        value
      );

    if (index >= 0) {
      setSelectedDepth(
        depths[index]
      );
    }
  }

  function handleVariable(
    variableKey
  ) {
    const item =
      availableVariables.find(
        (entry) =>
          entry.key ===
          variableKey
      );

    if (!item?.available) {
      return;
    }

    setVariable(
      variableKey
    );
  }

  /* =====================================================
     VIEW CONTROLS
  ===================================================== */

  function resetView() {
    if (
      controlsRef.current
    ) {
      controlsRef.current.reset();
    }
  }

  function enableRotate() {
    if (
      controlsRef.current
    ) {
      controlsRef.current.enableRotate =
        true;

      controlsRef.current.enablePan =
        false;

      controlsRef.current.enableZoom =
        false;
    }
  }

  function enablePan() {
    if (
      controlsRef.current
    ) {
      controlsRef.current.enableRotate =
        false;

      controlsRef.current.enablePan =
        true;

      controlsRef.current.enableZoom =
        false;
    }
  }

  function enableZoom() {
    if (
      controlsRef.current
    ) {
      controlsRef.current.enableRotate =
        false;

      controlsRef.current.enablePan =
        false;

      controlsRef.current.enableZoom =
        true;
    }
  }

  function toggleFullscreen() {
    const element =
      document.querySelector(
        ".ocean-scene"
      );

    if (!element) {
      return;
    }

    if (
      !document.fullscreenElement
    ) {
      element.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /* =====================================================
     TIMELINE
  ===================================================== */

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer =
      setInterval(() => {
        setSelectedDepth(
          (currentDepth) => {
            if (depths.length > 0) {
              const currentIndex =
                getNearestIndex(
                  depths,
                  currentDepth
                );

              if (
                currentIndex < 0 ||
                currentIndex >=
                  depths.length - 1
              ) {
                return depths[0];
              }

              return depths[
                currentIndex + 1
              ];
            }

            const step = 50;

            const nextDepth =
              currentDepth +
              step;

            if (
              nextDepth >=
              maxDepth
            ) {
              return 0;
            }

            return nextDepth;
          }
        );
      }, 700);

    return () => {
      clearInterval(timer);
    };
  }, [
    playing,
    depths,
    maxDepth,
  ]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="analysis-page">
        <div className="analysis-loading">
          Loading ocean profile...
        </div>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error) {
    return (
      <div className="analysis-page">
        <div className="analysis-error">

          <h2>
            Unable to load instrument
          </h2>

          <p>
            {error}
          </p>

          <p>
            Instrument:{" "}
            <strong>
              {instrumentId ||
                "--"}
            </strong>
          </p>

        </div>
      </div>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <div className="analysis-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="analysis-header">

        <div className="analysis-brand">

          <div>
            Trinetra
          </div>

          <div>

            <div className="analysis-brand-subtitle">
              Indian National Centre for Ocean
              Information Services
            </div>

          </div>

        </div>

        <div className="analysis-header-right">

          <div className="dataset-search">

            <span>
              ⌕
            </span>

            <input
              placeholder="Search dataset..."
              aria-label="Search dataset"
            />

          </div>

          <div className="analysis-date">

            {instrumentTime
              ? `${formatDate(
                  instrumentTime
                )}, 00:00 UTC`
              : "10 Aug 2026, 00:00 UTC"}

          </div>

          <div className="user-icon">
            ◉
          </div>

        </div>

      </header>

      {/* =================================================
          BODY
      ================================================= */}

      <div className="analysis-body">

        {/* =================================================
            LEFT PANEL
        ================================================= */}

        <aside className="analysis-left-panel">

          {/* VARIABLES */}

          <section className="analysis-panel layer-panel">

            <div className="analysis-panel-title">

              <span>
                ▱
              </span>

              <span>
                LAYER & VARIABLES
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="variable-list">

              {availableVariables.map(
                (item) => (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    className={`variable-row ${
                      variable ===
                      item.key
                        ? "active"
                        : ""
                    } ${
                      !item.available
                        ? "disabled"
                        : ""
                    }`}
                    onClick={() =>
                      handleVariable(
                        item.key
                      )
                    }
                  >

                    <span className="variable-icon">
                      {item.icon}
                    </span>

                    <span className="variable-label">

                      {item.label}

                      {item.unit
                        ? ` (${item.unit})`
                        : ""}

                    </span>

                    <span
                      className={`variable-toggle ${
                        variable ===
                        item.key
                          ? "on"
                          : ""
                      }`}
                    >
                      <span />
                    </span>

                  </button>
                )
              )}

            </div>

          </section>

          {/* DEPTH */}

          <section className="analysis-panel depth-panel">

            <div className="analysis-panel-title">

              <span>
                ▱
              </span>

              <span>
                DEPTH SLICE
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="depth-buttons">

              {DEPTH_LEVELS.map(
                (depth) => (
                  <button
                    key={
                      depth
                    }
                    type="button"
                    className={
                      selectedDepth ===
                        depth
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      handleDepthButton(
                        depth
                      )
                    }
                  >
                    {depth === 0
                      ? "Surface"
                      : `${depth} m`}
                  </button>
                )
              )}

              <button
                type="button"
                className={
                  !DEPTH_LEVELS.includes(
                    selectedDepth
                  )
                    ? "active"
                    : ""
                }
              >
                Custom
              </button>

            </div>

            <div className="depth-current">

              Depth:{" "}

              <strong>
                {selectedDepth} m
              </strong>

            </div>

            <input
              className="depth-slider"
              type="range"
              min="0"
              max={maxDepth}
              step="50"
              value={Math.min(
                selectedDepth,
                maxDepth
              )}
              onChange={
                handleDepthSlider
              }
            />

            <div className="depth-slider-labels">

              <span>
                0 m
              </span>

              <span>
                {maxDepth} m
              </span>

            </div>

          </section>

          {/* VISUAL MODE */}

          <section className="analysis-panel visualization-panel">

            <div className="analysis-panel-title">

              <span>
                ◇
              </span>

              <span>
                VISUALIZATION MODE
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="visual-mode-buttons">

              <button
                type="button"
                className={
                  visualMode ===
                    "3d"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setVisualMode(
                    "3d"
                  )
                }
              >
                <span>
                  ◇
                </span>

                3D Volume

              </button>

              <button
                type="button"
                className={
                  visualMode ===
                    "slice"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setVisualMode(
                    "slice"
                  )
                }
              >
                <span>
                  ▱
                </span>

                Depth Slice

              </button>

              <button
                type="button"
                className={
                  visualMode ===
                    "iso"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setVisualMode(
                    "iso"
                  )
                }
              >
                <span>
                  ≋
                </span>

                Isosurface

              </button>

            </div>

          </section>

          {/* CONTROLS */}

          <section className="analysis-panel controls-panel">

            <div className="analysis-panel-title">

              <span>
                ◈
              </span>

              <span>
                VISUAL CONTROLS
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="control-row">

              <span>
                Opacity
              </span>

              <input
                type="range"
                min="0"
                max="100"
                value={
                  opacity
                }
                onChange={(
                  event
                ) =>
                  setOpacity(
                    Number(
                      event
                        .target
                        .value
                    )
                  )
                }
              />

              <span>
                {opacity}%
              </span>

            </div>

            <div className="control-row">

              <span>
                Vertical Exaggeration
              </span>

              <input
                type="range"
                min="100"
                max="300"
                value={
                  verticalExaggeration
                }
                onChange={(
                  event
                ) =>
                  setVerticalExaggeration(
                    Number(
                      event
                        .target
                        .value
                    )
                  )
                }
              />

              <span>
                {(
                  verticalExaggeration /
                  100
                ).toFixed(
                  1
                )}
                x
              </span>

            </div>

            <div className="visibility-row">

              <span>
                Layer Visibility
              </span>

              <button
                type="button"
                className={`switch ${
                  layerVisibility
                    ? "on"
                    : ""
                }`}
                onClick={() =>
                  setLayerVisibility(
                    (
                      value
                    ) =>
                      !value
                  )
                }
              >
                <span />
              </button>

            </div>

            <div className="visibility-row">

              <span>
                Surface Visibility
              </span>

              <button
                type="button"
                className={`switch ${
                  surfaceVisibility
                    ? "on"
                    : ""
                }`}
                onClick={() =>
                  setSurfaceVisibility(
                    (
                      value
                    ) =>
                      !value
                  )
                }
              >
                <span />
              </button>

            </div>

            <div className="visibility-row">

              <span>
                Bathymetry Visibility
              </span>

              <button
                type="button"
                className={`switch ${
                  bathymetryVisibility
                    ? "on"
                    : ""
                }`}
                onClick={() =>
                  setBathymetryVisibility(
                    (
                      value
                    ) =>
                      !value
                  )
                }
              >
                <span />
              </button>

            </div>

          </section>

        </aside>

        {/* =================================================
            CENTER
        ================================================= */}

        <main className="analysis-center">

          {/* SCENE TOOLBAR */}

          <div className="scene-toolbar">

            <button
              type="button"
              onClick={
                enableRotate
              }
            >
              ◉ Rotate
            </button>

            <button
              type="button"
              onClick={
                enablePan
              }
            >
              ✥ Pan
            </button>

            <button
              type="button"
              onClick={
                enableZoom
              }
            >
              ⌕ Zoom
            </button>

            <button
              type="button"
              onClick={
                resetView
              }
            >
              ⟳ Reset View
            </button>

          </div>

          {/* 3D SCENE */}

          <div className="ocean-scene">

            <Canvas
              dpr={[
                1,
                2,
              ]}
              gl={{
                antialias:
                  true,
                alpha: true,
              }}
            >

              <OceanScene
                selectedDepth={
                  selectedDepth
                }

                opacity={
                  opacity
                }

                verticalExaggeration={
                  verticalExaggeration
                }

                layerVisibility={
                  layerVisibility
                }

                surfaceVisibility={
                  surfaceVisibility
                }

                bathymetryVisibility={
                  bathymetryVisibility
                }

                instrument={
                  instrument
                }

                instrumentType={
                  instrumentType
                }

                longitude={
                  longitude
                }

                depths={
                  depths
                }

                variableValues={
                  variableValues
                }

                stats={
                  stats
                }

                maxDepth={
                  maxDepth
                }

                controlsRef={
                  controlsRef
                }

                cameraRef={
                  cameraRef
                }
              />

            </Canvas>

            {/* =================================================
                SCREEN OVERLAYS
            ================================================= */}

            {/* COMPASS */}

            <div className="compass">

              <span className="north">
                N
              </span>

              <span className="west">
                W
              </span>

              <span className="east">
                E
              </span>

              <span className="south">
                S
              </span>

              <span className="compass-arrow">
                ▲
              </span>

            </div>

            {/* ARGO LABEL */}

            {instrumentType ===
              "argo" && (
              <div className="argo-label">

                <span className="marker-dot green" />

                <span>

                  Argo Float

                  <br />

                  <strong>
                    {
                      actualInstrumentId
                    }
                  </strong>

                </span>

              </div>
            )}

            {/* GLIDER LABEL */}

            {instrumentType ===
              "glider" && (
              <div className="glider-label">

                <span className="marker-dot purple" />

                <span>

                  Glider

                  <br />

                  SG6738

                </span>

              </div>
            )}

            {/* SELECTED DEPTH */}

            <div className="scene-depth-label">

              Depth:{" "}

              <strong>
                {selectedDepth} m
              </strong>

            </div>

            {/* LOCATION */}

            <div className="scene-location">

              {latitude !==
                null &&
              longitude !==
                null
                ? `${latitude.toFixed(
                    2
                  )}°N, ${longitude.toFixed(
                    2
                  )}°E`
                : "Instrument location"}

            </div>

            {/* COLOR SCALE */}

            <div className="scene-color-scale">

              <div>

                {
                  variableDefinition.label
                }{" "}

                (
                {
                  variableDefinition.unit
                }
                ) @{" "}

                {selectedDepth} m

              </div>

              <div
                className="color-gradient"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(30,55,210) 0%, rgb(0,125,255) 16%, rgb(0,205,255) 32%, rgb(20,225,150) 48%, rgb(220,225,40) 64%, rgb(255,155,0) 80%, rgb(245,35,35) 100%)",
                }}
              />

              <div className="color-scale-values">

                <span>
                  {formatNumber(
                    stats.min,
                    1
                  )}
                </span>

                <span>
                  {formatNumber(
                    stats.max,
                    1
                  )}
                </span>

              </div>

            </div>

            {/* =================================================
                CROSS SECTION MINI MAP
            ================================================= */}

            {instrumentType ===
              "argo" && (
              <div className="scene-minimap">

                <div className="mini-map-title">
                  Cross Section
                </div>

                <ArgoMiniMap
                  latitude={
                    latitude
                  }
                  longitude={
                    longitude
                  }
                  instrumentId={
                    actualInstrumentId
                  }
                />

              </div>
            )}

            {/* FULLSCREEN */}

            <button
              type="button"
              className="scene-fullscreen"
              onClick={
                toggleFullscreen
              }
            >
              ⛶
            </button>

          </div>

          {/* =================================================
              TIMELINE
          ================================================= */}

          <div className="analysis-timeline">

            <button
              type="button"
              className="timeline-play"
              aria-label={
                playing
                  ? "Pause depth animation"
                  : "Play depth animation"
              }
              title={
                playing
                  ? "Pause"
                  : "Play"
              }
              onClick={() =>
                setPlaying(
                  (
                    value
                  ) =>
                    !value
                )
              }
            >
              {playing
                ? "Ⅱ"
                : "▶"}
            </button>

            <button
              type="button"
              className="timeline-small"
              aria-label="Go to first depth"
              title="First depth"
              onClick={() => {
                setPlaying(false);

                setSelectedDepth(
                  depths.length
                    ? depths[0]
                    : 0
                );
              }}
            >
              |◀
            </button>

            <button
              type="button"
              className="timeline-small"
              aria-label="Go to last depth"
              title="Last depth"
              onClick={() => {
                setPlaying(false);

                setSelectedDepth(
                  depths.length
                    ? depths[
                        depths.length -
                          1
                      ]
                    : maxDepth
                );
              }}
            >
              ▶|
            </button>

            <div className="timeline-date">

              📅{" "}

              {instrumentTime
                ? `${formatDate(
                    instrumentTime
                  )}, 00:00 UTC`
                : "--"}

            </div>

            <div className="timeline-track">

              <div className="timeline-line" />

              <span>
                Aug 06
              </span>

              <span>
                Aug 08
              </span>

              <span>
                Aug 10
              </span>

              <span>
                Aug 12
              </span>

              <span>
                Aug 14
              </span>

            </div>

            <div className="timeline-depth">

              Depth:{" "}
              {selectedDepth} m

              <span>
                ⌄
              </span>

            </div>

          </div>

        </main>

        {/* =================================================
            RIGHT PANEL
        ================================================= */}

        <aside className="analysis-right-panel">

          {/* MODEL VS OBSERVATION */}

          <section className="analysis-panel observation-panel">

            <div className="analysis-panel-title">

              <span>
                ▱
              </span>

              <span>
                MODEL VS OBSERVATION
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="observation-tabs">

              <button
                type="button"
                className={
                  observationType ===
                    "argo"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setObservationType(
                    "argo"
                  )
                }
              >
                ◇ Argo
              </button>

              <button
                type="button"
                className={
                  observationType ===
                    "glider"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setObservationType(
                    "glider"
                  )
                }
              >
                ◇ Glider
              </button>

            </div>

            <div className="chart-title">

              {
                variableDefinition.label
              }{" "}

              Profile (

              {observationType ===
                "argo"
                ? "Argo"
                : "Glider"}{" "}

              -{" "}

              {
                actualInstrumentId
              }

              )

            </div>

            <div className="profile-chart">

              {chartData.length ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={
                      chartData
                    }
                    margin={{
                      top: 10,
                      right: 10,
                      bottom: 10,
                      left: 5,
                    }}
                  >

                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(80,160,220,0.20)"
                    />

                    <XAxis
                      type="number"
                      dataKey="observation"
                      tick={{
                        fill: "#9ec9e8",
                        fontSize: 10,
                      }}
                      stroke="#3978a3"
                    />

                    <YAxis
                      type="number"
                      dataKey="depth"
                      reversed
                      tick={{
                        fill: "#9ec9e8",
                        fontSize: 10,
                      }}
                      stroke="#3978a3"
                      label={{
                        value:
                          "Depth (m)",
                        angle:
                          -90,
                        position:
                          "insideLeft",
                        fill: "#9ec9e8",
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#071c34",
                        border:
                          "1px solid #168ed1",
                        color:
                          "#ffffff",
                      }}
                      formatter={(
                        value
                      ) => [
                        value ===
                          null
                          ? "--"
                          : formatNumber(
                              value,
                              3
                            ),
                        "Observation",
                      ]}
                      labelFormatter={(
                        value
                      ) =>
                        `Depth: ${value} m`
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="observation"
                      stroke="#18b9ff"
                      strokeWidth={2}
                      dot={{
                        r: 2.5,
                        fill: "#18b9ff",
                      }}
                      connectNulls
                    />

                  </LineChart>

                </ResponsiveContainer>
              ) : (
                <div className="no-profile-data">
                  No observation profile
                  available
                </div>
              )}

            </div>

            <div className="chart-legend">

              <span>

                <i className="legend-model" />

                Model

              </span>

              <span>

                <i className="legend-observation" />

                Observation

              </span>

            </div>

            <div className="model-note">
              Model data not loaded
            </div>

          </section>

          {/* MODEL COMPARISON */}

          <section className="analysis-panel comparison-panel">

            <div className="analysis-panel-title">

              <span>
                ◈
              </span>

              <span>
                MODEL VS INSTRUMENT COMPARISON
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <div className="metric-tabs">

              {[
                "correlation",
                "rmse",
                "mae",
                "bias",
              ].map(
                (
                  metric
                ) => (
                  <button
                    key={
                      metric
                    }
                    type="button"
                    className={
                      comparisonMetric ===
                        metric
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setComparisonMetric(
                        metric
                      )
                    }
                  >

                    {metric
                      .charAt(
                        0
                      )
                      .toUpperCase() +
                      metric.slice(
                        1
                      )}

                  </button>
                )
              )}

            </div>

            <div className="metric-values">

              <div className="metric-card">

                <span>
                  Correlation
                </span>

                <strong>

                  {comparisonMetrics.correlation != null
                    ? formatNumber(
                        comparisonMetrics.correlation,
                        3
                      )
                    : "--"}

                </strong>

              </div>

              <div className="metric-card">

                <span>
                  RMSE
                </span>

                <strong>

                  {comparisonMetrics.rmse != null
                    ? formatNumber(
                        comparisonMetrics.rmse,
                        3
                      )
                    : "--"}

                </strong>

              </div>

              <div className="metric-card">

                <span>
                  MAE
                </span>

                <strong>

                  {comparisonMetrics.mae != null
                    ? formatNumber(
                        comparisonMetrics.mae,
                        3
                      )
                    : "--"}

                </strong>

              </div>

              <div className="metric-card">

                <span>
                  Bias
                </span>

                <strong>

                  {comparisonMetrics.bias != null
                    ? formatNumber(
                        comparisonMetrics.bias,
                        3
                      )
                    : "--"}

                </strong>

              </div>

            </div>

            <div className="model-note">
              Comparison requires a model
              dataset.
            </div>

          </section>

          {/* RANGE */}

          <section className="analysis-panel range-panel">

            <div className="analysis-panel-title">

              <span>
                ◈
              </span>

              <span>
                MIN / MAX RANGE
              </span>

              <span className="panel-arrow">
                ›
              </span>

            </div>

            <table className="range-table">

              <thead>

                <tr>

                  <th>
                    Variable
                  </th>

                  <th>
                    Min
                  </th>

                  <th>
                    Max
                  </th>

                  <th>
                    Range
                  </th>

                </tr>

              </thead>

              <tbody>

                <tr>

                  <td>
                    Temperature
                  </td>

                  <td>
                    {formatNumber(
                      temperatureStats.min,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      temperatureStats.max,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      temperatureStats.range,
                      1
                    )}
                  </td>

                </tr>

                <tr>

                  <td>
                    Salinity
                  </td>

                  <td>
                    {formatNumber(
                      salinityStats.min,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      salinityStats.max,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      salinityStats.range,
                      1
                    )}
                  </td>

                </tr>

                <tr>

                  <td>
                    Chlorophyll
                  </td>

                  <td>
                    {formatNumber(
                      chlorophyllStats.min,
                      2
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      chlorophyllStats.max,
                      2
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      chlorophyllStats.range,
                      2
                    )}
                  </td>

                </tr>

                <tr>

                  <td>
                    Dissolved Oxygen
                  </td>

                  <td>
                    {formatNumber(
                      oxygenStats.min,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      oxygenStats.max,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      oxygenStats.range,
                      1
                    )}
                  </td>

                </tr>

                <tr>

                  <td>
                    Nitrates
                  </td>

                  <td>
                    {formatNumber(
                      nitrateStats.min,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      nitrateStats.max,
                      1
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      nitrateStats.range,
                      1
                    )}
                  </td>

                </tr>

              </tbody>

            </table>

          </section>

          {/* COLOR SCALE */}

          <section className="analysis-panel color-panel">

            <div className="color-panel-header">

              <span>
                ◉
              </span>

              <span>
                Color Scale
              </span>

              <select
                value={
                  variable
                }
                onChange={(
                  event
                ) =>
                  handleVariable(
                    event
                      .target
                      .value
                  )
                }
              >

                {availableVariables
                  .filter(
                    (
                      item
                    ) =>
                      item.available
                  )
                  .map(
                    (
                      item
                    ) => (
                      <option
                        key={
                          item.key
                        }
                        value={
                          item.key
                        }
                      >
                        {
                          item.label
                        }
                      </option>
                    )
                  )}

              </select>

            </div>

            <div
              className="color-palette"
              style={{
                background:
                  "linear-gradient(90deg, rgb(30,55,210) 0%, rgb(0,125,255) 16%, rgb(0,205,255) 32%, rgb(20,225,150) 48%, rgb(220,225,40) 64%, rgb(255,155,0) 80%, rgb(245,35,35) 100%)",
              }}
            />

            <div className="color-scale-number">

              <span>
                {formatNumber(
                  stats.min,
                  1
                )}
              </span>

              <span>
                {formatNumber(
                  stats.max,
                  1
                )}
              </span>

            </div>

          </section>

        </aside>

      </div>

      {/* =================================================
          DATA STATUS
      ================================================= */}

      <div className="analysis-data-status">

        <span>

          Instrument:{" "}

          <strong>
            {
              actualInstrumentId
            }
          </strong>

        </span>

        <span>

          Lat:{" "}

          <strong>

            {latitude !==
            null
              ? latitude.toFixed(
                  4
                )
              : "--"}

          </strong>

        </span>

        <span>

          Lon:{" "}

          <strong>

            {longitude !==
            null
              ? longitude.toFixed(
                  4
                )
              : "--"}

          </strong>

        </span>

        <span>

          Depth:{" "}

          <strong>
            {selectedDepth} m
          </strong>

        </span>

        <span>

          {
            variableDefinition.label
          }:{" "}

          <strong>

            {formatNumber(
              selectedValue,
              3
            )}

            {variableDefinition.unit
              ? ` ${variableDefinition.unit}`
              : ""}

          </strong>

        </span>

      </div>

    </div>
  );
}