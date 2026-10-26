# Stack choices

Exact resolved versions, including transitive and test dependencies, are pinned in requirements.txt.

| Selected | Reason | Alternative considered |
| --- | --- | --- |
| Python 3.13 + FastAPI | HTTP, WebSocket and validation support; future Python perception integration | Flask requires an additional WebSocket integration |
| Uvicorn + websockets | Standard ASGI and WebSocket transport | Hand-written sockets add unnecessary protocol work |
| Plain HTML/CSS/JS | Small interface without a frontend build toolchain | React adds tooling; Gradio is useful for model demos but offers less direct control of this robot UI and transport |
| python-dotenv | Simple local configuration; environment variables override file values | Shell-only configuration is less convenient |
| pytest + HTTPX | Tests actual HTTP and WebSocket routes | State-only tests miss protocol errors |

Official reference: https://fastapi.tiangolo.com/advanced/websockets/

No Node runtime, database, external fonts or camera libraries are required.
Camera packages will be selected and installed in Phase 2. UI choices do not commit
the firmware to a browser stack.
