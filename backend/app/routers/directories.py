import os
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Directories"])

# Note: create-directory endpoint is now in delete.py router to avoid route conflict
# This router is kept for future directory-specific operations
