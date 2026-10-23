"""Centralized Google Gemini client for the GovtGuide AI chatbot.

Backend-only. The API key and model are read from environment-backed settings
and are NEVER exposed to the frontend.

Uses the official Google Gen AI Python SDK (`google-genai`) when it is
installed. If the SDK is unavailable or a call fails, it transparently falls
back to the equivalent REST call via httpx (already a project dependency), so
the chatbot never breaks because of the transport layer.

No mock data, no fabricated answers: if the key is missing or the request
fails, callers get an empty result and use their own verified fallback.
"""
import json
import logging
from typing import Optional, Dict, Any, List

import httpx

from config import settings

logger = logging.getLogger("govguide.gemini")

# Optional official SDK. Import is guarded so the app still runs without it.
try:
    from google import genai  # type: ignore
    from google.genai import types as genai_types  # type: ignore
    _GENAI_AVAILABLE = True
except Exception:  # pragma: no cover - depends on environment
    genai = None
    genai_types = None
    _GENAI_AVAILABLE = False

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def is_configured() -> bool:
    """True when a Gemini API key is available on the backend."""
    return bool(settings.GEMINI_API_KEY)


def _clean(text: str) -> str:
    return (text or "").strip()


async def _generate_via_sdk(prompt: str, system: Optional[str]) -> str:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    config = None
    if system:
        config = genai_types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.6,
            max_output_tokens=1200,
        )
    resp = await client.aio.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config,
    )
    return _clean(getattr(resp, "text", "") or "")


async def _generate_via_http(prompt: str, system: Optional[str]) -> str:
    url = f"{_BASE_URL}/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    payload: Dict[str, Any] = {"contents": [{"parts": [{"text": prompt}]}]}
    if system:
        payload["systemInstruction"] = {"parts": [{"text": system}]}
        payload["generationConfig"] = {"temperature": 0.6, "maxOutputTokens": 1200}
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=15.0,
        )
        if resp.status_code != 200:
            logger.warning("Gemini REST error %s: %s", resp.status_code, resp.text[:200])
            return ""
        data = resp.json()
        cand = (data.get("candidates") or [{}])[0]
        parts = (cand.get("content") or {}).get("parts") or []
        return _clean("".join(p.get("text", "") for p in parts))


async def generate_text(prompt: str, system: Optional[str] = None) -> str:
    """Return a genuine AI-generated reply, or '' if unconfigured/failed."""
    if not is_configured():
        return ""
    # Prefer the official SDK; fall back to REST on any SDK problem.
    if _GENAI_AVAILABLE:
        try:
            return await _generate_via_sdk(prompt, system)
        except Exception as exc:  # noqa: BLE001 - degrade gracefully
            logger.warning("Gemini SDK call failed, trying REST fallback: %s", exc)
    try:
        return await _generate_via_http(prompt, system)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini REST call failed: %s", exc)
        return ""


async def generate_json(prompt: str, system: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Ask Gemini for a JSON object and parse it. Returns None on failure."""
    text = await generate_text(prompt, system)
    if not text:
        return None
    cleaned = text
    if cleaned.startswith("```"):
        # strip opening fence (+ optional language tag) and trailing fence
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:  # noqa: BLE001
        # Try to salvage the first {...} block.
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except Exception:  # noqa: BLE001
                return None
        logger.warning("Gemini returned non-JSON output; ignoring.")
        return None


def build_history_block(history: List[Dict[str, Any]], max_turns: int = 8) -> str:
    """Format recent stored chat messages into a compact transcript for context.

    Only the last ``max_turns`` messages are included, and user/bot turns are
    labelled so follow-up questions resolve correctly. No profile data is added.
    """
    if not history:
        return ""
    recent = history[-max_turns:]
    lines = []
    for m in recent:
        sender = m.get("sender")
        text = (m.get("text") or "").strip()
        if not text:
            continue
        who = "Citizen" if sender == "user" else "GovtGuide AI"
        lines.append(f"{who}: {text}")
    if not lines:
        return ""
    return "Recent conversation (for context only):\n" + "\n".join(lines) + "\n\n"
