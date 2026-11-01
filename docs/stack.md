# Stack choices

`environment.yml` defines the `pomo` Conda environment with Python 3.13 and pip.
The existing application, transitive and test package versions are preserved in
its `pip` section. Conda resolves the Python 3.13 patch version and pip version.

| Selected | Reason | Alternative considered |
| --- | --- | --- |
| Python 3.13 + FastAPI | HTTP, WebSocket and validation support; future Python perception integration | Flask requires an additional WebSocket integration |
| Uvicorn + websockets | Standard ASGI and WebSocket transport | Hand-written sockets add unnecessary protocol work |
| Plain HTML/CSS/JS | Small interface without a frontend build toolchain | React adds tooling; Gradio is useful for model demos but offers less direct control of this robot UI and transport |
| python-dotenv | Simple local configuration; environment variables override file values | Shell-only configuration is less convenient |
| pytest + HTTPX | Tests actual HTTP and WebSocket routes | State-only tests miss protocol errors |

Official reference: https://fastapi.tiangolo.com/advanced/websockets/

Conda environment format: https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html#creating-an-environment-file-manually

No Node runtime, database or external fonts are required.

Camera foundation uses `opencv-contrib-python==5.0.0.93` and `mediapipe==1.2.0`.
Only one OpenCV distribution is installed; MediaPipe already depends on contrib.
Pillow validates JPEG headers before OpenCV allocates the decoded image. NumPy,
Pillow and all newly resolved Python dependencies are pinned in `environment.yml`.
Linux EGL/GLES native libraries are declared using CEP-24 comment selectors;
setup uses `--format cep-24` (verified with Conda 26.9.4).

A Windows browser owns getUserMedia capture and the direct video preview. WSL
receives sequential bounded JPEG HTTP uploads; it does not need camera passthrough.
One dedicated worker initializes the model, decodes frames and closes the model.
Face observations and reminder policy remain deferred. The model manifest is in
`models/README.md`; setup verifies its fixed revision and checksum.

UI choices do not commit the firmware to a browser stack.
