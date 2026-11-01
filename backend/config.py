"""Validated browser-camera settings; environment is loaded by __main__."""
import os
from pathlib import Path

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]


class CameraConfig(BaseModel):
    width: int = Field(default=640, ge=64, le=1920)
    height: int = Field(default=480, ge=64, le=1080)
    fps: int = Field(default=10, ge=1, le=30)
    jpeg_quality: float = Field(default=0.75, ge=0.1, le=1)
    max_bytes: int = Field(default=524288, ge=1024, le=2097152)
    timeout_seconds: float = Field(default=3, ge=0.1, le=60)
    startup_seconds: float = Field(default=30, ge=1, le=120)
    model_path: Path = ROOT / 'models/face_landmarker.task'

    @classmethod
    def from_env(cls):
        names = {name: os.environ[f'POMO_CAMERA_{name.upper()}']
                 for name in cls.model_fields
                 if f'POMO_CAMERA_{name.upper()}' in os.environ}
        return cls(**names)

    def browser_settings(self):
        return self.model_dump(exclude={'model_path'})
