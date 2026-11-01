"""Long-lived, single-thread processor. Frames and model stay in memory.

Face observations are deliberately deferred: the loaded model is available to
extend this processor in the next perception step.
"""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

from .config import CameraConfig


class FrameProcessor:
    def __init__(self, config: CameraConfig):
        self.config = config
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='pomo-camera')
        self.model = None

    def open(self):
        import mediapipe as mp
        self.model = mp.tasks.vision.FaceLandmarker.create_from_options(
            mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(self.config.model_path)),
                running_mode=mp.tasks.vision.RunningMode.VIDEO))

    def process(self, encoded: bytes):
        import cv2
        import numpy as np
        from PIL import Image, UnidentifiedImageError
        # Inspect dimensions before allocating a decoded OpenCV image.
        try:
            with Image.open(BytesIO(encoded)) as image:
                width, height = image.size
                if image.format != 'JPEG' or not (0 < width <= self.config.width
                                                  and 0 < height <= self.config.height):
                    raise ValueError('Expected a JPEG within configured dimensions')
                image.verify()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
            raise ValueError('Invalid JPEG') from error
        frame = cv2.imdecode(np.frombuffer(encoded, dtype=np.uint8), cv2.IMREAD_COLOR | cv2.IMREAD_IGNORE_ORIENTATION)
        if frame is None:
            raise ValueError('JPEG decode failed')
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return {'width': rgb.shape[1], 'height': rgb.shape[0]}

    def close(self):
        if self.model is not None:
            self.model.close()
            self.model = None
