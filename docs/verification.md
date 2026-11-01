# Phase 1 verification — 26 October 2026

Verified locally on macOS with Python 3.13:

- Four pytest integration tests passed: health/static routes, multi-client state
  broadcast and reconnect/restart semantics, malformed commands and disabled previews.
- JavaScript syntax check passed (`node --check simulator/app.js`).
- Real Uvicorn server bound to 127.0.0.1:8000.
- Live HTTP requests returned 200 for /, /health, /app.js and /style.css.
- Two real WebSocket clients received matching updates for all four expression
  previews. A new connection received current state after clients disconnected.

Limitations:

- No browser was available through the UI automation tools. Rendered appearance,
  responsive layout and browser-side automatic reconnection need a manual check
  using the README demo. Backend reconnection was verified separately.
- No cloud workspace/provider was available; forwarded HTTPS/WSS preview remains
  unverified. Cloud startup instructions are included in the README.
- The test stack emits a Starlette deprecation warning for its HTTPX test adapter;
  the tests currently pass. Revisit the adapter when upgrading test dependencies.
- A teammate's independent fresh installation has not been performed.

Camera detection, reminder policy and physical hardware are intentionally outside
Phase 1. No camera or microphone permissions were requested.

## Conda setup verification — 31 October 2026

Verified on macOS ARM64 with Conda 25.1.1 and Python 3.13.18:

- `sh scripts/setup.sh` created the `pomo` environment from `environment.yml`.
  A second run completed successfully with the same 24 pinned Python packages.
- `conda run --name pomo python -m pytest -q` passed all four integration tests.
  The existing Starlette/HTTPX deprecation warning remains.
- `conda run --name pomo python -m pip check` found no broken requirements.
- `scripts/dev.sh` started the backend through Conda on a temporary localhost
  port. `/` and `/health` returned 200, a WebSocket expression command was
  acknowledged, and Ctrl+C shut down the backend.

Conda setup on Windows and Linux has not been verified.

## 2026-10-31 — WSL browser-camera foundation (steps 1–4)

- Worked in `/home/vivian/pomo` on the existing `feature/camera` branch, using
  the activated `pomo` environment (Python 3.13.18).
- Installed OpenCV contrib 5.0.0.93 and MediaPipe 1.2.0. Resolved MediaPipe's
  missing `libGLESv2.so.2` with Linux-only EGL/GLES Conda dependencies declared
  in `environment.yml`; setup uses CEP-24 selectors (Conda 26.9.4).
- Environment update via `sh scripts/setup.sh` and checksum verification passed.
  Model float16 revision 1 was downloaded from Google's official model bucket;
  exact URL and SHA-256 are recorded in `models/README.md`.
- Real-model app smoke check: startup readiness, HTTP JPEG ingestion, WebSocket
  camera availability, pause and shutdown passed.
- Real OpenCV import, synthetic JPEG decode/BGR-to-RGB conversion, model creation,
  blank-image inference (zero faces) and model close passed on the dedicated
  worker. Native MediaPipe informational/warning messages appeared.
- Backend integration suite: **18 passed**, with the pre-existing
  Starlette/HTTPX deprecation warning. Tests cover shared state, ownership, malformed/oversized
  images, replayed sequences, owner disconnect, watchdog expiration, backpressure,
  processing timeout, pause during processing and initialization/processing errors.
- `python -m pip check`: no broken requirements. JavaScript syntax checks and
  `node --test tests/test_camera_client.cjs` passed using a locally downloaded,
  ignored Node 22.14.0 executable. Three client tests passed; they exercise late permission grants,
  sequential uploads, abort/track cleanup and permission-denial messaging with mocks.
- `sh -n scripts/setup.sh scripts/dev.sh` and `git diff --check` passed.
- HTTP/WebSocket tests require execution outside this tool sandbox: sandboxed
  Starlette TestClient stalled creating its event-loop portal before app startup.
  No application workaround was added for that tooling restriction.
- Physical Windows webcam access, browser layout/accessibility, real browser
  permissions, tab lifecycle, Windows/macOS installation and HTTPS forwarding have
  **not** been validated. No face observations or automatic reminders are enabled.
