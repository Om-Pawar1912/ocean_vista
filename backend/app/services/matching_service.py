from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import math

import numpy as np
import pandas as pd
import xarray as xr

from app.services.dataset_service import get_datasets
from app.services.parser_service import (
    VARIABLE_ALIASES,
    find_variable,
    LATITUDE_NAMES,
    LONGITUDE_NAMES,
    DEPTH_NAMES,
    TIME_NAMES,
)


# =========================================================
# DEFAULT SETTINGS
# =========================================================

DEFAULT_MAX_TIME_DIFFERENCE_HOURS = 24.0
DEFAULT_MAX_DEPTH_DIFFERENCE_METERS = 100.0


# =========================================================
# OCEANVISTA VARIABLE ALIASES
# =========================================================

OCEAN_VARIABLE_ALIASES = {

    "temperature": [
        "temperature",
        "temp",
        "thetao",
        "theta",
        "water_temperature",
        "sea_water_temperature",
        "TEMP",
        "TEMPERATURE",
    ],

    "salinity": [
        "salinity",
        "salt",
        "so",
        "psal",
        "PSAL",
        "sea_water_salinity",
        "sea_water_practical_salinity",
        "SALINITY",
        "SALT",
    ],

    "chlorophyll": [
        "chlorophyll",
        "chlorophyll_a",
        "chlor_a",
        "chl",
        "chla",
        "CHL",
        "CHLA",
        "chloro",
        "sea_water_chlorophyll",
        "mass_concentration_of_chlorophyll_a_in_sea_water",
    ],

    "oxygen": [
        "oxygen",
        "dissolved_oxygen",
        "dissolvedoxygen",
        "doxy",
        "DOXY",
        "o2",
        "O2",
        "oxygen_concentration",
        "sea_water_oxygen",
        "moles_of_oxygen",
        "mole_concentration_of_dissolved_molecular_oxygen_in_sea_water",
    ],

    "density": [
        "density",
        "rho",
        "RHO",
        "sea_water_density",
    ],

    "current_u": [
        "current_u",
        "u",
        "uo",
        "eastward_sea_water_velocity",
        "eastward_velocity",
        "water_u",
    ],

    "current_v": [
        "current_v",
        "v",
        "vo",
        "northward_sea_water_velocity",
        "northward_velocity",
        "water_v",
    ],

    "depth": [
        "depth",
        "deptht",
        "depthu",
        "depthv",
        "depthw",
        "DEPTH",
    ],
}


# =========================================================
# BASIC HELPERS
# =========================================================

def safe_float(value) -> Optional[float]:

    try:

        if value is None:
            return None

        if pd.isna(value):
            return None

        value = float(value)

        if not math.isfinite(value):
            return None

        return value

    except Exception:

        return None


def safe_string(value) -> Optional[str]:

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    return str(value)


# =========================================================
# VARIABLE NORMALIZATION
# =========================================================

def normalize_text(value: str) -> str:

    return (
        str(value)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        .replace("/", "_")
    )


def normalize_variable_name(
    variable: str
) -> str:

    variable = str(
        variable
    ).strip()

    normalized = normalize_text(
        variable
    )

    # -----------------------------------------------------
    # OceanVista aliases
    # -----------------------------------------------------

    for standard_name, aliases in OCEAN_VARIABLE_ALIASES.items():

        candidates = [
            standard_name,
            *aliases,
        ]

        for candidate in candidates:

            if normalized == normalize_text(
                candidate
            ):

                return standard_name

    # -----------------------------------------------------
    # Parser aliases
    # -----------------------------------------------------

    for standard_name, aliases in VARIABLE_ALIASES.items():

        if normalized == normalize_text(
            standard_name
        ):

            return standard_name

        for alias in aliases:

            if normalized == normalize_text(
                alias
            ):

                return standard_name

    return variable


# =========================================================
# VARIABLE RESOLUTION
# =========================================================

def resolve_model_variable(
    dataset: xr.Dataset,
    variable: str,
) -> Optional[str]:

    standard_variable = normalize_variable_name(
        variable
    )

    aliases = OCEAN_VARIABLE_ALIASES.get(
        standard_variable,
        [standard_variable],
    )

    dataset_variables = list(
        dataset.data_vars.keys()
    )

    # -----------------------------------------------------
    # Exact alias matching
    # -----------------------------------------------------

    for candidate in aliases:

        candidate_normalized = normalize_text(
            candidate
        )

        for actual_name in dataset_variables:

            if normalize_text(
                actual_name
            ) == candidate_normalized:

                return actual_name

    # -----------------------------------------------------
    # Parser aliases
    # -----------------------------------------------------

    parser_aliases = VARIABLE_ALIASES.get(
        standard_variable,
        [],
    )

    for candidate in parser_aliases:

        candidate_normalized = normalize_text(
            candidate
        )

        for actual_name in dataset_variables:

            if normalize_text(
                actual_name
            ) == candidate_normalized:

                return actual_name

    # -----------------------------------------------------
    # CF metadata matching
    # -----------------------------------------------------

    metadata_keys = [
        "standard_name",
        "long_name",
        "description",
        "comment",
        "units",
    ]

    keywords = {

        "temperature": [
            "temperature",
            "sea_water_temperature",
        ],

        "salinity": [
            "salinity",
            "sea_water_salinity",
            "practical_salinity",
        ],

        "chlorophyll": [
            "chlorophyll",
            "chlorophyll_a",
        ],

        "oxygen": [
            "oxygen",
            "dissolved_oxygen",
            "molecular_oxygen",
        ],

        "density": [
            "density",
            "sea_water_density",
        ],

        "current_u": [
            "eastward",
            "u_velocity",
            "eastward_velocity",
        ],

        "current_v": [
            "northward",
            "v_velocity",
            "northward_velocity",
        ],
    }

    search_terms = keywords.get(
        standard_variable,
        [],
    )

    for actual_name in dataset_variables:

        data_array = dataset[
            actual_name
        ]

        metadata_text = " ".join(
            str(
                data_array.attrs.get(
                    key,
                    "",
                )
            )
            for key in metadata_keys
        ).lower()

        variable_text = (
            str(actual_name)
            + " "
            + metadata_text
        ).lower()

        for term in search_terms:

            if term.lower() in variable_text:

                return actual_name

    return None


# =========================================================
# TIME HELPERS
# =========================================================

def parse_time(value) -> Optional[pd.Timestamp]:

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    try:

        result = pd.Timestamp(
            value
        )

        if pd.isna(result):
            return None

        return result

    except Exception:

        return None


def time_difference_hours(
    first_time,
    second_time,
) -> Optional[float]:

    first = parse_time(
        first_time
    )

    second = parse_time(
        second_time
    )

    if first is None or second is None:
        return None

    try:

        return abs(
            (
                first - second
            ).total_seconds()
        ) / 3600.0

    except Exception:

        return None


# =========================================================
# DATASET TYPE
# =========================================================

def is_model_dataset(
    dataset: Dict[str, Any]
) -> bool:

    filename = str(
        dataset.get(
            "filename",
            "",
        )
    ).lower()

    attributes = dataset.get(
        "attributes",
        {},
    )

    if not isinstance(
        attributes,
        dict,
    ):

        attributes = {}

    attribute_text = " ".join(
        f"{key} {value}"
        for key, value in attributes.items()
    ).lower()

    combined = (
        filename
        + " "
        + attribute_text
    )

    model_keywords = [

        "model",
        "copernicus",
        "cmems",
        "forecast",
        "analysis",
        "reanalysis",
        "nemo",
        "hycom",
        "roms",
        "ocean model",
        "globalmy",
        "global_multi",
        "phy",
        "biogeochemical",
        "bgc",
    ]

    return any(
        keyword in combined
        for keyword in model_keywords
    )


# =========================================================
# FIND INSTRUMENT
# =========================================================

def find_instrument(
    instrument_id: str,
    instrument_type: Optional[str] = None,
) -> Tuple[
    Optional[Dict[str, Any]],
    Optional[Dict[str, Any]],
]:

    requested_id = str(
        instrument_id
    )

    requested_type = (
        str(
            instrument_type
        ).upper()
        if instrument_type
        else None
    )

    for dataset in get_datasets():

        for instrument in dataset.get(
            "instruments",
            [],
        ):

            current_id = str(
                instrument.get(
                    "id",
                    "",
                )
            )

            if current_id != requested_id:
                continue

            if requested_type:

                current_type = str(
                    instrument.get(
                        "type",
                        "",
                    )
                ).upper()

                if current_type != requested_type:
                    continue

            return (
                instrument,
                dataset,
            )

    return None, None


# =========================================================
# OBSERVATION PROFILE
# =========================================================

def get_observation_profile(
    instrument: Dict[str, Any],
    variable: str,
) -> Tuple[
    List[float],
    List[float],
]:

    profile = instrument.get(
        "profile",
        {},
    )

    if not isinstance(
        profile,
        dict,
    ):

        return [], []

    depths = profile.get(
        "depth",
        [],
    )

    variables = profile.get(
        "variables",
        {},
    )

    if not isinstance(
        variables,
        dict,
    ):

        return [], []

    standard_variable = normalize_variable_name(
        variable
    )

    values = None

    for key, candidate_values in variables.items():

        if normalize_variable_name(
            key
        ) == standard_variable:

            values = candidate_values
            break

    if values is None:
        return [], []

    if not isinstance(
        depths,
        (list, tuple, np.ndarray)
    ):

        return [], []

    if not isinstance(
        values,
        (list, tuple, np.ndarray)
    ):

        return [], []

    result_depths = []
    result_values = []

    count = min(
        len(depths),
        len(values),
    )

    for index in range(
        count
    ):

        depth = safe_float(
            depths[index]
        )

        value = safe_float(
            values[index]
        )

        if depth is None:
            continue

        if value is None:
            continue

        result_depths.append(
            depth
        )

        result_values.append(
            value
        )

    return (
        result_depths,
        result_values,
    )


# =========================================================
# COORDINATE HELPERS
# =========================================================

def find_coordinate_name(
    dataset: xr.Dataset,
    candidates: List[str],
) -> Optional[str]:

    result = find_variable(
        dataset.variables,
        candidates,
    )

    if result:
        return result

    for name in dataset.variables:

        normalized_name = normalize_text(
            name
        )

        for candidate in candidates:

            if normalized_name == normalize_text(
                candidate
            ):

                return name

    return None


def get_coordinate_values(
    dataset: xr.Dataset,
    coordinate_name: str,
):

    try:

        return np.asarray(
            dataset[
                coordinate_name
            ].values
        )

    except Exception:

        return np.asarray([])


# =========================================================
# LONGITUDE HANDLING
# =========================================================

def normalize_longitude_for_model(
    longitude: float,
    model_longitudes,
) -> float:

    longitude = float(
        longitude
    )

    values = np.asarray(
        model_longitudes,
        dtype=float,
    )

    values = values[
        np.isfinite(values)
    ]

    if values.size == 0:

        return longitude

    model_min = float(
        np.min(values)
    )

    model_max = float(
        np.max(values)
    )

    # 0 ... 360
    if (
        model_min >= 0
        and
        model_max > 180
    ):

        while longitude < 0:
            longitude += 360

        while longitude >= 360:
            longitude -= 360

        return longitude

    # -180 ... 180
    while longitude > 180:
        longitude -= 360

    while longitude < -180:
        longitude += 360

    return longitude


# =========================================================
# NEAREST TIME SELECTION
# =========================================================

def select_nearest_time(
    data: xr.DataArray,
    time_coord: Optional[xr.DataArray],
    time_name: Optional[str],
    observation_time,
) -> Tuple[
    xr.DataArray,
    Any,
]:

    if (
        time_coord is None
        or
        time_name is None
        or
        time_name not in data.dims
    ):

        return data, None

    observation_timestamp = parse_time(
        observation_time
    )

    if observation_timestamp is None:

        return data, None

    try:

        time_values = np.asarray(
            time_coord.values
        ).reshape(-1)

        if len(time_values) == 0:

            return data, None

        parsed_times = []

        valid_indices = []

        for index, value in enumerate(
            time_values
        ):

            parsed = parse_time(
                value
            )

            if parsed is None:
                continue

            parsed_times.append(
                parsed
            )

            valid_indices.append(
                index
            )

        if not parsed_times:

            return data, None

        differences = np.asarray(
            [
                abs(
                    (
                        parsed
                        -
                        observation_timestamp
                    ).total_seconds()
                )
                for parsed in parsed_times
            ],
            dtype=float,
        )

        nearest_position = int(
            np.argmin(
                differences
            )
        )

        selected_index = int(
            valid_indices[
                nearest_position
            ]
        )

        data = data.isel(
            {
                time_name:
                    selected_index
            }
        )

        selected_time = (
            parsed_times[
                nearest_position
            ]
        )

        return (
            data,
            selected_time,
        )

    except Exception:

        return data, None


# =========================================================
# MODEL PROFILE EXTRACTION
# =========================================================

def extract_model_profile(
    file_path: Path,
    latitude: float,
    longitude: float,
    observation_time,
    variable: str,
) -> Dict[str, Any]:

    dataset = xr.open_dataset(
        file_path,
        decode_times=True,
    )

    try:

        # =================================================
        # FIND COORDINATES
        # =================================================

        lat_name = find_coordinate_name(
            dataset,
            LATITUDE_NAMES,
        )

        lon_name = find_coordinate_name(
            dataset,
            LONGITUDE_NAMES,
        )

        depth_name = find_coordinate_name(
            dataset,
            DEPTH_NAMES,
        )

        time_name = find_coordinate_name(
            dataset,
            TIME_NAMES,
        )

        if lat_name is None:

            raise ValueError(
                "Model dataset does not contain latitude."
            )

        if lon_name is None:

            raise ValueError(
                "Model dataset does not contain longitude."
            )

        if depth_name is None:

            raise ValueError(
                "Model dataset does not contain depth."
            )

        # =================================================
        # RESOLVE VARIABLE
        # =================================================

        actual_variable = resolve_model_variable(
            dataset,
            variable,
        )

        if actual_variable is None:

            available = list(
                dataset.data_vars.keys()
            )

            raise ValueError(
                f"Model variable '{variable}' was not found. "
                f"Available model variables: {available}"
            )

        data = dataset[
            actual_variable
        ]

        # =================================================
        # COORDINATES
        # =================================================

        lat_coord = dataset[
            lat_name
        ]

        lon_coord = dataset[
            lon_name
        ]

        depth_coord = dataset[
            depth_name
        ]

        time_coord = None

        if (
            time_name is not None
            and
            time_name in dataset
        ):

            time_coord = dataset[
                time_name
            ]

        # =================================================
        # COORDINATE ARRAYS
        # =================================================

        lat_values = np.asarray(
            lat_coord.values,
            dtype=float,
        )

        lon_values = np.asarray(
            lon_coord.values,
            dtype=float,
        )

        lat_values = np.squeeze(
            lat_values
        )

        lon_values = np.squeeze(
            lon_values
        )

        if lat_values.size == 0:

            raise ValueError(
                "Model latitude array is empty."
            )

        if lon_values.size == 0:

            raise ValueError(
                "Model longitude array is empty."
            )

        # =================================================
        # NORMALIZE LONGITUDE
        # =================================================

        selected_longitude = (
            normalize_longitude_for_model(
                longitude,
                lon_values,
            )
        )

        # =================================================
        # VARIABLES FOR SELECTED LOCATION
        # =================================================

        model_latitude = None
        model_longitude = None
        selected_model_time = None

        # This keeps the depth coordinate synchronized
        # with the selected model location.

        selected_depth = depth_coord

        # =================================================
        # DETECT DATASET STRUCTURE
        # =================================================

        is_scattered_profile_dataset = (

            lat_coord.ndim == 1

            and

            lon_coord.ndim == 1

            and

            lat_coord.dims == lon_coord.dims
        )

        is_2d_grid = (

            lat_coord.ndim == 2

            and

            lon_coord.ndim == 2
        )

        is_regular_1d_grid = (

            lat_coord.ndim == 1

            and

            lon_coord.ndim == 1

            and

            lat_coord.dims != lon_coord.dims
        )

        # =================================================
        # CASE 1
        # SCATTERED / PROFILE DATASET
        #
        # Example:
        #
        # LATITUDE(N_PROF)
        # LONGITUDE(N_PROF)
        # TIME(N_PROF)
        # DEPTH(N_PROF, N_LEVELS)
        # TEMP(N_PROF, N_LEVELS)
        #
        # =================================================

        if is_scattered_profile_dataset:

            profile_dimension = (
                lat_coord.dims[0]
            )

            if (
                lat_values.size
                !=
                lon_values.size
            ):

                raise ValueError(
                    "Model latitude and longitude arrays "
                    "have different sizes."
                )

            valid = (
                np.isfinite(
                    lat_values
                )
                &
                np.isfinite(
                    lon_values
                )
            )

            if not np.any(valid):

                raise ValueError(
                    "Model latitude/longitude "
                    "coordinates contain no valid values."
                )

            valid_indices = np.where(
                valid
            )[0]

            # -------------------------------------------------
            # Geographic nearest-profile calculation
            # -------------------------------------------------

            latitude_difference = np.abs(
                lat_values[valid]
                -
                float(latitude)
            )

            longitude_difference = np.abs(
                lon_values[valid]
                -
                selected_longitude
            )

            longitude_difference = np.minimum(
                longitude_difference,
                360.0
                -
                longitude_difference,
            )

            latitude_scale = max(
                0.1,
                math.cos(
                    math.radians(
                        float(latitude)
                    )
                ),
            )

            distance_squared = (
                latitude_difference ** 2
                +
                (
                    longitude_difference
                    *
                    latitude_scale
                ) ** 2
            )

            nearest_position = int(
                np.argmin(
                    distance_squared
                )
            )

            profile_index = int(
                valid_indices[
                    nearest_position
                ]
            )

            # -------------------------------------------------
            # SELECT MODEL PROFILE
            #
            # IMPORTANT:
            # N_PROF is positional.
            # Do NOT use .sel(method="nearest").
            # -------------------------------------------------

            if (
                profile_dimension
                in data.dims
            ):

                data = data.isel(
                    {
                        profile_dimension:
                            profile_index
                    }
                )

            # -------------------------------------------------
            # SELECT DEPTH FROM SAME PROFILE
            # -------------------------------------------------

            if (
                profile_dimension
                in selected_depth.dims
            ):

                selected_depth = (
                    selected_depth.isel(
                        {
                            profile_dimension:
                                profile_index
                        }
                    )
                )

            # -------------------------------------------------
            # MODEL LOCATION
            # -------------------------------------------------

            model_latitude = safe_float(
                lat_values[
                    profile_index
                ]
            )

            model_longitude = safe_float(
                lon_values[
                    profile_index
                ]
            )

            # -------------------------------------------------
            # MODEL PROFILE TIME
            # -------------------------------------------------

            if (
                time_coord is not None
                and
                profile_dimension
                in time_coord.dims
            ):

                try:

                    profile_time = (
                        time_coord.isel(
                            {
                                profile_dimension:
                                    profile_index
                            }
                        ).values
                    )

                    if np.ndim(
                        profile_time
                    ) == 0:

                        selected_model_time = (
                            profile_time.item()
                        )

                    else:

                        profile_time_array = (
                            np.asarray(
                                profile_time
                            ).reshape(-1)
                        )

                        if len(
                            profile_time_array
                        ) > 0:

                            selected_model_time = (
                                profile_time_array[0]
                            )

                except Exception:

                    selected_model_time = None

        # =================================================
        # CASE 2
        # 2D LAT/LON GRID
        #
        # Example:
        #
        # LATITUDE(Y,X)
        # LONGITUDE(Y,X)
        #
        # =================================================

        elif is_2d_grid:

            lat_array = np.asarray(
                lat_coord.values,
                dtype=float,
            )

            lon_array = np.asarray(
                lon_coord.values,
                dtype=float,
            )

            lat_flat = (
                lat_array.flatten()
            )

            lon_flat = (
                lon_array.flatten()
            )

            valid = (
                np.isfinite(
                    lat_flat
                )
                &
                np.isfinite(
                    lon_flat
                )
            )

            if not np.any(valid):

                raise ValueError(
                    "Model latitude/longitude "
                    "coordinates contain no valid values."
                )

            valid_indices = np.where(
                valid
            )[0]

            latitude_difference = np.abs(
                lat_flat[valid]
                -
                float(latitude)
            )

            longitude_difference = np.abs(
                lon_flat[valid]
                -
                selected_longitude
            )

            longitude_difference = np.minimum(
                longitude_difference,
                360.0
                -
                longitude_difference,
            )

            latitude_scale = max(
                0.1,
                math.cos(
                    math.radians(
                        float(latitude)
                    )
                ),
            )

            distance_squared = (
                latitude_difference ** 2
                +
                (
                    longitude_difference
                    *
                    latitude_scale
                ) ** 2
            )

            nearest_position = int(
                np.argmin(
                    distance_squared
                )
            )

            flat_index = int(
                valid_indices[
                    nearest_position
                ]
            )

            grid_index = np.unravel_index(
                flat_index,
                lat_array.shape,
            )

            spatial_indexers = {

                dimension:
                    int(
                        grid_index[index]
                    )

                for index, dimension
                in enumerate(
                    lat_coord.dims
                )
            }

            # Select model values.

            for dimension, index in (
                spatial_indexers.items()
            ):

                if dimension in data.dims:

                    data = data.isel(
                        {
                            dimension:
                                index
                        }
                    )

            # Select matching depth.

            for dimension, index in (
                spatial_indexers.items()
            ):

                if dimension in selected_depth.dims:

                    selected_depth = (
                        selected_depth.isel(
                            {
                                dimension:
                                    index
                            }
                        )
                    )

            model_latitude = safe_float(
                lat_array[
                    grid_index
                ]
            )

            model_longitude = safe_float(
                lon_array[
                    grid_index
                ]
            )

        # =================================================
        # CASE 3
        # REGULAR 1D LAT/LON GRID
        #
        # Example:
        #
        # LATITUDE(LAT)
        # LONGITUDE(LON)
        # DEPTH(DEPTH)
        # TEMP(TIME, DEPTH, LAT, LON)
        #
        # =================================================

        elif is_regular_1d_grid:

            lat_dimension = (
                lat_coord.dims[0]
            )

            lon_dimension = (
                lon_coord.dims[0]
            )

            # -------------------------------------------------
            # Nearest latitude
            # -------------------------------------------------

            valid_lat = np.isfinite(
                lat_values
            )

            if not np.any(valid_lat):

                raise ValueError(
                    "Model latitude contains no valid values."
                )

            valid_lat_indices = np.where(
                valid_lat
            )[0]

            latitude_index = int(
                valid_lat_indices[
                    np.argmin(
                        np.abs(
                            lat_values[
                                valid_lat
                            ]
                            -
                            float(latitude)
                        )
                    )
                ]
            )

            # -------------------------------------------------
            # Nearest longitude
            # -------------------------------------------------

            valid_lon = np.isfinite(
                lon_values
            )

            if not np.any(valid_lon):

                raise ValueError(
                    "Model longitude contains no valid values."
                )

            valid_lon_indices = np.where(
                valid_lon
            )[0]

            longitude_index = int(
                valid_lon_indices[
                    np.argmin(
                        np.abs(
                            lon_values[
                                valid_lon
                            ]
                            -
                            selected_longitude
                        )
                    )
                ]
            )

            # -------------------------------------------------
            # Select spatial location
            # -------------------------------------------------

            if lat_dimension in data.dims:

                data = data.isel(
                    {
                        lat_dimension:
                            latitude_index
                    }
                )

            if lon_dimension in data.dims:

                data = data.isel(
                    {
                        lon_dimension:
                            longitude_index
                    }
                )

            # -------------------------------------------------
            # Select depth coordinate if necessary
            # -------------------------------------------------

            if lat_dimension in selected_depth.dims:

                selected_depth = (
                    selected_depth.isel(
                        {
                            lat_dimension:
                                latitude_index
                        }
                    )
                )

            if lon_dimension in selected_depth.dims:

                selected_depth = (
                    selected_depth.isel(
                        {
                            lon_dimension:
                                longitude_index
                        }
                    )
                )

            model_latitude = safe_float(
                lat_values[
                    latitude_index
                ]
            )

            model_longitude = safe_float(
                lon_values[
                    longitude_index
                ]
            )

        else:

            raise ValueError(
                "Unsupported model latitude/longitude "
                "coordinate structure."
            )

        # =================================================
        # TIME SELECTION
        #
        # Time is handled AFTER spatial/profile selection.
        #
        # This is important for:
        #
        # TIME(N_PROF)
        #
        # because profile time must not be treated as a
        # normal indexed model time dimension.
        # =================================================

        if (
            time_coord is not None
            and
            time_name is not None
        ):

            # -------------------------------------------------
            # Regular model time dimension
            # -------------------------------------------------

            if (
                time_name in data.dims
                and
                time_coord.ndim == 1
            ):

                data, selected_model_time = (
                    select_nearest_time(
                        data=data,
                        time_coord=time_coord,
                        time_name=time_name,
                        observation_time=observation_time,
                    )
                )

                # Match depth time dimension if depth has it.

                if (
                    selected_model_time is not None
                    and
                    time_name
                    in selected_depth.dims
                ):

                    try:

                        time_values = np.asarray(
                            time_coord.values
                        ).reshape(-1)

                        parsed_times = []

                        valid_indices = []

                        for index, value in enumerate(
                            time_values
                        ):

                            parsed = parse_time(
                                value
                            )

                            if parsed is None:
                                continue

                            parsed_times.append(
                                parsed
                            )

                            valid_indices.append(
                                index
                            )

                        if parsed_times:

                            differences = np.asarray(
                                [
                                    abs(
                                        (
                                            item
                                            -
                                            parse_time(
                                                observation_time
                                            )
                                        ).total_seconds()
                                    )
                                    for item
                                    in parsed_times
                                ],
                                dtype=float,
                            )

                            nearest_position = int(
                                np.argmin(
                                    differences
                                )
                            )

                            depth_time_index = int(
                                valid_indices[
                                    nearest_position
                                ]
                            )

                            selected_depth = (
                                selected_depth.isel(
                                    {
                                        time_name:
                                            depth_time_index
                                    }
                                )
                            )

                    except Exception:

                        pass

        # =================================================
        # DEPTH DIMENSION
        # =================================================

        depth_dims = list(
            selected_depth.dims
        )

        depth_dim = None

        # First prefer a dimension shared with data.

        for dimension in depth_dims:

            if dimension in data.dims:

                depth_dim = dimension
                break

        # If the depth variable itself is a dimension.

        if (
            depth_dim is None
            and
            depth_name in data.dims
        ):

            depth_dim = depth_name

        # If data has a dimension named depth.

        if (
            depth_dim is None
            and
            depth_name in data.dims
        ):

            depth_dim = depth_name

        # Single remaining dimension.

        if (
            depth_dim is None
            and
            len(data.dims) == 1
        ):

            depth_dim = list(
                data.dims
            )[0]

        if depth_dim is None:

            raise ValueError(
                "Could not determine model depth dimension."
            )

        # =================================================
        # REDUCE REMAINING DATA DIMENSIONS
        # =================================================

        for dimension in list(
            data.dims
        ):

            if dimension == depth_dim:
                continue

            try:

                data = data.isel(
                    {
                        dimension:
                            0
                    }
                )

            except Exception:

                pass

        # =================================================
        # REDUCE REMAINING DEPTH DIMENSIONS
        # =================================================

        for dimension in list(
            selected_depth.dims
        ):

            if dimension == depth_dim:
                continue

            try:

                selected_depth = (
                    selected_depth.isel(
                        {
                            dimension:
                                0
                        }
                    )
                )

            except Exception:

                pass

        # =================================================
        # DEPTH VALUES
        # =================================================

        depths = np.asarray(
            selected_depth.values
        ).squeeze()

        depths = np.asarray(
            depths,
            dtype=float,
        ).flatten()

        # =================================================
        # MODEL VALUES
        # =================================================

        values = np.asarray(
            data.values
        ).squeeze()

        values = np.asarray(
            values,
            dtype=float,
        ).flatten()

        # =================================================
        # VALIDATE ARRAYS
        # =================================================

        if len(depths) == 0:

            raise ValueError(
                "Model depth array is empty after "
                "spatial/profile selection."
            )

        if len(values) == 0:

            raise ValueError(
                f"Model variable '{actual_variable}' "
                "contains no values after "
                "spatial/profile selection."
            )

        # =================================================
        # ALIGN DEPTH AND VALUES
        # =================================================

        count = min(
            len(depths),
            len(values),
        )

        result_depths = []
        result_values = []

        for index in range(
            count
        ):

            depth = safe_float(
                depths[index]
            )

            value = safe_float(
                values[index]
            )

            if depth is None:
                continue

            if value is None:
                continue

            result_depths.append(
                depth
            )

            result_values.append(
                value
            )

        if not result_depths:

            raise ValueError(
                f"Model variable '{actual_variable}' "
                "contains no valid depth/value pairs "
                "after spatial selection."
            )

        # =================================================
        # TIME DIFFERENCE
        # =================================================

        time_difference = (
            time_difference_hours(
                observation_time,
                selected_model_time,
            )
        )

        # =================================================
        # RESULT
        # =================================================

        return {

            "variable":
                normalize_variable_name(
                    variable
                ),

            "actual_variable":
                actual_variable,

            "depth":
                result_depths,

            "values":
                result_values,

            "model_latitude":
                model_latitude,

            "model_longitude":
                model_longitude,

            "model_time":
                (
                    safe_string(
                        selected_model_time
                    )
                    if selected_model_time
                    is not None
                    else None
                ),

            "time_difference_hours":
                time_difference,
        }

    finally:

        dataset.close()


# =========================================================
# DEPTH MATCHING
# =========================================================

def match_depth_profiles(
    observation_depths: List[float],
    observation_values: List[float],
    model_depths: List[float],
    model_values: List[float],
    max_depth_difference:
        float =
        DEFAULT_MAX_DEPTH_DIFFERENCE_METERS,
) -> List[Dict[str, float]]:

    if not observation_depths:
        return []

    if not model_depths:
        return []

    model_depth_array = np.asarray(
        model_depths,
        dtype=float,
    )

    model_value_array = np.asarray(
        model_values,
        dtype=float,
    )

    valid_mask = (
        np.isfinite(
            model_depth_array
        )
        &
        np.isfinite(
            model_value_array
        )
    )

    if not np.any(valid_mask):
        return []

    valid_depths = (
        model_depth_array[
            valid_mask
        ]
    )

    valid_values = (
        model_value_array[
            valid_mask
        ]
    )

    matches = []

    count = min(
        len(observation_depths),
        len(observation_values),
    )

    for index in range(
        count
    ):

        observation_depth = safe_float(
            observation_depths[index]
        )

        observation_value = safe_float(
            observation_values[index]
        )

        if (
            observation_depth is None
            or
            observation_value is None
        ):

            continue

        nearest_index = int(
            np.argmin(
                np.abs(
                    valid_depths
                    -
                    observation_depth
                )
            )
        )

        model_depth = float(
            valid_depths[
                nearest_index
            ]
        )

        model_value = float(
            valid_values[
                nearest_index
            ]
        )

        depth_difference = abs(
            model_depth
            -
            observation_depth
        )

        if (
            depth_difference
            >
            max_depth_difference
        ):

            continue

        matches.append({

            "depth":
                float(
                    observation_depth
                ),

            "observation":
                float(
                    observation_value
                ),

            "model":
                float(
                    model_value
                ),

            "depth_difference":
                float(
                    depth_difference
                ),
        })

    return matches


# =========================================================
# METRICS
# =========================================================

def calculate_metrics(
    matches: List[Dict[str, float]],
) -> Dict[str, Any]:

    if not matches:

        return {

            "count": 0,

            "rmse": None,

            "bias": None,

            "mae": None,

            "correlation": None,

            "model_min": None,

            "model_max": None,

            "observation_min": None,

            "observation_max": None,
        }

    model_values = np.asarray(
        [
            item["model"]
            for item in matches
        ],
        dtype=float,
    )

    observation_values = np.asarray(
        [
            item["observation"]
            for item in matches
        ],
        dtype=float,
    )

    valid = (
        np.isfinite(
            model_values
        )
        &
        np.isfinite(
            observation_values
        )
    )

    model_values = (
        model_values[valid]
    )

    observation_values = (
        observation_values[valid]
    )

    if len(
        model_values
    ) == 0:

        return {

            "count": 0,

            "rmse": None,

            "bias": None,

            "mae": None,

            "correlation": None,

            "model_min": None,

            "model_max": None,

            "observation_min": None,

            "observation_max": None,
        }

    difference = (
        model_values
        -
        observation_values
    )

    rmse = float(
        np.sqrt(
            np.mean(
                difference ** 2
            )
        )
    )

    mae = float(
        np.mean(
            np.abs(
                difference
            )
        )
    )

    bias = float(
        np.mean(
            difference
        )
    )

    correlation = None

    if len(
        model_values
    ) >= 2:

        model_std = float(
            np.std(
                model_values
            )
        )

        observation_std = float(
            np.std(
                observation_values
            )
        )

        if (
            model_std > 0
            and
            observation_std > 0
        ):

            correlation = float(
                np.corrcoef(
                    model_values,
                    observation_values,
                )[0, 1]
            )

            if not math.isfinite(
                correlation
            ):

                correlation = None

    return {

        "count":
            int(
                len(
                    model_values
                )
            ),

        "rmse":
            rmse,

        "mae":
            mae,

        "bias":
            bias,

        "correlation":
            correlation,

        "model_min":
            float(
                np.min(
                    model_values
                )
            ),

        "model_max":
            float(
                np.max(
                    model_values
                )
            ),

        "observation_min":
            float(
                np.min(
                    observation_values
                )
            ),

        "observation_max":
            float(
                np.max(
                    observation_values
                )
            ),
    }


# =========================================================
# FIND MODEL DATASETS
# =========================================================

def find_model_datasets(
    preferred_dataset_id: Optional[str] = None,
) -> List[
    Tuple[
        Dict[str, Any],
        str,
    ]
]:

    datasets = get_datasets()

    result = []

    # -----------------------------------------------------
    # Preferred dataset first
    # -----------------------------------------------------

    if preferred_dataset_id:

        for dataset in datasets:

            if str(
                dataset.get("id")
            ) != str(
                preferred_dataset_id
            ):

                continue

            file_path = dataset.get(
                "path"
            )

            if (
                file_path
                and
                Path(
                    file_path
                ).exists()
            ):

                result.append(
                    (
                        dataset,
                        file_path,
                    )
                )

    # -----------------------------------------------------
    # Other model datasets
    # -----------------------------------------------------

    for dataset in datasets:

        if not is_model_dataset(
            dataset
        ):

            continue

        file_path = dataset.get(
            "path"
        )

        if not file_path:
            continue

        if not Path(
            file_path
        ).exists():

            continue

        dataset_id = str(
            dataset.get("id")
        )

        if any(
            str(
                item[0].get("id")
            ) == dataset_id
            for item in result
        ):

            continue

        result.append(
            (
                dataset,
                file_path,
            )
        )

    return result


# =========================================================
# BACKWARD COMPATIBILITY
# =========================================================

def find_model_dataset(
    preferred_dataset_id:
        Optional[str] = None,
) -> Tuple[
    Optional[Dict[str, Any]],
    Optional[str],
]:

    datasets = find_model_datasets(
        preferred_dataset_id
    )

    if not datasets:

        return None, None

    return datasets[0]


# =========================================================
# MAIN MATCHING FUNCTION
# =========================================================

def match_model_observations(
    instrument_id: str,
    variable: str,
    instrument_type: Optional[str] = None,
    model_dataset_id: Optional[str] = None,
    max_time_difference_hours:
        float =
        DEFAULT_MAX_TIME_DIFFERENCE_HOURS,
    max_depth_difference_meters:
        float =
        DEFAULT_MAX_DEPTH_DIFFERENCE_METERS,
) -> Dict[str, Any]:

    standard_variable = (
        normalize_variable_name(
            variable
        )
    )

    # =====================================================
    # FIND OBSERVATION
    # =====================================================

    instrument, observation_dataset = (
        find_instrument(
            instrument_id=instrument_id,
            instrument_type=instrument_type,
        )
    )

    if instrument is None:

        raise ValueError(
            f"Instrument '{instrument_id}' was not found."
        )

    actual_instrument_type = str(
        instrument.get(
            "type",
            "",
        )
    ).upper()

    # =====================================================
    # LOCATION
    # =====================================================

    latitude = safe_float(
        instrument.get(
            "latitude"
        )
    )

    longitude = safe_float(
        instrument.get(
            "longitude"
        )
    )

    observation_time = instrument.get(
        "time"
    )

    if latitude is None:

        raise ValueError(
            "Observation latitude is missing."
        )

    if longitude is None:

        raise ValueError(
            "Observation longitude is missing."
        )

    # =====================================================
    # OBSERVATION PROFILE
    # =====================================================

    observation_depths, observation_values = (
        get_observation_profile(
            instrument,
            standard_variable,
        )
    )

    if not observation_depths:

        raise ValueError(
            f"No observation depth profile found "
            f"for variable '{standard_variable}'."
        )

    # =====================================================
    # FIND MODEL DATASET
    # =====================================================

    candidate_models = find_model_datasets(
        preferred_dataset_id=model_dataset_id
    )

    if not candidate_models:

        raise ValueError(
            "No model dataset was found."
        )

    # =====================================================
    # TRY MODEL DATASETS
    # =====================================================

    model_profile = None
    model_dataset = None
    errors = []

    for candidate_dataset, candidate_path in (
        candidate_models
    ):

        try:

            profile = extract_model_profile(

                file_path=Path(
                    candidate_path
                ),

                latitude=latitude,

                longitude=longitude,

                observation_time=observation_time,

                variable=standard_variable,
            )

            if not profile.get(
                "depth"
            ):

                errors.append(
                    f"{candidate_dataset.get('filename')}: "
                    "no model depth values"
                )

                continue

            if not profile.get(
                "values"
            ):

                errors.append(
                    f"{candidate_dataset.get('filename')}: "
                    "no model values"
                )

                continue

            model_profile = profile

            model_dataset = candidate_dataset

            break

        except Exception as exc:

            errors.append(
                f"{candidate_dataset.get('filename')}: "
                f"{exc}"
            )

    if model_profile is None:

        available_models = [
            dataset.get(
                "filename"
            )
            for dataset, _
            in candidate_models
        ]

        raise ValueError(

            f"Model variable '{standard_variable}' "
            f"could not be resolved in any model dataset. "

            f"Available model files: "
            f"{available_models}. "

            f"Details: {errors}"
        )

    # =====================================================
    # TIME VALIDATION
    # =====================================================

    model_time_difference = (
        model_profile.get(
            "time_difference_hours"
        )
    )

    if (
        model_time_difference is not None
        and
        model_time_difference
        >
        max_time_difference_hours
    ):

        return {

            "success": True,

            "matched": False,

            "reason": (
                "No model observation was found "
                "within the allowed time difference."
            ),

            "instrument": {

                "id":
                    instrument.get(
                        "id"
                    ),

                "type":
                    actual_instrument_type,

                "latitude":
                    latitude,

                "longitude":
                    longitude,

                "time":
                    observation_time,
            },

            "variable":
                standard_variable,

            "time_difference_hours":
                model_time_difference,

            "max_time_difference_hours":
                max_time_difference_hours,

            "matches": [],

            "metrics":
                calculate_metrics([]),
        }

    # =====================================================
    # DEPTH MATCHING
    # =====================================================

    matches = match_depth_profiles(

        observation_depths=
            observation_depths,

        observation_values=
            observation_values,

        model_depths=
            model_profile.get(
                "depth",
                [],
            ),

        model_values=
            model_profile.get(
                "values",
                [],
            ),

        max_depth_difference=
            max_depth_difference_meters,
    )

    # =====================================================
    # METRICS
    # =====================================================

    metrics = calculate_metrics(
        matches
    )

    # =====================================================
    # GRAPH DATA
    # =====================================================

    graph = {

        "depth": [
            item["depth"]
            for item in matches
        ],

        "observation": [
            item["observation"]
            for item in matches
        ],

        "model": [
            item["model"]
            for item in matches
        ],
    }

    # =====================================================
    # FINAL RESULT
    # =====================================================

    return {

        "success": True,

        "matched":
            len(matches) > 0,

        "instrument": {

            "id":
                instrument.get(
                    "id"
                ),

            "type":
                actual_instrument_type,

            "latitude":
                latitude,

            "longitude":
                longitude,

            "time":
                observation_time,
        },

        "observation_dataset": {

            "id":
                observation_dataset.get(
                    "id"
                )
                if observation_dataset
                else None,

            "filename":
                observation_dataset.get(
                    "filename"
                )
                if observation_dataset
                else None,
        },

        "model_dataset": {

            "id":
                model_dataset.get(
                    "id"
                ),

            "filename":
                model_dataset.get(
                    "filename"
                ),
        },

        "variable":
            standard_variable,

        "actual_model_variable":
            model_profile.get(
                "actual_variable"
            ),

        "observation_location": {

            "latitude":
                latitude,

            "longitude":
                longitude,
        },

        "model_location": {

            "latitude":
                model_profile.get(
                    "model_latitude"
                ),

            "longitude":
                model_profile.get(
                    "model_longitude"
                ),
        },

        "observation_time":
            observation_time,

        "model_time":
            model_profile.get(
                "model_time"
            ),

        "time_difference_hours":
            model_time_difference,

        "max_time_difference_hours":
            max_time_difference_hours,

        "max_depth_difference_meters":
            max_depth_difference_meters,

        "observation_profile": {

            "depth":
                observation_depths,

            "values":
                observation_values,
        },

        "model_profile": {

            "depth":
                model_profile.get(
                    "depth",
                    [],
                ),

            "values":
                model_profile.get(
                    "values",
                    [],
                ),
        },

        "matches":
            matches,

        "graph":
            graph,

        "metrics":
            metrics,
    }


# =========================================================
# SIMPLE METRIC FUNCTION
# =========================================================

def calculate_rmse_and_bias(
    model_values: List[float],
    observation_values: List[float],
) -> Dict[
    str,
    Optional[float],
]:

    model = []
    observation = []

    count = min(
        len(model_values),
        len(observation_values),
    )

    for index in range(
        count
    ):

        model_value = safe_float(
            model_values[index]
        )

        observation_value = safe_float(
            observation_values[index]
        )

        if (
            model_value is None
            or
            observation_value is None
        ):

            continue

        model.append(
            model_value
        )

        observation.append(
            observation_value
        )

    if not model:

        return {

            "rmse": None,

            "bias": None,
        }

    model_array = np.asarray(
        model,
        dtype=float,
    )

    observation_array = np.asarray(
        observation,
        dtype=float,
    )

    difference = (
        model_array
        -
        observation_array
    )

    return {

        "rmse":
            float(
                np.sqrt(
                    np.mean(
                        difference ** 2
                    )
                )
            ),

        "bias":
            float(
                np.mean(
                    difference
                )
            ),
    }