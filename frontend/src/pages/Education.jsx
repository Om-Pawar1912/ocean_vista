import React, { useMemo, useState } from "react";

import {
  Canvas,
  useLoader,
} from "@react-three/fiber";

import {
  OrbitControls,
  PerspectiveCamera,
  Stars,
} from "@react-three/drei";

import * as THREE from "three";

import "../styles/education.css";

/*
  ============================================================
  FIXED EDUCATION CONTENT
  No API / no external AI service.
  ============================================================
*/

const EDUCATION_DATA = {
  "Sea ice": {
    title: "Sea Ice",
    icon: "▱",
    subtitle: "Frozen ocean surface",
    questions: [
      "What is sea ice?",
      "Why is sea ice important?",
      "How does sea ice affect the ocean?",
    ],
    answers: {
      "What is sea ice?":
        "Sea ice is seawater that freezes at the ocean surface. It forms mainly in polar regions during cold seasons.",
      "Why is sea ice important?":
        "Sea ice influences ocean circulation, marine ecosystems, Earth's reflectivity, and climate processes.",
      "How does sea ice affect the ocean?":
        "Sea ice formation and melting can change seawater temperature and salinity and can influence ocean circulation.",
    },
  },

  Salinity: {
    title: "Salinity",
    icon: "♢",
    subtitle: "Salt content in water",
    questions: [
      "What is salinity?",
      "Why is salinity important?",
      "How is salinity measured?",
    ],
    answers: {
      "What is salinity?":
        "Salinity describes the amount of dissolved salts present in seawater.",
      "Why is salinity important?":
        "Salinity affects seawater density and therefore plays an important role in ocean circulation.",
      "How is salinity measured?":
        "Salinity can be measured using instruments such as CTDs and autonomous ocean observing platforms.",
    },
  },

  Temperature: {
    title: "Temperature",
    icon: "♨",
    subtitle: "Heat in the ocean",
    questions: [
      "What is temperature?",
      "Why is it important?",
      "How is it measured?",
      "How does temperature change with depth?",
    ],
    answers: {
      "What is temperature?":
        "Temperature is a measure of how warm or cold the ocean water is.",
      "Why is it important?":
        "Ocean temperature affects ocean currents, marine life, weather, and climate patterns.",
      "How is it measured?":
        "Ocean temperature can be measured using satellites, sensors, and underwater devices that record temperature at different depths.",
      "How does temperature change with depth?":
        "In many regions, temperature decreases with depth, especially through the upper ocean thermocline. The pattern varies by location and season.",
    },
  },

  Currents: {
    title: "Currents",
    icon: "⇢",
    subtitle: "Movement of ocean water",
    questions: [
      "What are ocean currents?",
      "How are currents measured?",
      "Why are ocean currents important?",
    ],
    answers: {
      "What are ocean currents?":
        "Ocean currents are large-scale movements of seawater caused by factors including wind, differences in density, Earth's rotation, and tides.",
      "How are currents measured?":
        "Currents can be observed using satellites, current meters, drifters, ADCPs, and other oceanographic instruments.",
      "Why are ocean currents important?":
        "Ocean currents transport heat, nutrients, salt, and other properties through the ocean and influence marine ecosystems and climate.",
    },
  },

  Chlorophyll: {
    title: "Chlorophyll",
    icon: "✧",
    subtitle: "Tiny plants in the ocean",
    questions: [
      "What is ocean chlorophyll?",
      "What does chlorophyll tell us?",
      "How is chlorophyll measured?",
    ],
    answers: {
      "What is ocean chlorophyll?":
        "Ocean chlorophyll is a pigment associated with phytoplankton, microscopic organisms that use sunlight for photosynthesis.",
      "What does chlorophyll tell us?":
        "Chlorophyll concentration is commonly used as an indicator of phytoplankton biomass and ocean productivity.",
      "How is chlorophyll measured?":
        "Chlorophyll can be estimated from ocean-colour satellite observations and measured directly using sensors and water samples.",
    },
  },

  Waves: {
    title: "Waves",
    icon: "〰",
    subtitle: "Ocean surface waves",
    questions: [
      "What are ocean waves?",
      "How are waves measured?",
      "What affects wave height?",
    ],
    answers: {
      "What are ocean waves?":
        "Ocean waves are oscillations of the sea surface produced by processes such as wind, tides, and distant storms.",
      "How are waves measured?":
        "Waves can be measured using buoys, radar, satellites, and other ocean observing systems.",
      "What affects wave height?":
        "Wave height depends on factors including wind speed, wind duration, fetch, water depth, and the presence of storms.",
    },
  },

  Argo: {
    title: "Argo",
    icon: "♙",
    subtitle: "Autonomous profiling floats",
    questions: [
      "What is an Argo float?",
      "How does an Argo float work?",
      "What data does Argo collect?",
    ],
    answers: {
      "What is an Argo float?":
        "An Argo float is an autonomous ocean observing platform that measures properties of seawater as it moves through the ocean.",
      "How does an Argo float work?":
        "An Argo float changes its buoyancy to move vertically through the ocean, collects measurements, and periodically communicates observations after reaching the surface.",
      "What data does Argo collect?":
        "Core Argo observations include temperature and salinity profiles. Biogeochemical Argo platforms can additionally measure properties such as oxygen and other biogeochemical variables.",
    },
  },

  Float: {
    title: "Float",
    icon: "♙",
    subtitle: "Autonomous ocean platform",
    questions: [
      "What is an ocean float?",
      "How does a float move?",
      "Why are floats useful?",
    ],
    answers: {
      "What is an ocean float?":
        "An ocean float is an autonomous observing platform designed to collect measurements while drifting or profiling through the ocean.",
      "How does a float move?":
        "Profiling floats can change their buoyancy to move vertically through different depth levels.",
      "Why are floats useful?":
        "Floats provide observations across large ocean areas and can operate for long periods with limited direct human intervention.",
    },
  },

  CTD: {
    title: "CTD",
    icon: "▥",
    subtitle: "Conductivity, Temperature and Depth",
    questions: [
      "What is CTD?",
      "What does a CTD measure?",
      "How does a CTD profile work?",
    ],
    answers: {
      "What is CTD?":
        "CTD stands for Conductivity, Temperature, and Depth. It is one of the standard instruments used for oceanographic profiling.",
      "What does a CTD measure?":
        "A CTD directly measures conductivity and temperature while determining pressure/depth. Conductivity can be used to derive salinity.",
      "How does a CTD profile work?":
        "A CTD package is lowered through the water column while its sensors continuously record measurements at different depths.",
    },
  },

  BGC: {
    title: "BGC",
    icon: "✣",
    subtitle: "Biogeochemical observations",
    questions: [
      "What is BGC?",
      "What does BGC-Argo measure?",
      "Why is biogeochemical data important?",
    ],
    answers: {
      "What is BGC?":
        "BGC refers to biogeochemical observations that describe chemical and biological properties of the ocean.",
      "What does BGC-Argo measure?":
        "BGC-Argo platforms can carry sensors for variables such as oxygen, chlorophyll fluorescence, nitrate, pH, and related ocean properties.",
      "Why is biogeochemical data important?":
        "Biogeochemical observations help scientists study marine ecosystems, ocean productivity, carbon cycling, and changes in ocean conditions.",
    },
  },

  Moorings: {
    title: "Moorings",
    icon: "⚓",
    subtitle: "Fixed ocean observing systems",
    questions: [
      "What is an ocean mooring?",
      "What do moorings measure?",
      "Why are moorings useful?",
    ],
    answers: {
      "What is an ocean mooring?":
        "An ocean mooring is a fixed observing system anchored to the seafloor with instruments positioned at selected depths.",
      "What do moorings measure?":
        "Depending on the deployment, moorings can measure temperature, salinity, currents, waves, pressure, oxygen, and other ocean variables.",
      "Why are moorings useful?":
        "Moorings provide continuous time-series observations at fixed locations, making them useful for monitoring changing ocean conditions.",
    },
  },

  "HF Radar": {
    title: "HF Radar",
    icon: "◉",
    subtitle: "Surface current observations",
    questions: [
      "What is HF Radar?",
      "What does HF Radar measure?",
      "Why is HF Radar useful?",
    ],
    answers: {
      "What is HF Radar?":
        "High-Frequency Radar is a remote sensing system used to observe ocean surface conditions from coastal locations.",
      "What does HF Radar measure?":
        "HF Radar can estimate near-surface ocean currents over coastal areas.",
      "Why is HF Radar useful?":
        "HF Radar provides spatially distributed surface-current observations that can complement measurements from in-situ instruments and models.",
    },
  },
};

/* ============================================================
   TEXT HELPERS
   ============================================================ */

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[?.,!;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ============================================================
   TOPIC ALIASES
   ============================================================ */

const TOPIC_ALIASES = {
  "Sea ice": [
    "sea ice",
    "ice",
    "frozen sea",
    "frozen ocean",
  ],

  Salinity: [
    "salinity",
    "salt",
    "salt content",
  ],

  Temperature: [
    "temperature",
    "heat",
    "warm",
    "cold",
    "thermocline",
  ],

  Currents: [
    "current",
    "currents",
    "water movement",
    "flow",
    "adcp",
  ],

  Chlorophyll: [
    "chlorophyll",
    "phytoplankton",
    "productivity",
    "ocean colour",
    "ocean color",
  ],

  Waves: [
    "wave",
    "waves",
    "wave height",
    "surface waves",
  ],

  Argo: [
    "argo",
    "argo float",
    "profiling float",
  ],

  Float: [
    "float",
    "ocean float",
    "profiling",
  ],

  CTD: [
    "ctd",
    "conductivity",
    "pressure",
    "depth profile",
  ],

  BGC: [
    "bgc",
    "biogeochemical",
    "oxygen",
    "nitrate",
    "ph",
  ],

  Moorings: [
    "mooring",
    "moorings",
    "anchored",
    "fixed observing",
  ],

  "HF Radar": [
    "hf radar",
    "high frequency radar",
    "radar",
    "surface current",
  ],
};

/* ============================================================
   LOCAL ANSWER ENGINE
   ============================================================ */

function detectTopicFromQuestion(
  question,
  currentTopic
) {
  const normalized =
    normalizeText(question);

  const currentAliases =
    TOPIC_ALIASES[currentTopic] || [];

  if (
    currentAliases.some((alias) =>
      normalized.includes(
        normalizeText(alias)
      )
    )
  ) {
    return currentTopic;
  }

  for (
    const [topic, aliases]
    of Object.entries(TOPIC_ALIASES)
  ) {
    const found = aliases.some(
      (alias) =>
        normalized.includes(
          normalizeText(alias)
        )
    );

    if (found) {
      return topic;
    }
  }

  return currentTopic;
}

function getLocalAnswer(
  question,
  currentTopic
) {
  const normalized =
    normalizeText(question);

  const detectedTopic =
    detectTopicFromQuestion(
      question,
      currentTopic
    );

  const topicData =
    EDUCATION_DATA[detectedTopic] ||
    EDUCATION_DATA.Temperature;

  /*
    Exact predefined question
  */

  for (
    const predefinedQuestion
    of topicData.questions
  ) {
    if (
      normalizeText(
        predefinedQuestion
      ) === normalized
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          predefinedQuestion
          ],
      };
    }
  }

  /*
    Temperature
  */

  if (
    detectedTopic ===
    "Temperature"
  ) {
    if (
      normalized.includes(
        "important"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why is it important?"
          ],
      };
    }

    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      ) ||
      normalized.includes(
        "sensor"
      ) ||
      normalized.includes(
        "satellite"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How is it measured?"
          ],
      };
    }

    if (
      normalized.includes(
        "depth"
      ) ||
      normalized.includes(
        "deep"
      ) ||
      normalized.includes(
        "thermocline"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How does temperature change with depth?"
          ],
      };
    }
  }

  /*
    Salinity
  */

  if (
    detectedTopic ===
    "Salinity"
  ) {
    if (
      normalized.includes(
        "important"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why is salinity important?"
          ],
      };
    }

    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      ) ||
      normalized.includes(
        "ctd"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How is salinity measured?"
          ],
      };
    }
  }

  /*
    Currents
  */

  if (
    detectedTopic ===
    "Currents"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      ) ||
      normalized.includes(
        "adcp"
      ) ||
      normalized.includes(
        "satellite"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How are currents measured?"
          ],
      };
    }

    if (
      normalized.includes(
        "important"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why are ocean currents important?"
          ],
      };
    }
  }

  /*
    Chlorophyll
  */

  if (
    detectedTopic ===
    "Chlorophyll"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      ) ||
      normalized.includes(
        "satellite"
      ) ||
      normalized.includes(
        "sensor"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How is chlorophyll measured?"
          ],
      };
    }

    if (
      normalized.includes(
        "tell"
      ) ||
      normalized.includes(
        "indicate"
      ) ||
      normalized.includes(
        "productivity"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What does chlorophyll tell us?"
          ],
      };
    }
  }

  /*
    Waves
  */

  if (
    detectedTopic ===
    "Waves"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      ) ||
      normalized.includes(
        "buoy"
      ) ||
      normalized.includes(
        "radar"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How are waves measured?"
          ],
      };
    }

    if (
      normalized.includes(
        "height"
      ) ||
      normalized.includes(
        "affect"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What affects wave height?"
          ],
      };
    }
  }

  /*
    Sea Ice
  */

  if (
    detectedTopic ===
    "Sea ice"
  ) {
    if (
      normalized.includes(
        "important"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why is sea ice important?"
          ],
      };
    }

    if (
      normalized.includes(
        "ocean"
      ) &&
      normalized.includes(
        "affect"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How does sea ice affect the ocean?"
          ],
      };
    }
  }

  /*
    Argo
  */

  if (
    detectedTopic === "Argo"
  ) {
    if (
      normalized.includes(
        "work"
      ) ||
      normalized.includes(
        "move"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How does an Argo float work?"
          ],
      };
    }

    if (
      normalized.includes(
        "data"
      ) ||
      normalized.includes(
        "collect"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What data does Argo collect?"
          ],
      };
    }
  }

  /*
    Float
  */

  if (
    detectedTopic ===
    "Float"
  ) {
    if (
      normalized.includes(
        "move"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How does a float move?"
          ],
      };
    }

    if (
      normalized.includes(
        "useful"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why are floats useful?"
          ],
      };
    }
  }

  /*
    CTD
  */

  if (
    detectedTopic === "CTD"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What does a CTD measure?"
          ],
      };
    }

    if (
      normalized.includes(
        "profile"
      ) ||
      normalized.includes(
        "work"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "How does a CTD profile work?"
          ],
      };
    }
  }

  /*
    BGC
  */

  if (
    detectedTopic === "BGC"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "oxygen"
      ) ||
      normalized.includes(
        "nitrate"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What does BGC-Argo measure?"
          ],
      };
    }

    if (
      normalized.includes(
        "important"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why is biogeochemical data important?"
          ],
      };
    }
  }

  /*
    Moorings
  */

  if (
    detectedTopic ===
    "Moorings"
  ) {
    if (
      normalized.includes(
        "measure"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What do moorings measure?"
          ],
      };
    }

    if (
      normalized.includes(
        "useful"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why are moorings useful?"
          ],
      };
    }
  }

  /*
    HF Radar
  */

  if (
    detectedTopic ===
    "HF Radar"
  ) {
    if (
      normalized.includes(
        "measure"
      ) ||
      normalized.includes(
        "measured"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "What does HF Radar measure?"
          ],
      };
    }

    if (
      normalized.includes(
        "useful"
      ) ||
      normalized.includes(
        "why"
      )
    ) {
      return {
        topic: detectedTopic,
        answer:
          topicData.answers[
          "Why is HF Radar useful?"
          ],
      };
    }
  }

  /*
    Generic fallback
  */

  return {
    topic: detectedTopic,
    answer:
      `I can explain ${topicData.title} using the predefined educational information. Try asking what it is, why it is important, how it is measured, or how it works.`,
  };
}

/* ============================================================
   VISUALIZATION
   ============================================================ */

const VISUAL_CONFIG = {
  "Sea ice": {
    palette: [
      [0, 20, 90],
      [10, 80, 180],
      [70, 170, 230],
      [180, 230, 250],
      [255, 255, 255],
    ],
    amplitude: 0.45,
    shift: 0.2,
    alpha: 105,
  },

  Salinity: {
    palette: [
      [30, 0, 150],
      [0, 90, 220],
      [0, 200, 255],
      [0, 230, 170],
      [255, 225, 80],
    ],
    amplitude: 0.55,
    shift: 0.1,
    alpha: 120,
  },

  Temperature: {
    palette: [
      [48, 0, 255],
      [0, 75, 255],
      [0, 210, 255],
      [0, 235, 120],
      [255, 235, 0],
      [255, 145, 0],
      [255, 30, 30],
    ],
    amplitude: 0.90,
    shift: 0.15,
    alpha: 150,
  },

  Currents: {
    palette: [
      [0, 15, 90],
      [0, 80, 190],
      [0, 200, 255],
      [255, 220, 60],
      [255, 60, 30],
    ],
    amplitude: 0.78,
    shift: 0.10,
    alpha: 110,
  },

  Chlorophyll: {
    palette: [
      [0, 20, 90],
      [0, 90, 180],
      [0, 190, 160],
      [80, 225, 80],
      [230, 235, 40],
    ],
    amplitude: 0.60,
    shift: 0.20,
    alpha: 115,
  },

  Waves: {
    palette: [
      [0, 15, 80],
      [0, 90, 190],
      [0, 205, 255],
      [130, 235, 255],
      [250, 255, 255],
    ],
    amplitude: 0.68,
    shift: 0.25,
    alpha: 100,
  },

  Argo: {
    palette: [
      [0, 30, 120],
      [0, 120, 220],
      [0, 220, 255],
      [255, 220, 60],
    ],
    amplitude: 0.50,
    shift: 0.15,
    alpha: 95,
  },

  Float: {
    palette: [
      [0, 30, 120],
      [0, 130, 230],
      [0, 220, 255],
      [255, 230, 80],
    ],
    amplitude: 0.50,
    shift: 0.18,
    alpha: 95,
  },

  CTD: {
    palette: [
      [20, 0, 120],
      [0, 90, 220],
      [0, 220, 255],
      [230, 245, 255],
    ],
    amplitude: 0.58,
    shift: 0.12,
    alpha: 100,
  },

  BGC: {
    palette: [
      [0, 20, 80],
      [0, 100, 170],
      [0, 210, 180],
      [100, 230, 80],
      [240, 230, 50],
    ],
    amplitude: 0.52,
    shift: 0.22,
    alpha: 105,
  },

  Moorings: {
    palette: [
      [0, 25, 100],
      [0, 100, 210],
      [0, 220, 255],
      [255, 215, 60],
    ],
    amplitude: 0.48,
    shift: 0.14,
    alpha: 95,
  },

  "HF Radar": {
    palette: [
      [0, 20, 90],
      [0, 100, 230],
      [0, 220, 255],
      [255, 200, 60],
      [255, 50, 40],
    ],
    amplitude: 0.72,
    shift: 0.20,
    alpha: 110,
  },
};

function getVisualConfig(topic) {
  return (
    VISUAL_CONFIG[topic] ||
    VISUAL_CONFIG.Temperature
  );
}

function interpolatePalette(
  palette,
  value
) {
  const clamped =
    Math.max(
      0,
      Math.min(1, value)
    );

  const scaled =
    clamped *
    (palette.length - 1);

  const index = Math.min(
    palette.length - 2,
    Math.floor(scaled)
  );

  const localT =
    scaled - index;

  const a =
    palette[index];

  const b =
    palette[index + 1];

  return [
    Math.round(
      a[0] +
      (b[0] - a[0]) *
      localT
    ),
    Math.round(
      a[1] +
      (b[1] - a[1]) *
      localT
    ),
    Math.round(
      a[2] +
      (b[2] - a[2]) *
      localT
    ),
  ];
}

/*
  This creates an educational visualization
  texture over the real Earth texture.
*/

function createVariableTexture(topic, earthTexture) {
  const config = getVisualConfig(topic);

  const canvas = document.createElement("canvas");

  const width = 1024;
  const height = 512;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  /*
    ------------------------------------------------------------
    READ THE ORIGINAL EARTH TEXTURE
    ------------------------------------------------------------
    We use the original Earth image to detect ocean pixels.
    The variable overlay will only have alpha on ocean.
  */

  const earthCanvas = document.createElement("canvas");

  earthCanvas.width = width;
  earthCanvas.height = height;

  const earthCtx = earthCanvas.getContext("2d");

  if (!earthCtx || !earthTexture?.image) {
    return null;
  }

  earthCtx.drawImage(
    earthTexture.image,
    0,
    0,
    width,
    height
  );

  const earthImage = earthCtx.getImageData(
    0,
    0,
    width,
    height
  );

  /*
    ------------------------------------------------------------
    CREATE VARIABLE IMAGE
    ------------------------------------------------------------
  */

  const image = ctx.createImageData(
    width,
    height
  );

  for (let y = 0; y < height; y += 1) {
    const latitude =
      90 -
      (y / (height - 1)) *
        180;

    const latitudeFactor =
      Math.cos(
        (latitude * Math.PI) / 180
      );

    for (let x = 0; x < width; x += 1) {
      const earthIndex =
        (y * width + x) * 4;

      const earthR =
        earthImage.data[earthIndex];

      const earthG =
        earthImage.data[
          earthIndex + 1
        ];

      const earthB =
        earthImage.data[
          earthIndex + 2
        ];

      /*
        --------------------------------------------------------
        OCEAN DETECTION

        Ocean is generally more blue than land.
        Land is generally green/brown.
        White clouds / ice are excluded.
        --------------------------------------------------------
      */

      const maxRGB = Math.max(
        earthR,
        earthG,
        earthB
      );

      const minRGB = Math.min(
        earthR,
        earthG,
        earthB
      );

      const saturation =
        maxRGB === 0
          ? 0
          : (maxRGB - minRGB) /
            maxRGB;

      const isBright =
        maxRGB > 225;

      const isBlueOcean =
        earthB > earthR * 1.08 &&
        earthB >= earthG * 0.95;

      /*
        White clouds / Antarctica / ice
        should remain original.
      */

      const isWhiteSurface =
        saturation < 0.12 &&
        isBright;

      /*
        Green/brown land is rejected.
      */

      const isLand =
        earthG > earthB * 1.03 &&
        earthR > earthB * 1.03;

      /*
        Final ocean test.
      */

      const isOcean =
        isBlueOcean &&
        !isWhiteSurface &&
        !isLand;

      /*
        --------------------------------------------------------
        DEFAULT TRANSPARENT
        --------------------------------------------------------
      */

      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;

      if (isOcean) {
        const longitude =
          (x / (width - 1)) *
            360 -
          180;

        /*
          Educational variable field
        */

        let value =
          0.50 +
          latitudeFactor *
            0.32 *
            config.amplitude;

        value +=
          Math.sin(
            ((longitude +
              config.shift * 180) *
              Math.PI) /
              70
          ) * 0.12;

        value +=
          Math.sin(
            ((latitude - 12) *
              Math.PI) /
              32
          ) * 0.08;

        value +=
          Math.sin(
            ((longitude + latitude) *
              Math.PI) /
              42
          ) * 0.05;

        /*
          Cooler polar ocean.
        */

        if (
          Math.abs(latitude) > 60
        ) {
          value *= 0.38;
        }

        if (
          Math.abs(latitude) > 75
        ) {
          value *= 0.20;
        }

        value = Math.max(
          0,
          Math.min(1, value)
        );

        const color =
          interpolatePalette(
            config.palette,
            value
          );

        r = color[0];
        g = color[1];
        b = color[2];

        /*
          Only ocean gets opacity.
        */

        alpha = config.alpha;
      }

      const index =
        (y * width + x) * 4;

      image.data[index] = r;
      image.data[
        index + 1
      ] = g;

      image.data[
        index + 2
      ] = b;

      image.data[
        index + 3
      ] = alpha;
    }
  }

  ctx.putImageData(
    image,
    0,
    0
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  texture.needsUpdate = true;

  return texture;
}

/* ============================================================
   OCEAN GLOBE
   ============================================================ */

function OceanGlobe({
  activeTopic,
  onGlobeClick,
}) {
  const earthTexture =
    useLoader(
      THREE.TextureLoader,
      "/textures/earth_atmos_2048.jpg"
    );

const variableTexture =
  useMemo(() => {
    return createVariableTexture(
      activeTopic,
      earthTexture
    );
  }, [activeTopic, earthTexture]);

  return (
    <group
      rotation={[
        0.05,
        -0.45,
        0,
      ]}
    >
      {/* Invisible clickable sphere */}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onGlobeClick();
        }}
      >
        <sphereGeometry
          args={[
            2.60,
            128,
            96,
          ]}
        />

        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Real Earth */}
      <mesh>
        <sphereGeometry
          args={[
            2.55,
            128,
            96,
          ]}
        />

        <meshStandardMaterial
          map={earthTexture}
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>

      {/* Selected variable visualization */}
      {variableTexture && (
        <mesh scale={1.006}>
          <sphereGeometry
            args={[
              2.55,
              128,
              96,
            ]}
          />

          <meshBasicMaterial
            map={variableTexture}
            transparent
            opacity={0.58}
            side={THREE.FrontSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Atmosphere */}
      <mesh scale={1.045}>
        <sphereGeometry
          args={[
            2.55,
            96,
            64,
          ]}
        />

        <meshBasicMaterial
          color="#1ba9ff"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          blending={
            THREE.AdditiveBlending
          }
        />
      </mesh>

      {/* Argo marker */}
      <group
        position={[
          0.75,
          2.35,
          0.95,
        ]}
      >
        <mesh>
          <cylinderGeometry
            args={[
              0.055,
              0.055,
              0.55,
              16,
            ]}
          />

          <meshStandardMaterial
            color="#ffd000"
            emissive="#ffae00"
            emissiveIntensity={0.65}
          />
        </mesh>

        <mesh
          position={[
            0,
            0.32,
            0,
          ]}
        >
          <sphereGeometry
            args={[
              0.08,
              20,
              20,
            ]}
          />

          <meshBasicMaterial
            color="#ffd000"
          />
        </mesh>
      </group>

      {/* Glider */}
      <group
        position={[
          -1.25,
          0.55,
          1.65,
        ]}
        rotation={[
          0,
          0.3,
          -0.35,
        ]}
      >
        <mesh>
          <capsuleGeometry
            args={[
              0.09,
              0.55,
              8,
              20,
            ]}
          />

          <meshStandardMaterial
            color="#ffd000"
            emissive="#a87800"
            emissiveIntensity={0.35}
          />
        </mesh>

        <mesh
          position={[
            0,
            -0.2,
            0,
          ]}
        >
          <coneGeometry
            args={[
              0.11,
              0.25,
              16,
            ]}
          />

          <meshStandardMaterial
            color="#d5a900"
          />
        </mesh>
      </group>

      {/* CTD */}
      <mesh
        position={[
          1.62,
          -0.35,
          1.45,
        ]}
      >
        <sphereGeometry
          args={[
            0.07,
            20,
            20,
          ]}
        />

        <meshBasicMaterial
          color="#d9e8ff"
        />
      </mesh>
    </group>
  );
}

/* ============================================================
   EDUCATION SCENE
   ============================================================ */

function EducationScene({
  activeTopic,
  onGlobeClick,
}) {
  return (
    <>
      <color
        attach="background"
        args={["#000000"]}
      />

      <Stars
        radius={70}
        depth={35}
        count={2500}
        factor={2}
        saturation={0}
        fade
        speed={0.25}
      />

      <ambientLight
        intensity={1.3}
      />

      <directionalLight
        position={[
          5,
          5,
          5,
        ]}
        intensity={2.5}
      />

      <pointLight
        position={[
          -5,
          2,
          5,
        ]}
        intensity={1.5}
        color="#168dff"
      />

      <PerspectiveCamera
        makeDefault
        position={[
          0,
          0,
          8,
        ]}
        fov={42}
      />

      <OceanGlobe
        activeTopic={
          activeTopic
        }
        onGlobeClick={
          onGlobeClick
        }
      />

      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={11}
        enableDamping
        dampingFactor={0.04}
      />
    </>
  );
}

/* ============================================================
   CHATBOT
   ============================================================ */

function EducationChatbot({
  topic,
  onClose,
}) {
  const data =
    EDUCATION_DATA[topic] ||
    EDUCATION_DATA.Temperature;

  const [selectedQuestion, setSelectedQuestion] =
    useState(null);

  const [userQuestion, setUserQuestion] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const askQuestion = (
    question
  ) => {
    const cleanQuestion =
      String(question || "").trim();

    if (!cleanQuestion) {
      return;
    }

    const result =
      getLocalAnswer(
        cleanQuestion,
        topic
      );

    setSelectedQuestion(
      cleanQuestion
    );

    setMessages(
      (previous) => [
        ...previous,
        {
          type: "user",
          text: cleanQuestion,
        },
        {
          type: "assistant",
          text: result.answer,
          topic: result.topic,
        },
      ]
    );
  };

  const submitQuestion =
    (event) => {
      event.preventDefault();

      const question =
        userQuestion.trim();

      if (!question) {
        return;
      }

      askQuestion(question);

      setUserQuestion("");
    };

  return (
    <div
      className="education-chatbot-overlay"
      style={{
        position: "absolute",
        top: "110px",
        right: "25px",
        bottom: "60px",
        width: "360px",
        zIndex: 100,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-end",
        background:
          "transparent",
        pointerEvents: "auto",
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className="education-chatbot"
        style={{
          width: "100%",
          height: "100%",
          maxHeight: "none",
        }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {/* HEADER */}

        <div className="chatbot-header">
          <div>
            <span className="chatbot-status-dot" />

            Ocean Education Assistant
          </div>

          <button
            type="button"
            className="chatbot-close"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="Close chatbot"
          >
            ×
          </button>
        </div>

        {/* TOPIC */}

        <div className="chatbot-topic">
          <span className="chatbot-topic-icon">
            {data.icon}
          </span>

          <div>
            <strong>
              {data.title}
            </strong>

            <small>
              {data.subtitle}
            </small>
          </div>
        </div>

        {/* INTRODUCTION */}

        <div className="chatbot-introduction">
          Hi! I can help you learn about{" "}
          <strong>
            {data.title}
          </strong>
          .
          <br />
          {/* Choose a predefined question
          or type your own question. */}
        </div>

        {/* PREDEFINED QUESTIONS */}

        <div className="chatbot-questions">
          {data.questions.map(
            (question) => (
              <button
                type="button"
                key={question}
                className={
                  selectedQuestion ===
                    question
                    ? "chatbot-question selected"
                    : "chatbot-question"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  askQuestion(
                    question
                  );
                }}
              >
                {question}
              </button>
            )
          )}
        </div>

        {/* CHAT HISTORY */}

        {messages.length >
          0 && (
            <div className="chatbot-messages">
              {messages.map(
                (
                  message,
                  index
                ) => (
                  <div
                    key={`${message.type}-${index}`}
                    className={
                      message.type ===
                        "user"
                        ? "chat-message user"
                        : "chat-message assistant"
                    }
                  >
                    <div className="chat-message-label">
                      {message.type ===
                        "user"
                        ? "You"
                        : "Ocean Assistant"}
                    </div>

                    <div className="chat-message-text">
                      {message.text}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        {/* TEXT INPUT */}

        <form
          className="chatbot-input-area"
          onSubmit={
            submitQuestion
          }
        >
          <input
            type="text"
            value={
              userQuestion
            }
            onChange={(
              event
            ) =>
              setUserQuestion(
                event.target.value
              )
            }
            placeholder="Ask about the ocean..."
            aria-label="Ask a question"
          />

          <button
            type="submit"
            disabled={
              !userQuestion.trim()
            }
          >
            Send
          </button>
        </form>

        {/* FOOTER */}

        <div className="chatbot-footer">
          <span>
            {/* Predefined educational knowledge */}
          </span>

          <span>
            {/* ● Offline */}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   EDUCATION PAGE
   ============================================================ */

export default function Education() {
  const [activeTopic, setActiveTopic] =
    useState("Temperature");

  const [chatbotOpen, setChatbotOpen] =
    useState(false);

  const openChatbot = () => {
    setChatbotOpen(true);
  };

  const closeChatbot = () => {
    setChatbotOpen(false);
  };

  return (
    <div className="education-page">
      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="education-header">
        <div className="education-brand">
          <div className="education-incois">
            INCOIS
          </div>

          <div className="education-brand-divider" />

          <div className="education-brand-title">
            <strong>
              OCEAN DATA
            </strong>

            <span>
              VISUALIZATION SYSTEM
            </span>
          </div>

          <button
            type="button"
            className="education-info"
            onClick={(event) => {
              /*
                Header info does not open
                the chatbot. Globe only.
              */
              event.stopPropagation();
            }}
            aria-label="Information"
          >
            i
          </button>
        </div>

        <div className="education-partners">
          <span className="moes-symbol">
            ◈
          </span>

          <div>
            <strong>
              Ministry of Earth Sciences
            </strong>

            <small>
              Government of India
            </small>
          </div>
        </div>
      </header>

      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="education-main">
        {/* ==================================================
            LEFT LAYERS
        ================================================== */}

        <aside className="education-left-panel">
          {[
            "Sea ice",
            "Salinity",
            "Temperature",
            "Currents",
            "Chlorophyll",
            "Waves",
          ].map((item) => {
            const data =
              EDUCATION_DATA[item];

            return (
              <button
                type="button"
                key={item}
                className={
                  activeTopic ===
                    item
                    ? "education-layer active"
                    : "education-layer"
                }
                onClick={(event) => {
                  event.stopPropagation();

                  /*
                    IMPORTANT:
                    Layer click only changes
                    the selected variable.
                    It does NOT open chatbot.
                  */

                  setActiveTopic(
                    item
                  );
                }}
              >
                <span className="layer-icon">
                  {data.icon}
                </span>

                <span className="layer-content">
                  <strong>
                    {data.title}
                  </strong>

                  <small>
                    {data.subtitle}
                  </small>
                </span>

                <span
                  className="layer-info"
                  onClick={(event) => {
                    event.stopPropagation();

                    /*
                      Info icon also only
                      selects the layer.
                    */
                    setActiveTopic(
                      item
                    );
                  }}
                >
                  i
                </span>
              </button>
            );
          })}
        </aside>

        {/* ==================================================
            CENTER GLOBE
        ================================================== */}

        <section className="education-center">
          <div className="education-globe">
            <Canvas
              dpr={[1, 2]}
              gl={{
                antialias: true,
                alpha: false,
              }}
            >
              <EducationScene
                activeTopic={
                  activeTopic
                }
                onGlobeClick={
                  openChatbot
                }
              />
            </Canvas>
          </div>

          {/* LOCATION */}

          <div className="education-location">
            <span className="location-pin">
              ●
            </span>

            <span>
              Lat&nbsp;&nbsp;
              <strong>
                17.856° N
              </strong>
            </span>

            <span>
              Long&nbsp;&nbsp;
              <strong>
                86.412° E
              </strong>
            </span>

            <button
              type="button"
              className="location-info"
              onClick={(event) => {
                event.stopPropagation();
              }}
              aria-label="Location information"
            >
              i
            </button>
          </div>

          {/* DID YOU KNOW */}

          <div className="did-you-know">
            <div className="did-you-know-title">
              <span>
                ♧
              </span>

              Did you know?

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                aria-label="Did you know information"
              >
                i
              </button>
            </div>

            <p>
              Warmer waters can affect
              marine life and climate
              patterns.
            </p>
          </div>
        </section>

        {/* ==================================================
            RIGHT PANEL
            FIXED REFERENCE CONTENT
        ================================================== */}

        <aside className="education-right-panel">
          <div className="temperature-info-card">
            <div className="info-card-header">
              <strong>
                Temperature
              </strong>

              <button
                type="button"
                onClick={(event) => {
                  /*
                    Keep reference UI.
                    It does not open chatbot.
                  */
                  event.stopPropagation();
                }}
                aria-label="Temperature information"
              >
                ×
              </button>
            </div>

            <div className="info-section">
              <h4>
                What is it?
              </h4>

              <p>
                Temperature is a measure
                of how warm or cold the
                ocean water is.
              </p>
            </div>

            <div className="info-section">
              <h4>
                Why is it important?
              </h4>

              <p>
                It affects ocean currents,
                marine life, weather, and
                climate patterns.
              </p>
            </div>

            <div className="info-section">
              <h4>
                How is it measured?
              </h4>

              <p>
                Using satellites, sensors,
                and underwater devices that
                record temperature at
                different depths.
              </p>
            </div>

            <div className="info-section">
              <h4>
                In this visualization
              </h4>

              <p>
                Colors show the selected
                ocean variable on the
                globe. Select a layer on
                the left, then click the
                globe to open the education
                assistant.
              </p>
            </div>

            <button
              type="button"
              className="learn-more-button"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              Learn more
              <span>
                ↗
              </span>
            </button>
          </div>

          {/* COLOR SCALE */}

          <div className="education-color-scale">
            <div className="color-scale-title">
              {activeTopic ===
                "Temperature"
                ? "Temperature (°C)"
                : activeTopic}
            </div>

            <div className="temperature-gradient" />

            <div className="temperature-values">
              <span>
                0.0
              </span>

              <span>
                10.0
              </span>

              <span>
                20.0
              </span>

              <span>
                30.0
              </span>
            </div>
          </div>

          {/* ==================================================
              INSTRUMENTS
          ================================================== */}

          <div className="education-instruments">
            {[
              "Argo",
              "Float",
              "CTD",
              "BGC",
              "Moorings",
              "HF Radar",
            ].map((item) => {
              const data =
                EDUCATION_DATA[item];

              return (
                <button
                  type="button"
                  className={
                    activeTopic ===
                      item
                      ? "education-instrument selected"
                      : "education-instrument"
                  }
                  key={item}
                  onClick={(event) => {
                    event.stopPropagation();

                    /*
                      Instrument selection
                      changes the active topic.
                      Chatbot does not open.
                    */
                    setActiveTopic(
                      item
                    );
                  }}
                >
                  <span className="instrument-radio" />

                  <span className="instrument-icon">
                    {data.icon}
                  </span>

                  <span className="instrument-name">
                    {item}
                  </span>

                  <span
                    className="instrument-info"
                    onClick={(event) => {
                      event.stopPropagation();

                      setActiveTopic(
                        item
                      );
                    }}
                  >
                    i
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </main>

      {/* ==================================================
          BOTTOM CONTROLS
      ================================================== */}

      <footer className="education-footer">
        <button
          type="button"
          className="education-credit-button"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          CREDITS
        </button>

        <div className="education-play-controls">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
            aria-label="Previous"
          >
            |◀
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
            aria-label="Pause"
          >
            ❚❚
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
            aria-label="Next"
          >
            ▶|
          </button>
        </div>

        <div className="education-timeline">
          <div className="timeline-current-date">
            07/26/2026
          </div>

          <div className="timeline-line">
            <span />
          </div>

          <div className="timeline-months">
            <span>Sep</span>
            <span>Oct</span>
            <span>Nov</span>
            <span>Dec</span>
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
          </div>

          <div className="timeline-years">
            <span>2025</span>
            <span>2026</span>
          </div>
        </div>

        <div className="education-quality">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            HD
          </button>

          <button
            type="button"
            className="active"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            3D
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            SD
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            2D
          </button>
        </div>
      </footer>

      {/* ==================================================
          BOTTOM MESSAGE
      ================================================== */}

      <div className="education-bottom-message">
        <span>
          ♧
        </span>

        <span>
          Click on the globe to learn
          more about the selected
          ocean variable!
        </span>

        <button
          type="button"
          onClick={(event) => {
            /*
              Globe is the main
              chatbot trigger.
              This button remains
              informational only.
            */
            event.stopPropagation();
          }}
          aria-label="Information"
        >
          i
        </button>
      </div>

      {/* ==================================================
          CHATBOT
      ================================================== */}

      {chatbotOpen && (
        <EducationChatbot
          key={activeTopic}
          topic={activeTopic}
          onClose={
            closeChatbot
          }
        />
      )}
    </div>
  );
}