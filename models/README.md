# Face Landmarker model

Run `python scripts/setup_model.py` inside the `pomo` environment. Setup runs this
command automatically. It verifies an existing model and only downloads when needed.
Downloaded binaries are ignored by Git; camera frames are never stored here.

- Model: official MediaPipe Face Landmarker, float16, revision 1.
- Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- Model information: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models

The application loads the model once on its dedicated worker and closes it during
shutdown. This milestone decodes frames and reports transport availability only;
face observations and reminder decisions are deferred.
