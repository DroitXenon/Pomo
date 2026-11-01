"""Synthetic detections through the real HTTP/WebSocket and policy integration."""
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.config import BehaviourConfig
from tests.camera_helpers import DecodeProcessor
from tests.test_camera import start, upload


def harness():
    now = [100.0]
    detection = {'presence': 'present', 'head_pose': {'yaw': 0, 'pitch': 0, 'roll': 0}}
    class ScriptedProcessor(DecodeProcessor):
        def analyse(self, rgb):
            return dict(detection)
    app = create_app(processor_factory=ScriptedProcessor, clock=lambda: now[0],
                     behaviour_config=BehaviourConfig(absence_seconds=1,
                         tracking_loss_grace_seconds=0.25, return_seconds=0.25))
    return app, now, detection


def test_observations_absence_reminder_dismissal_and_pause():
    app, now, detection = harness()
    with TestClient(app) as client:
        with client.websocket_connect('/ws') as ws:
            token = start(ws)
            seq = 0
            def frame(presence='present'):
                nonlocal seq
                detection['presence'] = presence
                assert upload(client, token, seq).status_code == 200
                seq += 1
                return ws.receive_json()
            initial = frame()
            assert initial['observation']['presence'] == 'present'
            assert initial['head_direction'] == 'forward'
            detection['head_pose']['yaw'] = 40
            now[0] += 0.25
            state = frame()
            assert state['head_direction'] == 'left' and state['behaviour']['armed']
            assert not state['behaviour']['reminder_active']
            now[0] += 0.25
            assert frame('not_detected')['behaviour']['status'] == 'tracking_loss'
            now[0] += 0.25
            assert frame('not_detected')['display'] == 'possible_absence'
            for _ in range(3):
                now[0] += 0.25
                state = frame('not_detected')
            assert state['display'] == 'reminding'
            ws.send_json({'type': 'dismiss_reminder'})
            assert not ws.receive_json()['behaviour']['reminder_active']
            now[0] += 0.25
            assert not frame('not_detected')['behaviour']['reminder_active']
            now[0] += 0.25
            state = frame('unknown')
            assert state['camera_status'] == 'available' and state['display'] == 'unavailable'
            assert not state['behaviour']['armed']
            ws.send_json({'type': 'set_monitoring', 'enabled': False})
            state = ws.receive_json()
            assert state['observation'] is None and state['display'] == 'ready'
            assert upload(client, token, seq).status_code == 409


def test_watchdog_stales_observation_before_transport_timeout():
    app, now, _ = harness()
    with TestClient(app) as client:
        with client.websocket_connect('/ws') as ws:
            token = start(ws)
            assert upload(client, token).status_code == 200
            ws.receive_json()
            now[0] += 1.1
            state = ws.receive_json()
            assert state['behaviour']['status'] == 'stale'
            assert state['camera_status'] == 'available' and state['monitoring_enabled']
            assert state['observation'] is None and state['display'] == 'unavailable'


def test_manual_preview_dismissal_does_not_mutate_state():
    app, _, _ = harness()
    with TestClient(app) as client:
        with client.websocket_connect('/ws') as ws:
            ws.receive_json()
            ws.send_json({'type': 'preview_display', 'display': 'reminding'})
            assert not ws.receive_json()['behaviour']['reminder_active']
            ws.send_json({'type': 'dismiss_reminder'})
            assert ws.receive_json()['type'] == 'error'
        with client.websocket_connect('/ws') as ws:
            state = ws.receive_json()
            assert state['revision'] == 1 and state['display'] == 'reminding'


def test_late_inference_is_unknown_even_when_frame_transport_succeeds():
    now = [100.0]
    class DelayedProcessor(DecodeProcessor):
        def analyse(self, rgb):
            now[0] += 1.1
            return {'presence': 'present', 'head_pose': {'yaw': 0, 'pitch': 0, 'roll': 0}}
    with TestClient(create_app(processor_factory=DelayedProcessor, clock=lambda: now[0])) as client:
        with client.websocket_connect('/ws') as ws:
            token = start(ws)
            assert upload(client, token).status_code == 200
            state = ws.receive_json()
            assert state['camera_status'] == 'available'
            assert state['observation']['presence'] == 'unknown'
            assert state['observation']['reason'] == 'stale'
            assert state['head_direction'] == 'unknown'
            assert not state['behaviour']['armed']


def test_first_turned_face_gets_automatic_direction():
    app, _, detection = harness()
    detection['head_pose']['yaw'] = 45
    with TestClient(app) as client:
        with client.websocket_connect('/ws') as ws:
            token = start(ws)
            assert upload(client, token).status_code == 200
            state = ws.receive_json()
            assert state['head_direction'] == 'left'
            assert state['observation']['head_pose']['yaw'] == 45
