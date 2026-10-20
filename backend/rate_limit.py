"""
Lightweight in-memory rate limiting (Priority-1 code, no external dependencies).

A sliding-window limiter keyed by client IP and a rule "bucket". Suitable for a
single-process development deployment; for multi-process/multi-host production it
should be backed by Redis or a gateway, which is noted in the limitations.
"""
import time
import threading
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

# bucket -> (max_requests, window_seconds)
DEFAULT_RULES: Dict[str, Tuple[int, int]] = {
    "auth_sensitive": (30, 60),   # login/signup/otp endpoints
    "chat": (40, 60),             # chatbot + profile assistant endpoints
    "default": (300, 60),         # everything else
}

# Path prefixes mapped to buckets. Matched in order.
PREFIX_BUCKETS = [
    ("/api/auth/login", "auth_sensitive"),
    ("/api/auth/signup", "auth_sensitive"),
    ("/api/auth/request-otp", "auth_sensitive"),
    ("/api/auth/verify-otp", "auth_sensitive"),
    ("/api/auth/resend-otp", "auth_sensitive"),
    ("/api/auth/google", "auth_sensitive"),
    ("/api/chat", "chat"),
    ("/api/profile/assistant-sync", "chat"),
]


class SlidingWindowRateLimiter:
    def __init__(self, rules: Dict[str, Tuple[int, int]] = None):
        self.rules = rules or DEFAULT_RULES
        self._hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    @staticmethod
    def bucket_for(path: str) -> str:
        for prefix, bucket in PREFIX_BUCKETS:
            if path.startswith(prefix):
                return bucket
        return "default"

    def allow(self, client_id: str, path: str) -> Tuple[bool, int]:
        """Return (allowed, retry_after_seconds)."""
        bucket = self.bucket_for(path)
        limit, window = self.rules.get(bucket, self.rules["default"])
        key = (client_id, bucket)
        now = time.time()
        cutoff = now - window

        with self._lock:
            dq = self._hits[key]
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= limit:
                retry_after = int(window - (now - dq[0])) + 1
                return False, max(1, retry_after)
            dq.append(now)
            return True, 0


limiter = SlidingWindowRateLimiter()
