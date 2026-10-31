# Pomo

Your little study companion. Phase 1 provides a browser robot simulator connected
to a Python backend. Eventually the physical robot provides the user interface
and a laptop provides computation.

## Scope

- Implemented: configurable server, shared state, monitoring flag, manual expression previews, connection status and reconnection.
- Phase 2: webcam presence detection (whether the user leaves view), reminder thresholds, cooldowns and dismissal.
- Later: physical hardware, Pomodoro and voice recognition.

No camera is captured or stored. Enabling monitoring only changes a simulation flag.

## Setup and run

Use Python 3.11–3.13 (verified on 3.13). From the repository root:

```sh
PYTHON=python3.13 sh scripts/setup.sh
cp .env.example .env
sh scripts/dev.sh
```

Open http://127.0.0.1:8000/ and stop the server with Ctrl+C. Setup installs into
this project's isolated `.venv` and can be rerun. If python3 is a suitable version,
omit the PYTHON override. Copy `.env` only on first setup; preserve existing values.

## Configuration

Edit `.env` or set environment variables (which take precedence).

| Variable | Default | Purpose |
| --- | --- | --- |
| POMO_HOST | 127.0.0.1 | Bind address |
| POMO_PORT | 8000 | Shared HTTP and WebSocket port |
| POMO_DEV_CONTROLS | true | Enable manual expression commands |

This is an unauthenticated development server. Keep forwarded ports private and
use workspace access controls. All tabs control the same robot state.

## Cloud workspace

1. Install dependencies with the setup command above in a Python 3.11–3.13 workspace.
2. Run `POMO_HOST=0.0.0.0 sh scripts/dev.sh`.
3. Forward port 8000 privately and open its preview URL at the root path.
4. Complete any workspace authentication; the proxy must support WebSocket upgrades.

One server serves the UI and backend, with no CORS setup or separate frontend port.
The browser derives its WebSocket URL from the page and uses wss on HTTPS.
A path-prefix proxy is not configured; use a root-path preview URL.
Cloud provider integration must be verified in the actual workspace. The requested
Cloud Environment Setup skill is not installed in this local environment.

A cloud backend cannot directly open your laptop webcam. Phase 2 should either
run locally with a webcam or explicitly implement browser capture and transport.
Neither is implemented now.

## Verify

```sh
.venv/bin/python -m pytest -q
```

Manual demo:
1. Open the simulator and wait for Connected.
2. Enable monitoring and confirm the simulation-only label.
3. Preview all four expressions in the developer panel.
4. Open a second tab and confirm both receive state changes.
5. Stop the server; controls disable and the displayed state is marked stale.
6. Restart it; the simulator reconnects and shows paused/ready state.

GET /health returns server status. Backend logs and the bounded connection journal
help diagnose command flow. See [verification](docs/verification.md).

## Structure

- backend/: application state, validation and transport.
- simulator/: robot display and separate developer panel.
- firmware/: future hardware integration notes.
- docs/: [stack decision](docs/stack.md) and [message protocol](docs/protocol.md).
- scripts/: repeatable setup and startup.
- tests/: HTTP/WebSocket integration checks.
- requirements.txt: pinned application and test dependencies.
- .env.example: configurable defaults.

## Troubleshooting

- Port in use: change POMO_PORT and open/forward that port.
- Disconnected: check the server, /health, proxy WebSocket support and preview authentication.
- Missing packages: rerun setup and use scripts/dev.sh to select the project virtual environment.
- State resets: expected after backend restart; persistence is out of scope. Use one worker.
- No camera permission prompt: expected; camera detection is Phase 2.
