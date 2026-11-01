"""Use the actual JPEG decoder without requiring a model or physical camera."""
from backend.camera import FrameProcessor


class DecodeProcessor(FrameProcessor):
    def open(self):
        pass

    def close(self):
        pass
