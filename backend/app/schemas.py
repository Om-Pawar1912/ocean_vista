from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# =========================================================
# VARIABLE
# =========================================================

class VariableInfo(BaseModel):

    name: str

    dimensions: List[str] = []

    shape: List[int] = []

    dtype: Optional[str] = None

    units: Optional[str] = None

    long_name: Optional[str] = None


# =========================================================
# INSTRUMENT
# =========================================================

class Instrument(BaseModel):

    id: str

    type: str = "ARGO"

    latitude: Optional[float] = None

    longitude: Optional[float] = None

    depth: Optional[float] = None

    time: Optional[str] = None

    status: str = "Active"

    values: Dict[str, Any] = {}


# =========================================================
# DATASET SUMMARY
# =========================================================

class DatasetSummary(BaseModel):

    id: str

    filename: str

    file_type: str

    size_bytes: int

    instruments_count: int = 0

    variables_count: int = 0

    dimensions: Dict[str, int] = {}

    variables: List[VariableInfo] = []


# =========================================================
# SLICE RESPONSE
# =========================================================

class DatasetSlice(BaseModel):

    dataset_id: str

    variable: str

    depth: Optional[float] = None

    time_index: Optional[int] = None

    latitude: List[float] = []

    longitude: List[float] = []

    values: List[List[Optional[float]]] = []

    units: Optional[str] = None

    min_value: Optional[float] = None

    max_value: Optional[float] = None