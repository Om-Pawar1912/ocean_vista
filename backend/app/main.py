from __future__ import annotations

from pathlib import Path
from typing import Optional
import uuid

from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    FRONTEND_URL,
    MAX_UPLOAD_SIZE_BYTES,
    SUPPORTED_EXTENSIONS,
    UPLOAD_DIR,
)

from app.services.dataset_service import (
    add_dataset,
    delete_dataset,
    generate_dataset_id,
    get_dataset,
    get_datasets,
)

from app.services.parser_service import (
    get_netcdf_slice,
    parse_dataset,
)
from app.services.matching_service import (
    match_model_observations,
)


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="OceanVista API",
    description="Ocean Data Visualization System Backend",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DIRECTORIES
# =========================================================

UPLOAD_DIR = Path(UPLOAD_DIR)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/health")
def health_check():

    return {
        "success": True,
        "message": "OceanVista API is running.",
        "status": "healthy",
    }


# =========================================================
# UPLOAD DATASET
# =========================================================

@app.post("/api/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No filename provided.",
        )

    original_filename = Path(
        file.filename
    ).name

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type: {extension}. "
                f"Supported types: "
                f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            ),
        )

    stored_filename = (
        uuid.uuid4().hex + extension
    )

    stored_path = (
        UPLOAD_DIR / stored_filename
    )

    total_size = 0

    try:

        with stored_path.open("wb") as output:

            while True:

                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_UPLOAD_SIZE_BYTES:

                    output.close()

                    if stored_path.exists():
                        stored_path.unlink()

                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Uploaded file is larger "
                            "than the maximum allowed "
                            "size."
                        ),
                    )

                output.write(chunk)

    except HTTPException:
        raise

    except Exception as exc:

        if stored_path.exists():
            stored_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save uploaded file: {exc}"
            ),
        )

    finally:

        await file.close()

    # -----------------------------------------------------
    # Parse dataset
    # -----------------------------------------------------

    try:

        parsed = parse_dataset(
            stored_path
        )

    except Exception as exc:

        if stored_path.exists():
            stored_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=(
                f"Failed to parse dataset: {exc}"
            ),
        )

    # -----------------------------------------------------
    # Dataset ID
    # -----------------------------------------------------

    dataset_id = generate_dataset_id()

    # -----------------------------------------------------
    # Dataset record
    # -----------------------------------------------------

    dataset_record = {

        "id": dataset_id,

        "filename": original_filename,

        "stored_filename": stored_filename,

        "file_type": extension.lstrip("."),

        "size_bytes": total_size,

        "path": str(stored_path),

        "dimensions": parsed.get(
            "dimensions",
            {},
        ),

        "variables": parsed.get(
            "variables",
            [],
        ),

        "instruments": parsed.get(
            "instruments",
            [],
        ),

        "attributes": parsed.get(
            "attributes",
            {},
        ),
    }

    # -----------------------------------------------------
    # Save registry
    # -----------------------------------------------------

    try:

        add_dataset(
            dataset_record
        )

    except Exception as exc:

        if stored_path.exists():
            stored_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save dataset metadata: {exc}"
            ),
        )

    return {

        "success": True,

        "message": (
            "Dataset uploaded and parsed successfully."
        ),

        "dataset": {

            "id": dataset_id,

            "filename": original_filename,

            "file_type": extension.lstrip("."),

            "size_bytes": total_size,

            "dimensions": parsed.get(
                "dimensions",
                {},
            ),

            "variables": parsed.get(
                "variables",
                [],
            ),

            "instruments_count": len(
                parsed.get(
                    "instruments",
                    [],
                )
            ),
        },

        "instruments": parsed.get(
            "instruments",
            [],
        ),
    }


# =========================================================
# LIST DATASETS
# =========================================================

@app.get("/api/datasets")
def list_datasets():

    datasets = get_datasets()

    result = []

    for dataset in datasets:

        instruments = dataset.get(
            "instruments",
            [],
        )

        variables = dataset.get(
            "variables",
            [],
        )

        result.append({

            "id": dataset.get("id"),

            "filename": dataset.get(
                "filename"
            ),

            "file_type": dataset.get(
                "file_type"
            ),

            "size_bytes": dataset.get(
                "size_bytes"
            ),

            "dimensions": dataset.get(
                "dimensions",
                {},
            ),

            "variables_count": len(
                variables
            ),

            "instruments_count": len(
                instruments
            ),
        })

    return {

        "success": True,

        "count": len(result),

        "datasets": result,
    }


# =========================================================
# DATASET DETAILS
# =========================================================

@app.get("/api/datasets/{dataset_id}")
def dataset_details(
    dataset_id: str
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    instruments = dataset.get(
        "instruments",
        [],
    )

    return {

        "success": True,

        "dataset": {

            "id": dataset.get(
                "id"
            ),

            "filename": dataset.get(
                "filename"
            ),

            "file_type": dataset.get(
                "file_type"
            ),

            "size_bytes": dataset.get(
                "size_bytes"
            ),

            "dimensions": dataset.get(
                "dimensions",
                {},
            ),

            "variables": dataset.get(
                "variables",
                [],
            ),

            "attributes": dataset.get(
                "attributes",
                {},
            ),

            "instruments_count": len(
                instruments
            ),
        },
    }


# =========================================================
# DATASET INSTRUMENTS
# =========================================================

@app.get(
    "/api/datasets/{dataset_id}/instruments"
)
def dataset_instruments(
    dataset_id: str
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    instruments = dataset.get(
        "instruments",
        [],
    )

    return {

        "success": True,

        "dataset_id": dataset_id,

        "count": len(
            instruments
        ),

        "instruments": instruments,
    }


# =========================================================
# DATASET VARIABLES
# =========================================================

@app.get(
    "/api/datasets/{dataset_id}/variables"
)
def dataset_variables(
    dataset_id: str
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    variables = dataset.get(
        "variables",
        [],
    )

    return {

        "success": True,

        "dataset_id": dataset_id,

        "count": len(
            variables
        ),

        "variables": variables,
    }


# =========================================================
# DATASET SLICE
# =========================================================

@app.get(
    "/api/datasets/{dataset_id}/slice"
)
def dataset_slice(
    dataset_id: str,

    variable: str = Query(
        ...
    ),

    depth: Optional[float] = Query(
        None
    ),

    time_index: Optional[int] = Query(
        None
    ),
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    file_path = Path(
        dataset.get(
            "path",
            "",
        )
    )

    if not file_path.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Dataset file does not exist "
                "on the server."
            ),
        )

    try:

        result = get_netcdf_slice(
            file_path=file_path,
            variable=variable,
            depth=depth,
            time_index=time_index,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    return {

        "success": True,

        "dataset_id": dataset_id,

        "slice": result,
    }


# =========================================================
# ALL INSTRUMENTS
# =========================================================

@app.get("/api/instruments")
def all_instruments(
    dataset_id: Optional[str] = Query(
        None
    )
):

    # -----------------------------------------------------
    # Specific dataset
    # -----------------------------------------------------

    if dataset_id:

        dataset = get_dataset(
            dataset_id
        )

        if dataset is None:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"Dataset '{dataset_id}' not found."
                ),
            )

        instruments = dataset.get(
            "instruments",
            [],
        )

        return {

            "success": True,

            "dataset_id": dataset_id,

            "count": len(
                instruments
            ),

            "instruments": instruments,
        }

    # -----------------------------------------------------
    # All datasets
    # -----------------------------------------------------

    result = []

    datasets = get_datasets()

    for dataset in datasets:

        for instrument in dataset.get(
            "instruments",
            [],
        ):

            item = dict(
                instrument
            )

            item[
                "dataset_id"
            ] = dataset.get(
                "id"
            )

            item[
                "dataset_filename"
            ] = dataset.get(
                "filename"
            )

            result.append(
                item
            )

    return {

        "success": True,

        "count": len(
            result
        ),

        "instruments": result,
    }


# =========================================================
# SINGLE INSTRUMENT
# =========================================================

@app.get(
    "/api/instruments/{instrument_id}"
)
def single_instrument(
    instrument_id: str
):

    datasets = get_datasets()

    # Prefer an instrument that has a profile
    fallback = None

    for dataset in datasets:

        for instrument in dataset.get(
            "instruments",
            [],
        ):

            if str(
                instrument.get("id")
            ) != str(instrument_id):

                continue

            profile = instrument.get(
                "profile"
            )

            if (
                isinstance(profile, dict)
                and profile.get("depth")
                and profile.get("variables")
            ):

                return {

                    "success": True,

                    "dataset": {

                        "id": dataset.get(
                            "id"
                        ),

                        "filename": dataset.get(
                            "filename"
                        ),
                    },

                    "instrument": instrument,
                }

            if fallback is None:

                fallback = (
                    dataset,
                    instrument
                )

    if fallback:

        dataset, instrument = fallback

        return {

            "success": True,

            "dataset": {

                "id": dataset.get(
                    "id"
                ),

                "filename": dataset.get(
                    "filename"
                ),
            },

            "instrument": instrument,
        }

    raise HTTPException(
        status_code=404,
        detail=(
            f"Instrument '{instrument_id}' not found."
        ),
    )


# =========================================================
# INSTRUMENT PROFILE
# =========================================================

@app.get(
    "/api/instruments/{instrument_id}/profile"
)
def instrument_profile(
    instrument_id: str
):

    datasets = get_datasets()

    fallback_instrument = None
    fallback_dataset = None

    # -----------------------------------------------------
    # First pass:
    # Find instrument WITH a real profile
    # -----------------------------------------------------

    for dataset in datasets:

        instruments = dataset.get(
            "instruments",
            []
        )

        for instrument in instruments:

            if str(
                instrument.get("id")
            ) != str(instrument_id):

                continue

            profile = instrument.get(
                "profile"
            )

            # -------------------------------------------------
            # Correct profile found
            # -------------------------------------------------

            if (
                isinstance(profile, dict)
                and profile.get("depth")
                and profile.get("variables")
            ):

                return {

                    "success": True,

                    "instrument": {

                        "id": instrument.get(
                            "id"
                        ),

                        "type": instrument.get(
                            "type"
                        ),

                        "latitude": instrument.get(
                            "latitude"
                        ),

                        "longitude": instrument.get(
                            "longitude"
                        ),

                        "time": instrument.get(
                            "time"
                        ),

                        "status": instrument.get(
                            "status"
                        ),
                    },

                    "profile": {

                        "depth": profile.get(
                            "depth",
                            []
                        ),

                        "variables": profile.get(
                            "variables",
                            {}
                        ),
                    },

                    "dataset": {

                        "id": dataset.get(
                            "id"
                        ),

                        "filename": dataset.get(
                            "filename"
                        ),
                    },
                }

            # -------------------------------------------------
            # Save first old record as fallback
            # -------------------------------------------------

            if fallback_instrument is None:

                fallback_instrument = instrument
                fallback_dataset = dataset

    # -----------------------------------------------------
    # No instrument
    # -----------------------------------------------------

    if fallback_instrument is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Instrument '{instrument_id}' "
                f"not found."
            ),
        )

    # -----------------------------------------------------
    # Instrument exists but no profile
    # -----------------------------------------------------

    return {

        "success": True,

        "instrument": {

            "id": fallback_instrument.get(
                "id"
            ),

            "type": fallback_instrument.get(
                "type"
            ),

            "latitude": fallback_instrument.get(
                "latitude"
            ),

            "longitude": fallback_instrument.get(
                "longitude"
            ),

            "time": fallback_instrument.get(
                "time"
            ),

            "status": fallback_instrument.get(
                "status"
            ),
        },

        "profile": {

            "depth": [],

            "variables": {},
        },

        "dataset": {

            "id": fallback_dataset.get(
                "id"
            ),

            "filename": fallback_dataset.get(
                "filename"
            ),
        },

        "warning": (
            "This instrument exists, but a "
            "depth-resolved profile was not found."
        ),
    }


# =========================================================
# DATASET STATISTICS
# =========================================================

@app.get(
    "/api/datasets/{dataset_id}/statistics"
)
def dataset_statistics(
    dataset_id: str
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    instruments = dataset.get(
        "instruments",
        []
    )

    collected = {}

    for instrument in instruments:

        profile = instrument.get(
            "profile",
            {}
        )

        variables = profile.get(
            "variables",
            {}
        )

        for variable_name, values in variables.items():

            if variable_name not in collected:

                collected[
                    variable_name
                ] = []

            for value in values:

                if value is None:
                    continue

                try:

                    collected[
                        variable_name
                    ].append(
                        float(value)
                    )

                except (
                    TypeError,
                    ValueError,
                ):

                    continue

    result = {}

    for variable_name, values in collected.items():

        if not values:
            continue

        result[
            variable_name
        ] = {

            "count": len(
                values
            ),

            "min": min(
                values
            ),

            "max": max(
                values
            ),

            "mean": (
                sum(values)
                / len(values)
            ),
        }

    return {

        "success": True,

        "dataset_id": dataset_id,

        "statistics": result,
    }


# =========================================================
# DELETE DATASET
# =========================================================

@app.delete(
    "/api/datasets/{dataset_id}"
)
def remove_dataset(
    dataset_id: str
):

    dataset = get_dataset(
        dataset_id
    )

    if dataset is None:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    # -----------------------------------------------------
    # Delete physical file
    # -----------------------------------------------------

    file_path = dataset.get(
        "path"
    )

    if file_path:

        path = Path(
            file_path
        )

        if path.exists():

            try:

                path.unlink()

            except Exception as exc:

                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Could not delete "
                        f"dataset file: {exc}"
                    ),
                )

    # -----------------------------------------------------
    # Delete registry entry
    # -----------------------------------------------------

    deleted = delete_dataset(
        dataset_id
    )

    if not deleted:

        raise HTTPException(
            status_code=404,
            detail=(
                f"Dataset '{dataset_id}' not found."
            ),
        )

    return {

        "success": True,

        "message": (
            "Dataset deleted successfully."
        ),

        "dataset_id": dataset_id,
    }


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
async def startup_event():

    print()
    print("=" * 60)
    print("OceanVista API")
    print("=" * 60)
    print(
        "API:     http://127.0.0.1:8000"
    )
    print(
        "Swagger: http://127.0.0.1:8000/docs"
    )
    print("=" * 60)
    print()
    
    # =========================================================
# MODEL VS OBSERVATION MATCHING
# =========================================================

@app.get("/api/match-model-observations")
def match_model_observations_endpoint(
    instrument_id: str = Query(
        ...
    ),

    instrument_type: Optional[str] = Query(
        None
    ),

    variable: str = Query(
        "temperature"
    ),

    max_time_difference_hours: float = Query(
        24
    ),
):
    """
    Match one selected ARGO / GLIDER instrument
    against the registered model dataset.
    """

    try:

        result = match_model_observations(
            instrument_id=instrument_id,

            variable=variable,

            instrument_type=instrument_type,

            max_time_difference_hours=(
                max_time_difference_hours
            ),
        )

        return {

            "success": True,

            "instrument_id":
                instrument_id,

            "instrument_type":
                instrument_type,

            "variable":
                variable,

            "max_time_difference_hours":
                max_time_difference_hours,

            "result":
                result,
        }

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to match model observations: "
                f"{exc}"
            ),
        )