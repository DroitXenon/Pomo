"use strict";
const $ = (id) => document.getElementById(id);
const displayLabels = {
  ready: "Ready",
  possible_absence: "Possible absence",
  reminding: "Reminder",
  unavailable: "Unavailable"
};
let socket, retryTimer, connectTimer, attempts = 0, stopped = false, state = null;
function log(text) {
  const item = document.createElement("li");
  item.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  $("journal").prepend(item);
  while ($("journal").children.length > 12) $("journal").lastChild.remove();
}
function controls(connected) {
  $("monitor").disabled = !connected;
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
  $("monitor-status").textContent = state.monitoring_enabled ? "Monitoring enabled · simulation only" : "Monitoring paused";
  $("revision").textContent = state.revision;
  document.querySelectorAll("[data-preview]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preview === state.display)));
  $("feedback").textContent = state.dev_controls ? "" : "Expression controls disabled.";
  controls(true);
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
      if (message.type === "state" && displayLabels[message.display]) {
        clearTimeout(connectTimer);
        attempts = 0;
        $("connection").textContent = "Connected";
        $("connection").dataset.connected = "true";
        render(message);
        log(`State ${message.revision}: ${message.display}`);
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
$("monitor").onclick = () => send({type: "set_monitoring", enabled: !state.monitoring_enabled});
document.querySelectorAll("[data-preview]").forEach((button) => {
  button.onclick = () => send({type: "preview_display", display: button.dataset.preview});
});
$("clear").onclick = () => $("journal").replaceChildren();
window.addEventListener("pagehide", () => {
  stopped = true; clearTimeout(retryTimer); clearTimeout(connectTimer); socket?.close();
});
window.addEventListener("pageshow", (event) => { if (event.persisted) { stopped = false; connect(); } });
connect();
