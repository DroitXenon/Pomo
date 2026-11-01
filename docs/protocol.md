# Protocol v4

The browser connects to `/ws` on the page origin (WSS on HTTPS). JSON text commands
remain limited to 4,096 bytes. Images use a separate bounded HTTP endpoint.
Monitoring uses browser camera ownership and shared state snapshots. Update
browser and backend together.

## Snapshots and commands

New/reconnecting clients receive a complete snapshot. Every accepted command and
successful frame increments revision and broadcasts state. Lifecycle changes also
increment revision. All clients share one process-local robot; use one server worker.

```json
{
  "type": "state", "protocol_version": 4,
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
dimensions before decoding, and runs decode/BGR-to-RGB conversion and Face Landmarker on its dedicated
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
This transport timeout is independent of the shorter observation-freshness limit.

The browser releases media tracks on pause, capture/upload failure, owner-session
loss, WebSocket disconnection, pagehide and tab hiding. Hidden tabs pause shared
monitoring rather than silently relying on throttled timers. A late permission
grant after cancellation immediately stops its tracks. Reconnection restores state,
but capture needs a fresh explicit enable. Commands and images are never queued
offline. Backend restart resets monitoring and sessions.

The preview comes directly from the browser's video stream and is mirrored only
for display; uploaded pixels are unmirrored. Permissions require localhost or HTTPS.
WSL does not need a `/dev/video*` device. Face presence drives the sustained-absence policy described below. Identity
recognition is not implemented.


## Observation and behaviour fields

An accepted frame provides `observation`, `head_direction` and a `behaviour`
diagnostic object in snapshots.

```json
{
  "observation": {
    "observed_at": 100.0, "processed_at": 100.04,
    "presence": "present", "reason": "usable",
    "brightness": 115.2, "blur_variance": 210.4,
    "head_pose": {"yaw": 2.0, "pitch": -3.0, "roll": 0.0},
    "face_box": [0.2, 0.1, 0.8, 0.9],
    "blendshapes": {"jawOpen": 0.1}
  },
  "head_direction": "forward",
  "behaviour": {
    "status": "present", "armed": true, "absence_seconds": 0,
    "reminder_active": false
  }
}
```

`observation` is null before input, on pause/session loss and when the watchdog
marks input stale. `presence` is `present`, `not_detected` or `unknown`.
Reasons include `usable`, `no_face`, `low_light`, `overexposed`,
`low_detail_or_blur`, `invalid_landmarks`, `stale`. Optional diagnostics default to
null/empty. `observed_at` is backend request-receipt monotonic time, not a browser
capture timestamp. `processed_at` is backend completion time. Sequence/session
validation remains part of ingestion. Neither timestamps nor image quality metrics
are model confidence scores. A late inference becomes unknown and cannot remind.

Head pose uses XYZ Euler rotation from the scale-normalized canonical-to-face
matrix: yaw around Y, pitch around X, roll around Z, in degrees. Direction is
relative to the camera-facing canonical pose by default, with configurable exit
hysteresis. Direction and raw angles are camera-relative.
Positive yaw is labelled subject-left and positive pitch down; physical-camera
validation of these conventions remains pending. Missing pose gives `unknown`.
`face_box` is normalized left/top/right/bottom; only the owner draws it over their
mirrored preview. Blendshapes contain selected movement scores, never emotion,
attention or identity labels. Head pose and blendshapes cannot trigger reminders.

```json
{"type":"dismiss_reminder"}
```

`dismiss_reminder` takes no additional fields. Any connected client may dismiss the
shared reminder. Dismissal requires an actual policy reminder; a manual display
preview is not dismissible. Invalid requests return `invalid_command` and leave
revision/state unchanged.

Policy status values: `paused`, `unavailable`, `awaiting_face`, `confirming_face`,
`present`, `tracking_loss`, `possible_absence`, `reminding`, `uncertain`,
`stale`. Monitoring requires stable face presence before it arms. Continuous
non-detection first uses the grace period, then possible_absence, then reminding
at the configured absence threshold. Grace counts within the total duration.
Any reliable present observation cancels pending absence; stable presence clears
an active reminder.

Dismissal clears the active reminder and resets the absence countdown. A later
reminder requires a new continuous non-detection interval. Pause/session loss
clears the face baseline,
pending duration and active reminder.
Unknown, stale and unavailable input clear evidence and reminders; a fresh stable
face baseline is required before absence can remind again. A watchdog marks
observations stale independently of the camera's longer transport timeout. Waiting
without new observations never triggers an absence reminder.

Manual previews still work while monitoring, but the next observation or actual
policy transition may replace them. Clients must use `behaviour.reminder_active`
for reminder prompts/dismissal, rather than infer reminders from display alone.
Absence duration reflects the latest snapshot, not a client-side timer.
See README and `.env.example` for defaults and tuning limitations.
