"""Phase 1 state and transport; no camera or reminder policy yet."""
import asyncio
import json
import logging
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, StrictBool, ValidationError

LOG = logging.getLogger("pomo")
Display = Literal["ready", "possible_absence", "reminding", "unavailable"]


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["set_monitoring", "preview_display"]
    enabled: StrictBool | None = None
    display: Display | None = None


def create_app(dev_controls: bool = True) -> FastAPI:
    app = FastAPI(title="Pomo prototype")
    state = {"monitoring_enabled": False, "display": "ready",
             "camera_status": "not_implemented", "revision": 0}
    clients: set[WebSocket] = set()
    lock = asyncio.Lock()

    def snapshot():
        return {"type": "state", "protocol_version": 1, **state,
                "dev_controls": dev_controls}

    @app.get("/health")
    async def health():
        return {"status": "ok", "phase": 1}

    @app.websocket("/ws")
    async def websocket(ws: WebSocket):
        await ws.accept()
        try:
            async with lock:
                clients.add(ws)
                await ws.send_json(snapshot())
            LOG.info("Simulator connected")
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                try:
                    raw = message.get("text")
                    if raw is None or len(raw) > 4096:
                        raise ValueError("Expected a JSON text command under 4096 characters")
                    command = Command.model_validate(json.loads(raw))
                    if command.type == "set_monitoring":
                        if command.enabled is None or command.display is not None:
                            raise ValueError("set_monitoring requires only enabled (boolean)")
                    elif command.display is None or command.enabled is not None:
                        raise ValueError("preview_display requires only display")
                    elif not dev_controls:
                        raise ValueError("Developer controls are disabled")
                except (ValueError, ValidationError) as error:
                    async with lock:
                        await ws.send_json({"type": "error", "code": "invalid_command",
                                            "message": str(error)[:500]})
                    continue
                async with lock:
                    if command.type == "set_monitoring":
                        state["monitoring_enabled"] = command.enabled
                        state["display"] = "ready"
                    else:
                        state["display"] = command.display
                    state["revision"] += 1
                    LOG.info("State updated: %s", state)
                    for peer in tuple(clients):
                        try:
                            await asyncio.wait_for(peer.send_json(snapshot()), timeout=2)
                        except (WebSocketDisconnect, RuntimeError, OSError, TimeoutError):
                            clients.discard(peer)
        except (WebSocketDisconnect, RuntimeError, OSError):
            pass
        finally:
            clients.discard(ws)
            LOG.info("Simulator disconnected")

    app.mount("/", StaticFiles(directory=Path(__file__).resolve().parents[1] / "simulator",
                              html=True), name="simulator")
    return app
