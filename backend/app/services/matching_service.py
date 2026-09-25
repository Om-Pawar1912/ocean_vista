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
# BASIC HELPERS
# =========================================================

def safe_float(value) -> Optional[float]:
    """
    Safely convert a value to float.
    """

    try:
        if value is None:
            return None

        if pd.isna(value):
            return None

        number = float(value)

        if not math.isfinite(number):
            return None

        return number

    except Exception:
        return None


def safe_string(value) -> Optional[str]:
    """
    Safely convert a value to string.
    """

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return str(value)


def normalize_variable_name(variable: str) -> str:
    """
    Convert variable name to the standard OceanVista name.
    """

    variable = str(variable).strip()

    if variable in VARIABLE_ALIASES:
        return variable

    variable_lower = variable.lower()

    for standard_name, aliases in VARIABLE_ALIASES.items():

        if variable_lower == standard_name.lower():
            return standard_name

        for alias in aliases:

            if variable_lower == str(alias).lower():
                return standard_name

    return variable


# =========================================================
# TIME HELPERS
# =========================================================

def parse_time(value) -> Optional[pd.Timestamp]:
    """
    Convert different time representations into pandas Timestamp.
    """

    if value is None:
        return None

    try:

        if pd.isna(value):
            return None

    except Exception:
        pass

    try:

        timestamp = pd.Timestamp(value)

        if pd.isna(timestamp):
            return None

        return timestamp

    except Exception:

        return None


def time_difference_hours(
    first_time,
    second_time,
) -> Optional[float]:
    """
    Return absolute time difference in hours.
    """

    first = parse_time(first_time)
    second = parse_time(second_time)

    if first is None or second is None:
        return None

    try:

        difference = abs(
            (
                first - second
            ).total_seconds()
        )

        return difference / 3600.0

    except Exception:

        return None


# =========================================================
# DATASET TYPE HELPERS
# =========================================================

def is_model_dataset(dataset: Dict[str, Any]) -> bool:
    """
    Determine whether a registered dataset is a model dataset.

    Detection is intentionally conservative.
    """

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
    ]

    return any(
        keyword in combined
        for keyword in model_keywords
    )


def is_observation_instrument(
    instrument: Dict[str, Any],
) -> bool:
    """
    Determine whether an instrument is an observation platform.
    """

    instrument_type = str(
        instrument.get(
            "type",
            "",
        )
    ).upper()

    return instrument_type in {
        "ARGO",
        "GLIDER",
        "CTD",
        "BGC",
        "MOORING",
    }


# =========================================================
# INSTRUMENT SEARCH
# =========================================================

def find_instrument(
    instrument_id: str,
    instrument_type: Optional[str] = None,
) -> Tuple[
    Optional[Dict[str, Any]],
    Optional[Dict[str, Any]],
]:
    """
    Search all registered datasets for an instrument.

    Returns:

        instrument
        dataset
    """

    requested_id = str(
        instrument_id
    )

    requested_type = (
        str(instrument_type).upper()
        if instrument_type
        else None
    )

    for dataset in get_datasets():

        instruments = dataset.get(
            "instruments",
            [],
        )

        for instrument in instruments:

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

            return instrument, dataset

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
    """
    Extract depth/value pairs from an observation instrument.
    """

    profile = instrument.get(
        "profile",
        {},
    )

    if not isinstance(profile, dict):
        return [], []

    depths = profile.get(
        "depth",
        [],
    )

    variables = profile.get(
        "variables",
        {},
    )

    if not isinstance(variables, dict):
        return [], []

    standard_variable = normalize_variable_name(
        variable
    )

    values = variables.get(
        standard_variable
    )

    if values is None:

        # Try aliases directly.
        aliases = VARIABLE_ALIASES.get(
            standard_variable,
            [standard_variable],
        )

        for alias in aliases:

            if alias in variables:

                values = variables[
                    alias
                ]

                break

    if values is None:
        return [], []

    result_depths = []
    result_values = []

    count = min(
        len(depths),
        len(values),
    )

    for index in range(count):

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
# MODEL COORDINATE DETECTION
# =========================================================

def find_coordinate_name(
    dataset: xr.Dataset,
    candidates: List[str],
) -> Optional[str]:
    """
    Find latitude/longitude/depth/time coordinate.
    """

    return find_variable(
        dataset.variables,
        candidates,
    )


def find_dimension_for_coordinate(
    data_array: xr.DataArray,
    coordinate_name: Optional[str],
) -> Optional[str]:
    """
    Find the dimension associated with a coordinate.
    """

    if not coordinate_name:
        return None

    if coordinate_name not in data_array:
        return None

    dims = list(
        data_array[
            coordinate_name
        ].dims
    )

    if not dims:
        return None

    return dims[0]


# =========================================================
# MODEL DATA VARIABLE
# =========================================================

def resolve_model_variable(
    dataset: xr.Dataset,
    variable: str,
) -> Optional[str]:
    """
    Resolve requested standard variable to actual
    model NetCDF variable.
    """

    standard_variable = normalize_variable_name(
        variable
    )

    aliases = VARIABLE_ALIASES.get(
        standard_variable,
        [standard_variable],
    )

    return find_variable(
        dataset.data_vars,
        aliases,
    )


# =========================================================
# NEAREST INDEX
# =========================================================

def nearest_index(
    values,
    target,
) -> Optional[int]:
    """
    Return index of nearest numeric coordinate.
    """

    try:

        array = np.asarray(
            values,
            dtype=float,
        )

        target_value = float(
            target
        )

    except Exception:

        return None

    if array.size == 0:
        return None

    valid_mask = np.isfinite(
        array
    )

    if not np.any(valid_mask):
        return None

    valid_indices = np.where(
        valid_mask
    )[0]

    valid_values = array[
        valid_mask
    ]

    index_in_valid = int(
        np.argmin(
            np.abs(
                valid_values
                - target_value
            )
        )
    )

    return int(
        valid_indices[
            index_in_valid
        ]
    )


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
    """
    Extract a model vertical profile nearest to the
    observation's location and time.

    The function supports common model structures such as:

        time, depth, lat, lon
        depth, lat, lon
        time, depth, latitude, longitude
    """

    dataset = xr.open_dataset(
        file_path,
        decode_times=True,
    )

    try:

        # =================================================
        # COORDINATES
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
        # MODEL VARIABLE
        # =================================================

        actual_variable = resolve_model_variable(
            dataset,
            variable,
        )

        if actual_variable is None:

            raise ValueError(
                f"Model variable '{variable}' was not found."
            )

        data = dataset[
            actual_variable
        ]

        # =================================================
        # LATITUDE
        # =================================================

        lat_coord = dataset[
            lat_name
        ]

        if lat_coord.ndim == 1:

            lat_dim = lat_coord.dims[0]

            data = data.sel(
                {
                    lat_dim: latitude
                },
                method="nearest",
            )

        # =================================================
        # LONGITUDE
        # =================================================

        lon_coord = dataset[
            lon_name
        ]

        if lon_coord.ndim == 1:

            lon_dim = lon_coord.dims[0]

            data = data.sel(
                {
                    lon_dim: longitude
                },
                method="nearest",
            )

        # =================================================
        # TIME
        # =================================================

        selected_model_time = None

        if (
            time_name
            and time_name in dataset.variables
            and time_name in data.dims
        ):

            model_time_coord = dataset[
                time_name
            ]

            observation_timestamp = parse_time(
                observation_time
            )

            if observation_timestamp is not None:

                try:

                    data = data.sel(
                        {
                            time_name:
                            observation_timestamp
                        },
                        method="nearest",
                    )

                    selected_model_time = (
                        data.coords[
                            time_name
                        ].item()
                        if time_name
                        in data.coords
                        else None
                    )

                except Exception:

                    selected_model_time = None

        # =================================================
        # DEPTH
        # =================================================

        if depth_name not in data.dims:

            # Depth may exist as a coordinate with
            # a different dimension name.
            depth_coord = dataset[
                depth_name
            ]

            depth_dims = list(
                depth_coord.dims
            )

            if depth_dims:

                depth_dim = depth_dims[0]

            else:

                depth_dim = None

        else:

            depth_dim = depth_name

        if depth_dim is None:

            raise ValueError(
                "Could not determine model depth dimension."
            )

        # =================================================
        # KEEP ONLY DEPTH
        # =================================================

        remaining_dims = list(
            data.dims
        )

        for dimension in remaining_dims:

            if dimension != depth_dim:

                try:

                    if data.sizes.get(
                        dimension,
                        0,
                    ) == 1:

                        data = data.isel(
                            {
                                dimension:
                                0
                            }
                        )

                except Exception:

                    pass

        # =================================================
        # CONVERT VALUES
        # =================================================

        depth_coord = dataset[
            depth_name
        ]

        depths = np.asarray(
            depth_coord.values
        ).squeeze()

        values = np.asarray(
            data.values
        ).squeeze()

        # -------------------------------------------------
        # Handle remaining dimensions safely.
        # -------------------------------------------------

        while values.ndim > 1:

            values = values[0]

        if values.ndim == 0:

            values = np.array(
                [
                    values.item()
                ]
            )

        depths = np.asarray(
            depths
        ).flatten()

        values = np.asarray(
            values
        ).flatten()

        count = min(
            len(depths),
            len(values),
        )

        result_depths = []
        result_values = []

        for index in range(count):

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

        # =================================================
        # MODEL LOCATION
        # =================================================

        model_latitude = None
        model_longitude = None

        try:

            model_latitude = safe_float(
                dataset[
                    lat_name
                ].sel(
                    {
                        dataset[
                            lat_name
                        ].dims[0]:
                        latitude
                    },
                    method="nearest",
                ).values
            )

        except Exception:

            pass

        try:

            model_longitude = safe_float(
                dataset[
                    lon_name
                ].sel(
                    {
                        dataset[
                            lon_name
                        ].dims[0]:
                        longitude
                    },
                    method="nearest",
                ).values
            )

        except Exception:

            pass

        # =================================================
        # TIME DIFFERENCE
        # =================================================

        time_difference = (
            time_difference_hours(
                observation_time,
                selected_model_time,
            )
        )

        return {

            "variable":
                variable,

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
    max_depth_difference: float = DEFAULT_MAX_DEPTH_DIFFERENCE_METERS,
) -> List[Dict[str, float]]:
    """
    Match observation and model values by nearest depth.
    """

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

    matches = []

    for index in range(
        min(
            len(observation_depths),
            len(observation_values),
        )
    ):

        observation_depth = safe_float(
            observation_depths[index]
        )

        observation_value = safe_float(
            observation_values[index]
        )

        if (
            observation_depth is None
            or observation_value is None
        ):
            continue

        valid_mask = np.isfinite(
            model_depth_array
        ) & np.isfinite(
            model_value_array
        )

        if not np.any(valid_mask):
            continue

        valid_depths = model_depth_array[
            valid_mask
        ]

        valid_values = model_value_array[
            valid_mask
        ]

        nearest = int(
            np.argmin(
                np.abs(
                    valid_depths
                    - observation_depth
                )
            )
        )

        model_depth = float(
            valid_depths[nearest]
        )

        model_value = float(
            valid_values[nearest]
        )

        depth_difference = abs(
            model_depth
            - observation_depth
        )

        if (
            depth_difference
            > max_depth_difference
        ):
            continue

        matches.append(
            {

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

            }
        )

    return matches


# =========================================================
# METRICS
# =========================================================

def calculate_metrics(
    matches: List[Dict[str, float]],
) -> Dict[str, Any]:
    """
    Calculate real Model-vs-Observation metrics.
    """

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
        np.isfinite(model_values)
        &
        np.isfinite(
            observation_values
        )
    )

    model_values = model_values[
        valid
    ]

    observation_values = (
        observation_values[
            valid
        ]
    )

    if len(model_values) == 0:

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

    differences = (
        model_values
        -
        observation_values
    )

    squared_errors = (
        differences ** 2
    )

    absolute_errors = np.abs(
        differences
    )

    rmse = float(
        np.sqrt(
            np.mean(
                squared_errors
            )
        )
    )

    bias = float(
        np.mean(
            differences
        )
    )

    mae = float(
        np.mean(
            absolute_errors
        )
    )

    correlation = None

    if len(model_values) >= 2:

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
            and observation_std > 0
        ):

            correlation = float(
                np.corrcoef(
                    model_values,
                    observation_values,
                )[0, 1]
            )

    return {

        "count":
            int(
                len(
                    model_values
                )
            ),

        "rmse":
            rmse,

        "bias":
            bias,

        "mae":
            mae,

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
# FIND MODEL DATASET
# =========================================================

def find_model_dataset(
    preferred_dataset_id: Optional[str] = None,
) -> Tuple[
    Optional[Dict[str, Any]],
    Optional[str],
]:
    """
    Find a registered model dataset.

    If dataset_id is supplied, it is checked first.
    """

    datasets = get_datasets()

    if preferred_dataset_id:

        for dataset in datasets:

            if str(
                dataset.get("id")
            ) == str(
                preferred_dataset_id
            ):

                file_path = dataset.get(
                    "path"
                )

                if file_path:

                    return (
                        dataset,
                        file_path,
                    )

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

        if Path(
            file_path
        ).exists():

            return (
                dataset,
                file_path,
            )

    return None, None


# =========================================================
# MAIN MATCHING FUNCTION
# =========================================================

def match_model_observations(
    instrument_id: str,
    variable: str,
    instrument_type: Optional[str] = None,
    model_dataset_id: Optional[str] = None,
    max_time_difference_hours: float = DEFAULT_MAX_TIME_DIFFERENCE_HOURS,
    max_depth_difference_meters: float = DEFAULT_MAX_DEPTH_DIFFERENCE_METERS,
) -> Dict[str, Any]:
    """
    Main Model-vs-Observation matching function.

    Steps:

        1. Find selected ARGO/GLIDER instrument.
        2. Read its observation profile.
        3. Find model dataset.
        4. Select model data nearest to observation
           latitude/longitude/time.
        5. Match model and observation by depth.
        6. Calculate RMSE, Bias, MAE and Correlation.
    """

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
    # OBSERVATION LOCATION
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
            variable,
        )
    )

    if not observation_depths:

        raise ValueError(
            f"No observation depth profile found "
            f"for variable '{variable}'."
        )

    # =====================================================
    # MODEL DATASET
    # =====================================================

    model_dataset, model_file_path = (
        find_model_dataset(
            preferred_dataset_id=
                model_dataset_id
        )
    )

    if model_dataset is None:

        raise ValueError(
            "No model dataset was found."
        )

    model_path = Path(
        model_file_path
    )

    if not model_path.exists():

        raise ValueError(
            "Model dataset file does not exist."
        )

    # =====================================================
    # MODEL PROFILE
    # =====================================================

    model_profile = extract_model_profile(
        file_path=model_path,
        latitude=latitude,
        longitude=longitude,
        observation_time=observation_time,
        variable=variable,
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
        > max_time_difference_hours
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
                    instrument.get("id"),

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
                variable,

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
    # RESULT
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
            variable,

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

        "metrics":
            metrics,

    }


# =========================================================
# SIMPLE METRIC FUNCTION
# =========================================================

def calculate_rmse_and_bias(
    model_values: List[float],
    observation_values: List[float],
) -> Dict[str, Optional[float]]:
    """
    Simple utility for already-matched arrays.

    Useful if the frontend/backend already has
    matching depth values.
    """

    model = []
    observation = []

    count = min(
        len(model_values),
        len(observation_values),
    )

    for index in range(count):

        model_value = safe_float(
            model_values[index]
        )

        observation_value = safe_float(
            observation_values[index]
        )

        if (
            model_value is None
            or observation_value is None
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