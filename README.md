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

Install Conda (Miniconda or Miniforge). The project environment uses Python 3.13.
From the repository root:

```sh
sh scripts/setup.sh
cp .env.example .env
sh scripts/dev.sh
```

Open http://127.0.0.1:8000/ and stop the server with Ctrl+C. Setup creates or updates
the `pomo` Conda environment from `environment.yml` and can be rerun. Conda supplies
Python and pip; the file's `pip` section preserves the existing pinned Python
packages. The startup script selects `pomo` automatically, so activation is not
required. Copy `.env` only on first setup; preserve existing values.

To use Conda directly, including on Windows:

```sh
conda env create --file environment.yml
conda activate pomo
python -m backend
```

For an existing environment, use `conda env update --name pomo --file environment.yml --prune`
instead of `conda env create`.

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

1. Use a workspace with Conda installed and run the setup command above.
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
conda run --name pomo python -m pytest -q
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
- environment.yml: Conda environment and pinned application/test dependencies.
- .env.example: configurable defaults.

## Troubleshooting

- Port in use: change POMO_PORT and open/forward that port.
- Disconnected: check the server, /health, proxy WebSocket support and preview authentication.
- Missing environment or packages: rerun `sh scripts/setup.sh`; `scripts/dev.sh` selects the `pomo` Conda environment.
- State resets: expected after backend restart; persistence is out of scope. Use one worker.
- No camera permission prompt: expected; camera detection is Phase 2.
