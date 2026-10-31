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
