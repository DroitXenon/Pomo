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

## Camera, observations and behaviour — 31 October–1 November 2026

Implemented in `/home/vivian/pomo` on `feature/camera`, using the activated `pomo`
environment with Python 3.13.18, OpenCV contrib 5.0.0.93 and MediaPipe 1.2.0.

### Environment and model

- Conda setup with CEP-24 selectors passed using Conda 26.9.4. Linux-only EGL/GLES
  dependencies support MediaPipe in WSL. Model float16 revision 1 checksum passed;
  source and SHA-256 are recorded in `models/README.md`.
- Real-model smoke checks passed for initialization, JPEG decoding, RGB conversion,
  inference, HTTP ingestion, WebSocket snapshots, pause and shutdown. A detailed
  synthetic noise scene produced no face/awaiting-face; a black scene produced
  unknown/low-light without a reminder. Images stayed in memory.
- `python -m pip check`: no broken requirements.

### Automated checks

- Backend suite: **46 passed**, with the existing Starlette/HTTPX deprecation
  warning. Tests cover frame validation, ownership, ordering, backpressure,
  expiration, worker lifecycle, observations, head angles/direction, continuous
  absence, stable return, dismissal and uncertain/stale/unavailable input.
- Policy tests use synthetic observations and explicit monotonic times without a
  physical camera or timing sleeps. HTTP/WebSocket integration covers automatic
  direction and stale inference.
- Seven mocked Node tests passed: three capture-lifecycle tests and four simulator
  rendering tests. JavaScript syntax checks passed for both modules. Node 22.14.0
  is an ignored local verification utility, not an application runtime dependency.
- `sh -n scripts/setup.sh scripts/dev.sh` and `git diff --check` passed.
- HTTP/WebSocket checks require execution outside this tool sandbox: sandboxed
  Starlette TestClient stalls in its event-loop portal before application startup.

### Physical validation pending

- Windows-browser webcam access, permission/tab lifecycle, resource release,
  responsive layout, accessibility, Windows/macOS installation and HTTPS forwarding.
- Face detection accuracy, head-direction signs and
  lighting/blur thresholds on a physical webcam. Plain backgrounds can be classified
  as low detail; the blur gate is configurable for evaluation.
- Head direction and yaw/pitch/roll are automatic camera-relative diagnostics.
  Facial movement scores do not establish
  attention, emotion or identity and do not trigger reminders.
