import random
import string
import time
import hashlib
import uuid
from typing import Dict, Tuple

# In-memory captcha store: {captcha_id: (answer_hash, expires_at)}
_captcha_store: Dict[str, Tuple[str, float]] = {}

def _hash_answer(answer: str, salt: str = "govguide_captcha_salt") -> str:
    return hashlib.sha256(f"{salt}_{answer.strip().lower()}".encode("utf-8")).hexdigest()

def generate_captcha() -> Dict[str, str]:
    """
    Generates a secure SVG-based CAPTCHA challenge without external C-library image dependencies.
    Includes distorted alphanumeric characters, colored noise lines, and circles.
    """
    # Clean out expired captchas
    now = time.time()
    expired = [k for k, v in _captcha_store.items() if v[1] < now]
    for k in expired:
        _captcha_store.pop(k, None)

    # 5-character readable alphanumeric code (excluding ambiguous 0, O, 1, I, l)
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    code = "".join(random.choice(alphabet) for _ in range(5))
    captcha_id = str(uuid.uuid4())

    # Store hashed answer valid for 5 minutes
    _captcha_store[captcha_id] = (_hash_answer(code), now + 300)

    # Generate visually appealing SVG
    width, height = 220, 70
    bg_colors = ["#F8FAFC", "#F1F5F9", "#EFF6FF", "#F0FDF4"]
    bg_color = random.choice(bg_colors)

    # Noise lines
    lines = []
    colors = ["#CBD5E1", "#94A3B8", "#60A5FA", "#34D399", "#F87171", "#A78BFA"]
    for _ in range(7):
        x1, y1 = random.randint(0, width), random.randint(0, height)
        x2, y2 = random.randint(0, width), random.randint(0, height)
        stroke = random.choice(colors)
        stroke_width = random.uniform(1.2, 2.5)
        lines.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{stroke_width:.1f}" stroke-linecap="round" opacity="0.6"/>')

    # Noise dots
    dots = []
    for _ in range(25):
        cx, cy = random.randint(5, width - 5), random.randint(5, height - 5)
        r = random.uniform(1, 2.8)
        fill = random.choice(colors)
        dots.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="{fill}" opacity="0.5"/>')

    # Character elements with slight rotation and offsets
    char_elements = []
    font_families = ["Arial, sans-serif", "'Segoe UI', sans-serif", "Helvetica, sans-serif"]
    char_colors = ["#1E293B", "#0F172A", "#1E3A8A", "#065F46", "#831843", "#701A75"]

    for i, char in enumerate(code):
        x = 25 + i * 36 + random.randint(-4, 4)
        y = 48 + random.randint(-5, 5)
        rot = random.randint(-18, 18)
        color = random.choice(char_colors)
        font_family = random.choice(font_families)
        font_size = random.randint(30, 36)
        char_elements.append(
            f'<text x="{x}" y="{y}" fill="{color}" font-family="{font_family}" font-size="{font_size}" font-weight="bold" '
            f'transform="rotate({rot} {x} {y})" letter-spacing="2">{char}</text>'
        )

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="background-color: {bg_color}; border-radius: 8px; border: 1px solid #E2E8F0; user-select: none;">
        <rect width="100%" height="100%" fill="{bg_color}" rx="8"/>
        {''.join(lines)}
        {''.join(dots)}
        {''.join(char_elements)}
    </svg>'''

    return {
        "captcha_id": captcha_id,
        "captcha_svg": svg_content,
        "expires_in_seconds": 300
    }

def verify_captcha(captcha_id: str, user_answer: str) -> bool:
    """
    Validates the CAPTCHA answer securely.
    Removes the token once validated (single-use).
    """
    if not captcha_id or not user_answer:
        return False

    record = _captcha_store.get(captcha_id)
    if not record:
        return False

    answer_hash, expires_at = record
    # Enforce one-time use immediately
    _captcha_store.pop(captcha_id, None)

    if time.time() > expires_at:
        return False

    return _hash_answer(user_answer) == answer_hash
