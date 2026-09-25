from pathlib import Path


# =========================================================
# BASE DIRECTORIES
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

UPLOAD_DIR = DATA_DIR / "uploads"

REGISTRY_FILE = DATA_DIR / "registry.json"


# =========================================================
# SUPPORTED FILE TYPES
# =========================================================

SUPPORTED_EXTENSIONS = {
    ".nc",
    ".cdf",
    ".csv",
    ".txt",
}


# =========================================================
# MAXIMUM UPLOAD SIZE
# =========================================================

MAX_UPLOAD_SIZE_MB = 500

MAX_UPLOAD_SIZE_BYTES = (
    MAX_UPLOAD_SIZE_MB * 1024 * 1024
)


# =========================================================
# CORS
# =========================================================

FRONTEND_URL = "http://localhost:5173"


# =========================================================
# ENSURE DIRECTORIES EXIST
# =========================================================

DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

if not REGISTRY_FILE.exists():
    REGISTRY_FILE.write_text(
        '{"datasets": []}',
        encoding="utf-8",
    )