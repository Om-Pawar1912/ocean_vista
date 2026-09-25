from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import xarray as xr


# =========================================================
# NAME MATCHING
# =========================================================

LATITUDE_NAMES = [
    "latitude",
    "lat",
    "LATITUDE",
    "LAT",
    "nav_lat",
]

LONGITUDE_NAMES = [
    "longitude",
    "lon",
    "LONGITUDE",
    "LON",
    "nav_lon",
]

DEPTH_NAMES = [
    "depth",
    "DEPTH",
    "pressure",
    "pres",
    "depth_m",
    "depths",
]

TIME_NAMES = [
    "time",
    "TIME",
    "datetime",
    "date",
    "timestamp",
]

INSTRUMENT_NAMES = [
    "instrument_id",
    "instrument",
    "platform_number",
    "platform",
    "wmo",
    "wmo_id",
    "float_id",
    "float",
    "profile_id",
    "profile",
    "id",
]


# =========================================================
# VARIABLE ALIASES
# =========================================================

VARIABLE_ALIASES = {
    "temperature": [
        "temperature",
        "temp",
        "TEMP",
        "TEMP_ADJUSTED",
        "sea_water_temperature",
        "thetao",
    ],

    "salinity": [
        "salinity",
        "salt",
        "PSAL",
        "PSAL_ADJUSTED",
        "sea_water_salinity",
        "so",
    ],

    "chlorophyll": [
        "chlorophyll",
        "chl",
        "CHLA",
        "CHLA_ADJUSTED",
        "chlor_a",
    ],

    "oxygen": [
        "oxygen",
        "dissolved_oxygen",
        "DOXY",
        "DOXY_ADJUSTED",
        "o2",
    ],

    "current_u": [
        "u",
        "uo",
        "current_u",
        "eastward_velocity",
        "eastward_current",
    ],

    "current_v": [
        "v",
        "vo",
        "current_v",
        "northward_velocity",
        "northward_current",
    ],

    "density": [
        "density",
        "rho",
        "sea_water_density",
    ],

    "nutrients": [
        "nutrient",
        "nutrients",
    ],

    "nitrate": [
        "nitrate",
        "nitrates",
        "NO3",
        "NO3_ADJUSTED",
    ],

    "bathymetry": [
        "bathymetry",
        "elevation",
        "depth_bathymetry",
    ],

    "sea_surface_height": [
        "sea_surface_height",
        "ssh",
        "zos",
    ],
}


# =========================================================
# GENERAL HELPERS
# =========================================================

def clean_name(name: str) -> str:
    """
    Normalize a variable/column name.

    Examples:

        Sea Water Temperature -> sea_water_temperature
        TEMP-ADJUSTED         -> temp_adjusted
    """

    return (
        str(name)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def find_column(
    columns,
    candidates,
) -> Optional[str]:
    """
    Find a dataframe column using exact normalized matching.
    """

    normalized = {
        clean_name(column): column
        for column in columns
    }

    # Exact matching only.
    for candidate in candidates:

        key = clean_name(candidate)

        if key in normalized:
            return normalized[key]

    return None


def find_variable(
    variables,
    candidates,
) -> Optional[str]:
    """
    Find a NetCDF variable safely.

    Exact matching is preferred.

    Partial matching is allowed only for aliases
    with length >= 4.

    This prevents:

        u -> temperature

    which was the previous bug.
    """

    normalized = {
        clean_name(variable): variable
        for variable in variables
    }

    # -----------------------------------------------------
    # 1. Exact match
    # -----------------------------------------------------

    for candidate in candidates:

        key = clean_name(candidate)

        if key in normalized:
            return normalized[key]

    # -----------------------------------------------------
    # 2. Safe partial matching
    # -----------------------------------------------------

    for candidate in candidates:

        candidate_clean = clean_name(candidate)

        # Never partially match very short aliases
        # such as "u", "v", "so", "o2".
        if len(candidate_clean) < 4:
            continue

        for variable in variables:

            variable_clean = clean_name(variable)

            if (
                candidate_clean in variable_clean
                or variable_clean in candidate_clean
            ):
                return variable

    return None


def safe_float(value) -> Optional[float]:
    """
    Convert value to float safely.
    """

    try:

        if value is None:
            return None

        if pd.isna(value):
            return None

        return float(value)

    except Exception:

        return None


def safe_string(value) -> Optional[str]:
    """
    Convert value to string safely.
    """

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    return str(value)


def serialize_time(value) -> Optional[str]:
    """
    Convert NetCDF/Pandas time to ISO string.
    """

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    try:

        return pd.Timestamp(value).isoformat()

    except Exception:

        return str(value)


# =========================================================
# VARIABLE METADATA
# =========================================================

def get_variable_info_from_xarray(
    dataset: xr.Dataset,
) -> List[Dict[str, Any]]:
    """
    Return metadata for actual NetCDF data variables.
    """

    result = []

    for name, data_array in dataset.data_vars.items():

        attrs = dict(
            data_array.attrs
        )

        result.append(
            {
                "name": name,

                "dimensions": list(
                    data_array.dims
                ),

                "shape": list(
                    data_array.shape
                ),

                "dtype": str(
                    data_array.dtype
                ),

                "units": attrs.get(
                    "units"
                ),

                "long_name": attrs.get(
                    "long_name"
                ),
            }
        )

    return result


# =========================================================
# PROFILE DIMENSION DETECTION
# =========================================================

def detect_profile_dimension(
    dataset: xr.Dataset,
    lat_name: Optional[str],
    lon_name: Optional[str],
    instrument_name: Optional[str],
) -> Optional[str]:
    """
    Detect dimension representing profiles.

    Example:

        profile = 5
        depth   = 7

    returns:

        profile
    """

    candidates = []

    if lat_name:

        candidates.extend(
            list(
                dataset[
                    lat_name
                ].dims
            )
        )

    if lon_name:

        candidates.extend(
            list(
                dataset[
                    lon_name
                ].dims
            )
        )

    if instrument_name:

        candidates.extend(
            list(
                dataset[
                    instrument_name
                ].dims
            )
        )

    preferred = [
        "profile",
        "profiles",
        "nprof",
        "N_PROF",
        "trajectory",
        "obs",
        "station",
    ]

    for name in preferred:

        if name in dataset.dims:

            return name

    for name in candidates:

        if name in dataset.dims:

            size = dataset.sizes.get(
                name,
                0,
            )

            if size > 0:

                return name

    return None


# =========================================================
# DEPTH EXTRACTION
# =========================================================

def extract_depth_values(
    dataset: xr.Dataset,
) -> List[Optional[float]]:
    """
    Extract common depth levels.

    Example:

        [0, 50, 100, 200, 500, 1000, 2000]
    """

    depth_name = find_variable(
        dataset.variables,
        DEPTH_NAMES,
    )

    if depth_name is None:

        return []

    try:

        values = np.asarray(
            dataset[
                depth_name
            ].values
        )

        values = np.squeeze(
            values
        )

        # Scalar
        if values.ndim == 0:

            value = safe_float(
                values.item()
            )

            if value is None:

                return []

            return [value]

        # Normal 1D depth
        if values.ndim == 1:

            return [
                safe_float(value)
                for value in values
            ]

        # Multidimensional depth
        values = values.reshape(
            values.shape[0],
            -1,
        )

        return [
            safe_float(value)
            for value in values[0]
        ]

    except Exception:

        return []


# =========================================================
# PROFILE VALUE
# =========================================================

def extract_profile_value(
    data_array: xr.DataArray,
    profile_index: int,
    profile_dimension: Optional[str],
):
    """
    Extract one profile-level value.

    Used for:

        latitude
        longitude
        time
        float_id
    """

    try:

        data = data_array

        if (
            profile_dimension
            and profile_dimension in data.dims
        ):

            data = data.isel(
                {
                    profile_dimension:
                    profile_index
                }
            )

        values = np.asarray(
            data.values
        )

        values = np.squeeze(
            values
        )

        if values.ndim == 0:

            return values.item()

        flat = values.flatten()

        if len(flat) == 0:

            return None

        return flat[0]

    except Exception:

        return None


# =========================================================
# PROFILE NUMERIC ARRAY
# =========================================================

def extract_profile_array(
    data_array: xr.DataArray,
    profile_index: int,
    profile_dimension: Optional[str],
    depth_dimension: Optional[str],
) -> List[Optional[float]]:
    """
    Extract complete depth profile.

    Example:

        temperature(profile, depth)

    becomes:

        temperature[profile_index][depth]
    """

    try:

        data = data_array

        # -------------------------------------------------
        # Select profile
        # -------------------------------------------------

        if (
            profile_dimension
            and profile_dimension in data.dims
        ):

            data = data.isel(
                {
                    profile_dimension:
                    profile_index
                }
            )

        # -------------------------------------------------
        # Keep depth dimension
        # -------------------------------------------------

        if (
            depth_dimension
            and depth_dimension in data.dims
        ):

            other_dims = [
                dim
                for dim in data.dims
                if dim != depth_dimension
            ]

            if other_dims:

                data = data.transpose(
                    *other_dims,
                    depth_dimension,
                )

            values = np.asarray(
                data.values
            )

            values = np.squeeze(
                values
            )

            while values.ndim > 1:

                values = values[0]

            if values.ndim == 0:

                value = safe_float(
                    values
                )

                if value is None:

                    return []

                return [value]

            return [
                safe_float(value)
                for value in values
            ]

        # -------------------------------------------------
        # No depth dimension
        # -------------------------------------------------

        value = extract_profile_value(
            data_array,
            profile_index,
            profile_dimension,
        )

        value = safe_float(
            value
        )

        if value is None:

            return []

        return [value]

    except Exception:

        return []


# =========================================================
# INSTRUMENT TYPE
# =========================================================

def detect_instrument_type(
    dataset: xr.Dataset,
) -> str:
    """
    Detect instrument type from NetCDF metadata.
    """

    text_parts = []

    for key, value in dataset.attrs.items():

        text_parts.append(
            str(key)
        )

        text_parts.append(
            str(value)
        )

    for name in dataset.variables:

        text_parts.append(
            str(name)
        )

    text = " ".join(
        text_parts
    ).lower()

    if "glider" in text:

        return "GLIDER"

    if "ctd" in text:

        return "CTD"

    if "bgc" in text:

        return "BGC"

    if "moor" in text:

        return "MOORING"

    return "ARGO"


# =========================================================
# LONGITUDE NORMALIZATION
# =========================================================

def normalize_longitude(
    longitude: float,
) -> float:
    """
    Convert longitude to [-180, 180].
    """

    longitude = float(
        longitude
    )

    while longitude > 180:

        longitude -= 360

    while longitude < -180:

        longitude += 360

    return longitude


# =========================================================
# NETCDF INSTRUMENT EXTRACTION
# =========================================================

def extract_netcdf_instruments(
    dataset: xr.Dataset,
) -> List[Dict[str, Any]]:
    """
    Extract instruments/profiles from NetCDF.

    Example:

        profile = 5
        depth   = 7

        temperature(profile, depth)
        salinity(profile, depth)

    Result:

        5 instruments

    Each instrument contains the complete
    7-point depth profile.
    """

    variables = list(
        dataset.variables
    )

    # -----------------------------------------------------
    # Coordinates
    # -----------------------------------------------------

    lat_name = find_variable(
        variables,
        LATITUDE_NAMES,
    )

    lon_name = find_variable(
        variables,
        LONGITUDE_NAMES,
    )

    depth_name = find_variable(
        variables,
        DEPTH_NAMES,
    )

    time_name = find_variable(
        variables,
        TIME_NAMES,
    )

    instrument_name = find_variable(
        variables,
        INSTRUMENT_NAMES,
    )

    if (
        lat_name is None
        or lon_name is None
    ):

        raise ValueError(
            "Dataset must contain latitude and longitude."
        )

    # -----------------------------------------------------
    # Profile dimension
    # -----------------------------------------------------

    profile_dimension = (
        detect_profile_dimension(
            dataset,
            lat_name,
            lon_name,
            instrument_name,
        )
    )

    if profile_dimension is None:

        raise ValueError(
            "Could not detect profile dimension."
        )

    # -----------------------------------------------------
    # Depth dimension
    # -----------------------------------------------------

    depth_dimension = None

    if depth_name:

        depth_dims = list(
            dataset[
                depth_name
            ].dims
        )

        if depth_dims:

            for dim in depth_dims:

                if clean_name(dim) in {
                    "depth",
                    "depths",
                    "pressure",
                    "pres",
                }:

                    depth_dimension = dim

                    break

            if depth_dimension is None:

                depth_dimension = (
                    depth_dims[-1]
                )

    # -----------------------------------------------------
    # Depth levels
    # -----------------------------------------------------

    depth_values = (
        extract_depth_values(
            dataset
        )
    )

    # -----------------------------------------------------
    # Profile count
    # -----------------------------------------------------

    profile_count = int(
        dataset.sizes[
            profile_dimension
        ]
    )

    # -----------------------------------------------------
    # Instrument type
    # -----------------------------------------------------

    instrument_type = (
        detect_instrument_type(
            dataset
        )
    )

    instruments = []

    # =====================================================
    # PROFILE LOOP
    # =====================================================

    for profile_index in range(
        profile_count
    ):

        # -------------------------------------------------
        # Latitude
        # -------------------------------------------------

        latitude_raw = (
            extract_profile_value(
                dataset[lat_name],
                profile_index,
                profile_dimension,
            )
        )

        latitude = safe_float(
            latitude_raw
        )

        # -------------------------------------------------
        # Longitude
        # -------------------------------------------------

        longitude_raw = (
            extract_profile_value(
                dataset[lon_name],
                profile_index,
                profile_dimension,
            )
        )

        longitude = safe_float(
            longitude_raw
        )

        if (
            latitude is None
            or longitude is None
        ):

            continue

        if abs(latitude) > 90:

            continue

        if abs(longitude) > 360:

            continue

        longitude = normalize_longitude(
            longitude
        )

        # -------------------------------------------------
        # Instrument ID
        # -------------------------------------------------

        instrument_id = None

        if instrument_name:

            try:

                instrument_data = (
                    dataset[
                        instrument_name
                    ]
                )

                raw_id = (
                    extract_profile_value(
                        instrument_data,
                        profile_index,
                        profile_dimension,
                    )
                )

                instrument_id = (
                    safe_string(
                        raw_id
                    )
                )

            except Exception:

                instrument_id = None

        if not instrument_id:

            instrument_id = (
                f"PROFILE-{profile_index + 1:05d}"
            )

        # -------------------------------------------------
        # Time
        # -------------------------------------------------

        timestamp = None

        if time_name:

            try:

                raw_time = (
                    extract_profile_value(
                        dataset[time_name],
                        profile_index,
                        profile_dimension,
                    )
                )

                timestamp = (
                    serialize_time(
                        raw_time
                    )
                )

            except Exception:

                timestamp = None

        # =================================================
        # PROFILE VARIABLES
        # =================================================

        profile_variables = {}

        for (
            standard_name,
            aliases,
        ) in VARIABLE_ALIASES.items():

            variable_name = find_variable(
                dataset.data_vars,
                aliases,
            )

            if variable_name is None:

                continue

            try:

                data_array = dataset[
                    variable_name
                ]

                values = extract_profile_array(
                    data_array=data_array,
                    profile_index=profile_index,
                    profile_dimension=profile_dimension,
                    depth_dimension=depth_dimension,
                )

                if values:

                    profile_variables[
                        standard_name
                    ] = values

            except Exception:

                continue

        # =================================================
        # MARKER VALUES
        # =================================================

        marker_values = {}

        for (
            variable_name,
            values,
        ) in profile_variables.items():

            for value in values:

                if value is not None:

                    marker_values[
                        variable_name
                    ] = value

                    break

        # -------------------------------------------------
        # Marker depth
        # -------------------------------------------------

        marker_depth = None

        if depth_values:

            marker_depth = depth_values[0]

        # =================================================
        # CREATE INSTRUMENT
        # =================================================

        instrument = {

            "id": instrument_id,

            "type": instrument_type,

            "latitude": latitude,

            "longitude": longitude,

            "depth": marker_depth,

            "time": timestamp,

            "status": "Active",

            "values": marker_values,

            "profile": {

                "depth": depth_values,

                "variables": profile_variables,

            },

        }

        instruments.append(
            instrument
        )

    return instruments


# =========================================================
# NETCDF PARSER
# =========================================================

def parse_netcdf(
    file_path: Path,
) -> Dict[str, Any]:
    """
    Parse NetCDF/CDF dataset.
    """

    dataset = xr.open_dataset(
        file_path,
        decode_times=True,
    )

    try:

        variables = (
            get_variable_info_from_xarray(
                dataset
            )
        )

        instruments = (
            extract_netcdf_instruments(
                dataset
            )
        )

        dimensions = {

            name: int(size)

            for name, size
            in dataset.sizes.items()

        }

        attributes = {

            str(key): str(value)

            for key, value
            in dataset.attrs.items()

        }

        return {

            "dimensions": dimensions,

            "variables": variables,

            "instruments": instruments,

            "attributes": attributes,

        }

    finally:

        dataset.close()


# =========================================================
# CSV / TXT HELPERS
# =========================================================

def read_tabular_file(
    file_path: Path,
) -> pd.DataFrame:
    """
    Read CSV/TXT data.
    """

    suffix = (
        file_path.suffix.lower()
    )

    # -----------------------------------------------------
    # CSV
    # -----------------------------------------------------

    if suffix == ".csv":

        return pd.read_csv(
            file_path
        )

    # -----------------------------------------------------
    # Try comma separated
    # -----------------------------------------------------

    try:

        return pd.read_csv(
            file_path
        )

    except Exception:

        pass

    # -----------------------------------------------------
    # Try whitespace separated
    # -----------------------------------------------------

    try:

        return pd.read_csv(
            file_path,
            sep=r"\s+",
            engine="python",
        )

    except Exception:

        pass

    # -----------------------------------------------------
    # Try tab separated
    # -----------------------------------------------------

    return pd.read_csv(
        file_path,
        sep="\t",
    )


def detect_tabular_type(
    dataframe: pd.DataFrame,
) -> str:
    """
    Detect instrument type from column names.
    """

    text = " ".join(
        str(column)
        for column
        in dataframe.columns
    ).lower()

    if "glider" in text:

        return "GLIDER"

    if "ctd" in text:

        return "CTD"

    if "bgc" in text:

        return "BGC"

    if "moor" in text:

        return "MOORING"

    return "ARGO"


# =========================================================
# CSV / TXT PARSER
# =========================================================

def parse_tabular(
    file_path: Path,
) -> Dict[str, Any]:
    """
    Parse CSV/TXT datasets.

    IMPORTANT FOR ARGO PROFILE DATA:

    Example CSV:

        float_id,latitude,longitude,time,depth,temperature,salinity

        2903671,17.85,86.41,...,0,...
        2903671,17.85,86.41,...,50,...
        2903671,17.85,86.41,...,100,...
        2903671,17.85,86.41,...,200,...
        2903671,17.85,86.41,...,500,...
        2903671,17.85,86.41,...,1000,...
        2903671,17.85,86.41,...,2000,...

    These 7 rows represent ONE instrument.

    Therefore:

        35 rows
        5 float IDs
        7 depths each

    becomes:

        5 instruments
        each with a complete 7-point profile.
    """

    dataframe = read_tabular_file(
        file_path
    )

    # -----------------------------------------------------
    # Clean column names
    # -----------------------------------------------------

    dataframe.columns = [
        str(column).strip()
        for column in dataframe.columns
    ]

    # -----------------------------------------------------
    # Detect columns
    # -----------------------------------------------------

    latitude_column = find_column(
        dataframe.columns,
        LATITUDE_NAMES,
    )

    longitude_column = find_column(
        dataframe.columns,
        LONGITUDE_NAMES,
    )

    depth_column = find_column(
        dataframe.columns,
        DEPTH_NAMES,
    )

    time_column = find_column(
        dataframe.columns,
        TIME_NAMES,
    )

    instrument_column = find_column(
        dataframe.columns,
        INSTRUMENT_NAMES,
    )

    if (
        latitude_column is None
        or longitude_column is None
    ):

        raise ValueError(
            "Dataset must contain latitude and longitude columns."
        )

    instrument_type = (
        detect_tabular_type(
            dataframe
        )
    )

    # =====================================================
    # GROUP ROWS BY INSTRUMENT
    # =====================================================

    groups = []

    if instrument_column:

        # -------------------------------------------------
        # Convert IDs to strings.
        # This prevents:
        #
        # 2903671
        #
        # becoming:
        #
        # 2903671.0
        #
        # -------------------------------------------------

        instrument_keys = (
            dataframe[
                instrument_column
            ]
            .apply(
                normalize_instrument_id
            )
        )

        grouped = dataframe.groupby(
            instrument_keys,
            sort=False,
            dropna=True,
        )

        for instrument_id, group in grouped:

            groups.append(
                (
                    str(instrument_id),
                    group.copy(),
                )
            )

    else:

        # -------------------------------------------------
        # No instrument ID.
        #
        # Each row becomes a separate profile.
        # -------------------------------------------------

        for index, row in dataframe.iterrows():

            groups.append(
                (
                    f"PROFILE-{index + 1:05d}",
                    dataframe.loc[
                        [index]
                    ].copy(),
                )
            )

    instruments = []

    # =====================================================
    # INSTRUMENT LOOP
    # =====================================================

    for instrument_id, group in groups:

        # -------------------------------------------------
        # Remove invalid latitude/longitude rows
        # -------------------------------------------------

        valid_rows = []

        for _, row in group.iterrows():

            latitude = safe_float(
                row[
                    latitude_column
                ]
            )

            longitude = safe_float(
                row[
                    longitude_column
                ]
            )

            if (
                latitude is None
                or longitude is None
            ):

                continue

            if abs(latitude) > 90:

                continue

            if abs(longitude) > 360:

                continue

            valid_rows.append(
                row
            )

        if not valid_rows:

            continue

        group = pd.DataFrame(
            valid_rows
        )

        # -------------------------------------------------
        # Sort profile by depth
        # -------------------------------------------------

        if depth_column:

            group["_depth_numeric"] = (
                pd.to_numeric(
                    group[
                        depth_column
                    ],
                    errors="coerce",
                )
            )

            group = group.sort_values(
                "_depth_numeric",
                na_position="last",
            )

        # -------------------------------------------------
        # First row contains metadata
        # -------------------------------------------------

        first_row = group.iloc[0]

        latitude = safe_float(
            first_row[
                latitude_column
            ]
        )

        longitude = safe_float(
            first_row[
                longitude_column
            ]
        )

        if longitude is not None:

            longitude = normalize_longitude(
                longitude
            )

        # =================================================
        # TIME
        # =================================================

        timestamp = None

        if time_column:

            timestamp = serialize_time(
                first_row[
                    time_column
                ]
            )

        # =================================================
        # DEPTH PROFILE
        # =================================================

        depths = []

        if depth_column:

            for _, row in group.iterrows():

                depth = safe_float(
                    row[
                        depth_column
                    ]
                )

                depths.append(
                    depth
                )

        # =================================================
        # SCIENTIFIC VARIABLES
        # =================================================

        profile_variables = {}

        for (
            standard_name,
            aliases,
        ) in VARIABLE_ALIASES.items():

            column = find_column(
                dataframe.columns,
                aliases,
            )

            if column is None:

                continue

            values = []

            for _, row in group.iterrows():

                value = safe_float(
                    row[column]
                )

                values.append(
                    value
                )

            # Add variable only if it contains
            # at least one actual value.

            if any(
                value is not None
                for value in values
            ):

                profile_variables[
                    standard_name
                ] = values

        # =================================================
        # SURFACE / MARKER VALUES
        # =================================================

        surface_index = 0

        # Prefer depth = 0.

        for index, depth in enumerate(
            depths
        ):

            if depth == 0:

                surface_index = index

                break

        marker_depth = None

        if depths:

            marker_depth = depths[
                surface_index
            ]

        marker_values = {}

        for (
            variable_name,
            values,
        ) in profile_variables.items():

            if (
                surface_index
                < len(values)
            ):

                value = values[
                    surface_index
                ]

                if value is not None:

                    marker_values[
                        variable_name
                    ] = value

        # =================================================
        # CREATE ONE INSTRUMENT
        # =================================================

        instrument = {

            "id": str(
                instrument_id
            ),

            "type": instrument_type,

            "latitude": latitude,

            "longitude": longitude,

            "depth": marker_depth,

            "time": timestamp,

            "status": "Active",

            "values": marker_values,

            "profile": {

                "depth": depths,

                "variables": profile_variables,

            },

        }

        instruments.append(
            instrument
        )

    # =====================================================
    # VARIABLE METADATA
    # =====================================================

    variables = []

    for column in dataframe.columns:

        if column == "_depth_numeric":

            continue

        variables.append(
            {
                "name": column,

                "dimensions": [
                    "row"
                ],

                "shape": [
                    len(dataframe)
                ],

                "dtype": str(
                    dataframe[
                        column
                    ].dtype
                ),

                "units": None,

                "long_name": None,
            }
        )

    # =====================================================
    # DATASET DIMENSIONS
    # =====================================================

    dimensions = {

        "row": len(
            dataframe
        ),

        "column": len(
            dataframe.columns
        ),

    }

    # =====================================================
    # RETURN
    # =====================================================

    return {

        "dimensions": dimensions,

        "variables": variables,

        "instruments": instruments,

        "attributes": {},

    }


# =========================================================
# INSTRUMENT ID NORMALIZATION
# =========================================================

def normalize_instrument_id(
    value,
) -> Optional[str]:
    """
    Normalize instrument IDs.

    Examples:

        2903671       -> "2903671"
        2903671.0     -> "2903671"
        "2903671"     -> "2903671"
        "ARGO-123"    -> "ARGO-123"
    """

    if value is None:

        return None

    try:

        if pd.isna(value):

            return None

    except Exception:

        pass

    text = str(value).strip()

    if not text:

        return None

    # -----------------------------------------------------
    # Convert numeric IDs such as:
    #
    # 2903671.0
    #
    # into:
    #
    # 2903671
    # -----------------------------------------------------

    try:

        number = float(text)

        if number.is_integer():

            return str(
                int(number)
            )

    except Exception:

        pass

    return text


# =========================================================
# MAIN DATASET PARSER
# =========================================================

def parse_dataset(
    file_path: Path,
) -> Dict[str, Any]:
    """
    Main parser entry point.
    """

    suffix = (
        file_path.suffix.lower()
    )

    if suffix in {
        ".nc",
        ".cdf",
    }:

        return parse_netcdf(
            file_path
        )

    if suffix in {
        ".csv",
        ".txt",
    }:

        return parse_tabular(
            file_path
        )

    raise ValueError(
        f"Unsupported file type: {suffix}"
    )


# =========================================================
# NETCDF SLICE API
# =========================================================

def get_netcdf_slice(
    file_path: Path,
    variable: str,
    depth: Optional[float] = None,
    time_index: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Return a selected variable slice from NetCDF.
    """

    dataset = xr.open_dataset(
        file_path,
        decode_times=True,
    )

    try:

        # =================================================
        # RESOLVE VARIABLE
        # =================================================

        aliases = VARIABLE_ALIASES.get(
            variable,
            [variable],
        )

        actual_variable = find_variable(
            dataset.data_vars,
            aliases,
        )

        if actual_variable is None:

            raise ValueError(
                f"Variable '{variable}' not found."
            )

        data = dataset[
            actual_variable
        ]

        # =================================================
        # TIME SELECTION
        # =================================================

        if (
            time_index is not None
            and "time" in data.dims
        ):

            safe_index = max(
                0,
                min(
                    int(time_index),
                    data.sizes[
                        "time"
                    ] - 1,
                ),
            )

            data = data.isel(
                time=safe_index
            )

        # =================================================
        # DEPTH SELECTION
        # =================================================

        if (
            depth is not None
            and "depth" in data.dims
        ):

            data = data.sel(
                depth=depth,
                method="nearest",
            )

        # =================================================
        # COORDINATES
        # =================================================

        lat_name = find_variable(
            dataset.variables,
            LATITUDE_NAMES,
        )

        lon_name = find_variable(
            dataset.variables,
            LONGITUDE_NAMES,
        )

        latitude = []

        longitude = []

        if lat_name:

            latitude = [
                safe_float(value)
                for value in np.asarray(
                    dataset[
                        lat_name
                    ].values
                ).flatten()
            ]

        if lon_name:

            longitude = [
                safe_float(value)
                for value in np.asarray(
                    dataset[
                        lon_name
                    ].values
                ).flatten()
            ]

        # =================================================
        # VALUES
        # =================================================

        values = np.asarray(
            data.values
        )

        values = np.squeeze(
            values
        )

        if values.ndim == 0:

            values = np.array(
                [
                    [
                        float(values)
                    ]
                ]
            )

        elif values.ndim == 1:

            values = values.reshape(
                1,
                -1,
            )

        elif values.ndim > 2:

            values = values.reshape(
                values.shape[-2],
                values.shape[-1],
            )

        values_list = []

        for row in values:

            row_result = []

            for value in row:

                number = safe_float(
                    value
                )

                row_result.append(
                    number
                )

            values_list.append(
                row_result
            )

        # =================================================
        # MIN / MAX
        # =================================================

        finite_values = []

        for row in values_list:

            for value in row:

                if value is not None:

                    finite_values.append(
                        value
                    )

        min_value = None

        max_value = None

        if finite_values:

            min_value = float(
                min(
                    finite_values
                )
            )

            max_value = float(
                max(
                    finite_values
                )
            )

        # =================================================
        # RETURN
        # =================================================

        return {

            "variable": variable,

            "actual_variable":
                actual_variable,

            "depth": depth,

            "time_index":
                time_index,

            "latitude":
                latitude,

            "longitude":
                longitude,

            "values":
                values_list,

            "units":
                data.attrs.get(
                    "units"
                ),

            "min_value":
                min_value,

            "max_value":
                max_value,

        }

    finally:

        dataset.close()