# Protocol v1

Connect to `/ws` on the same origin as the simulator. Use ws for HTTP and wss for
HTTPS. Messages are JSON text. The backend sends a complete snapshot on connection
and broadcasts a new snapshot after each accepted command:

```json
{"type":"state","protocol_version":1,"monitoring_enabled":false,"display":"ready","camera_status":"not_implemented","revision":0,"dev_controls":true}
```

Commands:
```json
{"type":"set_monitoring","enabled":true}
{"type":"set_monitoring","enabled":false}
{"type":"preview_display","display":"possible_absence"}
```

`enabled` must be a boolean. Display values: ready, possible_absence, reminding,
unavailable. Monitoring changes reset the display to ready. Monitoring is only a
stored flag: it does not start camera capture. Preview states are allowed even
while paused, for rendering checks. POMO_DEV_CONTROLS=false disables previews.

Unknown commands, invalid fields, invalid JSON and binary messages return:
```json
{"type":"error","code":"invalid_command","message":"Explanation"}
```
Invalid commands leave state unchanged. Oversized frames may close the connection.

All clients share one in-memory robot. Use one backend worker. Reconnecting clients
receive current state; a backend restart resets monitoring to paused, display to
ready and revision to zero. No queued commands are replayed. The browser retries
at 1, 2, 4, 8 and then at most 10 second intervals; a snapshot resets the delay.
Controls stay disabled until a snapshot arrives. Offline display is marked stale.

Future flow: camera source → presence observation → backend behaviour policy →
display state → simulator or hardware adapter. Thresholds, cooldowns and dismissal
are Phase 2 responsibilities, not part of the current preview command.
