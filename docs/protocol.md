# Protocol v2

The browser connects to `/ws` on the page origin (WSS on HTTPS). JSON text commands
remain limited to 4,096 bytes. Images use a separate bounded HTTP endpoint.
Protocol v2 replaces the simulation-only monitoring flag with browser camera
ownership and changes health/snapshot fields; update browser and backend together.

## Snapshots and commands

New/reconnecting clients receive a complete snapshot. Every accepted command and
successful frame increments revision and broadcasts state. Lifecycle changes also
increment revision. All clients share one process-local robot; use one server worker.

```json
{
  "type": "state", "protocol_version": 2,
  "monitoring_enabled": false, "display": "ready",
  "camera_status": "paused", "revision": 0,
  "dev_controls": true, "camera_session": null,
  "frames_received": 0, "last_frame": null,
  "camera_settings": {
    "width": 640, "height": 480, "fps": 10, "jpeg_quality": 0.75,
    "max_bytes": 524288, "timeout_seconds": 3, "startup_seconds": 30
  }
}
```

`camera_status`: `paused`, `starting`, `available`, `unavailable`. These describe
capture/transport, not face presence, reminders or WebSocket health.
`last_frame`, when present, contains `width`, `height` and `sequence`; never pixels.

```json
{"type":"set_monitoring","enabled":true}
{"type":"set_monitoring","enabled":false}
{"type":"camera_failed"}
{"type":"preview_display","display":"possible_absence"}
```

Enabling reserves the camera for the sending WebSocket and resets display to ready.
A new opaque `camera_session` is included only in that owner's snapshots. Other
clients see null. A second enable while owned is rejected, including from the owner;
pause first to restart. Any client may pause shared monitoring. Only the owner may
report `camera_failed` (no other fields). Pausing, owner disconnection, failure or
timeout invalidates the session and clears frame metadata; failure sets unavailable.

Display values remain `ready`, `possible_absence`, `reminding`, `unavailable`.
Previews require development controls, work while paused and do not represent
inference or reminders. Invalid commands return `invalid_command` errors without
mutating state. Unknown fields, non-boolean enabled, invalid JSON and binary
WebSocket messages are rejected.

## Frame ingestion

`POST /camera/frame` with raw JPEG bytes, `Content-Type: image/jpeg`,
`X-Camera-Session: <owner token>` and `X-Frame-Sequence: <increasing integer>`.
Sequence is a nonnegative ASCII decimal of at most 16 digits, scoped to the session.
Never log or persist frame bytes or session tokens.

The server bounds streamed request bytes (default 512 KiB), validates JPEG header
dimensions before decoding, and runs decode/BGR-to-RGB conversion on its dedicated
worker. Frames must fit the configured width and height. There is one in-flight
body/decode operation across clients, with no processing queue. A timed-out native
job retains that slot until it completes. Session and age are checked again before
publishing a result; late results cannot revive paused or replaced sessions.

Success: `{"accepted":true,"sequence":0}`. Errors: 400 invalid JPEG/sequence,
408 body/processing deadline, 409 stale sequence/session, 413 oversized body,
415 wrong media type, 429 busy. Rejected frames do not increment revision. A decoded
frame marks camera available and increments `frames_received` (per session).

The browser uses one upload at a time, sampling a new frame after the previous
response plus the configured frame interval. FPS is an upper sampling target,
not a guaranteed throughput. Failed uploads are not retried/replayed.

## Lifecycle and recovery

Backend initialization opens the model once on a dedicated thread. A failed
initialization keeps the server reachable, reports unavailable, sets
`camera_processor_ready=false` in `/health` and rejects enable commands. Fix setup
and restart. `/health` otherwise reports `{"status":"ok","phase":2,
"camera_processor_ready":true}`.

A watchdog expires sessions after the startup allowance (default 30 seconds) or,
after the first accepted frame, the idle allowance (default 3 seconds). Deadlines
use backend monotonic time; browser timestamps are not compared with that clock.
This is transport freshness, not the later observation/absence timing policy.

The browser releases media tracks on pause, capture/upload failure, owner-session
loss, WebSocket disconnection, pagehide and tab hiding. Hidden tabs pause shared
monitoring rather than silently relying on throttled timers. A late permission
grant after cancellation immediately stops its tracks. Reconnection restores state,
but capture needs a fresh explicit enable. Commands and images are never queued
offline. Backend restart resets monitoring and sessions.

The preview comes directly from the browser's video stream and is mirrored only
for display; uploaded pixels are unmirrored. Permissions require localhost or HTTPS.
WSL does not need a `/dev/video*` device. No automatic face detection, identity
recognition or reminder policy is exposed by this milestone.
