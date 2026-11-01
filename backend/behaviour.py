"""Deterministic sustained-absence policy. No camera, transport or wall-clock reads."""
from .config import BehaviourConfig
from .observations import Observation


class Behaviour:
    def __init__(self, config: BehaviourConfig):
        self.config = config
        self.reset()

    def reset(self, *, enabled=False, unavailable=False):
        self.enabled = enabled
        self.armed = False
        self.absence_since = None
        self.present_since = None
        self.last_observed_at = None
        self.reminder_active = False
        self.display = 'unavailable' if unavailable else 'ready'
        self.status = 'unavailable' if unavailable else 'awaiting_face' if enabled else 'paused'

    def uncertain(self, status='uncertain'):
        self.armed = False
        self.absence_since = self.present_since = None
        self.reminder_active = False
        self.display, self.status = 'unavailable', status

    def observe(self, observation: Observation, now: float):
        if not self.enabled:
            return
        at = observation.observed_at
        if self.last_observed_at is not None and at <= self.last_observed_at:
            return  # Replayed/out-of-order evidence cannot change policy state.
        if at > now or now - at > self.config.observation_max_age_seconds:
            self.uncertain('stale')
            return
        if (self.last_observed_at is not None and
                at - self.last_observed_at > self.config.observation_max_age_seconds):
            self.uncertain('stale')
        self.last_observed_at = at
        if observation.presence == 'unknown':
            self.uncertain()
        elif observation.presence == 'present':
            self.absence_since = None
            if self.present_since is None:
                self.present_since = at
            if at - self.present_since >= self.config.return_seconds:
                self.armed = True
                self.reminder_active = False
                self.display, self.status = 'ready', 'present'
            elif not self.reminder_active:
                self.display, self.status = 'ready', 'confirming_face'
        else:
            self.present_since = None
            if not self.armed:
                self.display, self.status = 'ready', 'awaiting_face'
                return
            if self.reminder_active:
                self.display, self.status = 'reminding', 'reminding'
                return
            if self.absence_since is None:
                self.absence_since = at
            elapsed = at - self.absence_since
            if elapsed >= self.config.absence_seconds:
                self.reminder_active = True
                self.display, self.status = 'reminding', 'reminding'
            elif elapsed >= self.config.tracking_loss_grace_seconds:
                self.display = 'possible_absence'
                self.status = 'possible_absence'
            else:
                self.display, self.status = 'ready', 'tracking_loss'

    def tick(self, now: float):
        if (self.enabled and self.last_observed_at is not None and
                now - self.last_observed_at > self.config.observation_max_age_seconds):
            self.uncertain('stale')

    def dismiss(self):
        if not self.reminder_active:
            raise ValueError('There is no active detection reminder to dismiss')
        self.reminder_active = False
        self.absence_since = None
        self.display, self.status = 'ready', 'tracking_loss'

    def snapshot(self):
        elapsed = (max(0, self.last_observed_at - self.absence_since)
                   if self.absence_since is not None and self.last_observed_at is not None else 0)
        return {'status': self.status, 'armed': self.armed,
                'absence_seconds': round(elapsed, 2), 'reminder_active': self.reminder_active}
