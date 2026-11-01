"use strict";
const $ = (id) => document.getElementById(id);
const displayLabels = {
  ready: "Ready",
  possible_absence: "Possible absence",
  reminding: "Reminder",
  unavailable: "Unavailable"
};
let socket, retryTimer, connectTimer, attempts = 0, stopped = false, state = null;
const camera = new CameraController($("camera-preview"), $("camera-status"), (message) => {
  $("feedback").textContent = message;
  send({type: "camera_failed"});
});
function log(text) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  $("journal").prepend(item);
  while ($("journal").children.length > 12) $("journal").lastChild.remove();
}
function controls(connected) {
  $("monitor").disabled = !connected;
  $("dismiss-reminder").disabled = !connected || !state?.behaviour?.reminder_active;
  document.querySelectorAll("[data-preview]").forEach((button) => {
    button.disabled = !connected || !state?.dev_controls;
  });
}
function render(next) {
  state = next;
  $("screen").dataset.display = state.display;
  $("state-title").textContent = displayLabels[state.display];
  $("monitor").textContent = state.monitoring_enabled ? "Pause monitoring" : "Enable monitoring";
  $("monitor").setAttribute("aria-pressed", String(state.monitoring_enabled));
  $("monitor-status").textContent = state.monitoring_enabled ? "Camera monitoring enabled" : "Monitoring paused";
  $("revision").textContent = state.revision;
  document.querySelectorAll("[data-preview]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preview === state.display)));
  $("feedback").textContent = state.dev_controls ? "" : "Expression controls disabled.";
  controls(true);
  camera.update(state);
  renderDetection(state);
}
function renderDetection(next) {
  const observation = next.observation;
  const behaviour = next.behaviour || {};
  const statuses = {
    paused: "Detection paused", unavailable: "Camera unavailable",
    awaiting_face: "Waiting for a visible face before monitoring absence",
    confirming_face: "Confirming face presence", present: "Face visible",
    tracking_loss: "Brief face tracking loss", possible_absence: "Possible absence",
    reminding: "Sustained face absence",
    uncertain: "Input uncertain · reminders suspended", stale: "Input stale · reminders suspended"
  };
  const reasons = {usable: "Usable", no_face: "No face detected", low_light: "Low light",
    overexposed: "Overexposed", low_detail_or_blur: "Low detail or blur", invalid_landmarks: "Uncertain landmarks"};
  $("detection-status").textContent = statuses[behaviour.status] || "Waiting for observations";
  $("face-presence").textContent = {present: "Present", not_detected: "Not detected", unknown: "Unknown"}[observation?.presence] || "Unknown";
  $("head-direction").textContent = next.head_direction || "unknown";
  const pose = observation?.head_pose;
  $("head-angles").textContent = pose ? `Yaw ${pose.yaw.toFixed(0)}° / pitch ${pose.pitch.toFixed(0)}° / roll ${pose.roll.toFixed(0)}°` : "—";
  $("image-quality").textContent = reasons[observation?.reason] || "—";
  $("absence-duration").textContent = `${behaviour.absence_seconds || 0} s`;
  $("expression-scores").textContent = Object.entries(observation?.blendshapes || {})
    .map(([name, score]) => `${name}: ${score.toFixed(2)}`).join(" · ") || "—";
  $("reminder-message").hidden = !behaviour.reminder_active;
  $("dismiss-reminder").hidden = !behaviour.reminder_active;
  const overlay = $("face-overlay");
  const context = overlay.getContext("2d");
  context.clearRect(0, 0, overlay.width, overlay.height);
  if (next.camera_session && observation?.presence === "present" && observation.face_box && next.last_frame) {
    const {width, height} = next.last_frame;
    const scale = Math.min(overlay.width / width, overlay.height / height);
    const offsetX = (overlay.width - width * scale) / 2;
    const offsetY = (overlay.height - height * scale) / 2;
    const [left, top, right, bottom] = observation.face_box;
    context.strokeStyle = "#fff";
    context.lineWidth = 2;
    context.strokeRect(offsetX + left * width * scale, offsetY + top * height * scale,
                       (right - left) * width * scale, (bottom - top) * height * scale);
  }
}
function connect() {
  if (stopped) return;
  controls(false);
  $("connection").textContent = "Connecting";
  $("connection").dataset.connected = "false";
  const url = new URL("ws", window.location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(url);
  connectTimer = setTimeout(() => socket.close(), 10000);
  socket.onmessage = ({data}) => {
    try {
      const message = JSON.parse(data);
      if (message.type === "state" && message.protocol_version === 4 && displayLabels[message.display]) {
        clearTimeout(connectTimer);
        attempts = 0;
        $("connection").textContent = "Connected";
        $("connection").dataset.connected = "true";
        const changed = !state || state.display !== message.display ||
          state.camera_status !== message.camera_status || state.behaviour?.status !== message.behaviour?.status;
        render(message);
        if (changed) log(`State ${message.revision}: ${message.display} · ${message.behaviour?.status || message.camera_status}`);
      } else if (message.type === "error") {
        $("feedback").textContent = message.message;
        log(`Command rejected: ${message.code}`);
      }
    } catch { log("Unrecognised backend message"); }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    clearTimeout(connectTimer);
    controls(false);
    camera.stop();
    $("detection-status").textContent = "Disconnected · observations may be stale";
    $("face-overlay").getContext("2d").clearRect(0, 0, 640, 480);
    $("camera-status").textContent = "Camera stopped · backend disconnected";
    $("connection").textContent = "Disconnected";
    $("connection").dataset.connected = "false";
    $("monitor-status").textContent = "Disconnected · displayed state may be stale";
    if (!stopped) {
      const delay = Math.min(1000 * 2 ** attempts++, 10000);
      log(`Disconnected; retrying in ${delay / 1000}s`);
      retryTimer = setTimeout(connect, delay);
    }
  };
}
function send(command) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(command));
}
$("dismiss-reminder").onclick = () => send({type: "dismiss_reminder"});
$("monitor").onclick = () => send({type: "set_monitoring", enabled: !state.monitoring_enabled});
document.querySelectorAll("[data-preview]").forEach((button) => {
  button.onclick = () => send({type: "preview_display", display: button.dataset.preview});
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && camera.session) {
    camera.stop();
    send({type: "set_monitoring", enabled: false});
  }
});
$("clear").onclick = () => $("journal").replaceChildren();
window.addEventListener("pagehide", () => {
  camera.stop();
  stopped = true; clearTimeout(retryTimer); clearTimeout(connectTimer); socket?.close();
});
window.addEventListener("pageshow", (event) => { if (event.persisted) { stopped = false; connect(); } });
connect();
