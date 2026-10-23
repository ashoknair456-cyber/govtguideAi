import os

# Load variables from a backend/.env file (if present) into the environment.
# python-dotenv is an optional-but-listed dependency; degrade gracefully if missing.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass


def _parse_origins(raw: str, default: list) -> list:
    """Parse a comma-separated CORS origin list from the environment."""
    if not raw:
        return default
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or default


class Settings:
    PROJECT_NAME: str = "GovGuide AI"

    # Runtime environment: "development" or "production"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database
    # All app data is served from the bundled local JSON file database
    # (backend/data/local_db.json). MongoDB is no longer required.
    DB_NAME: str = os.getenv("DB_NAME", "govguide_db")

    # Hybrid verified-scheme store (Supabase Postgres). Optional.
    # When empty or unreachable, the scheme store transparently falls back to
    # the local JSON file database above, so the app never breaks without Postgres.
    # Accepts a full asyncpg DSN, e.g.:
    #   postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres
    SUPABASE_DB_URL: str = os.getenv("SUPABASE_DB_URL", "").strip()
    # Primary Postgres/Neon connection string for the verified-scheme store.
    # Preferred over SUPABASE_DB_URL when both are set. Backend-only secret.
    #   e.g. postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
    # Master flag to disable the Postgres layer entirely (force the JSON file store).
    POSTGRES_ENABLED: bool = os.getenv("POSTGRES_ENABLED", "true").lower() not in ("0", "false", "no")

    @property
    def scheme_db_url(self) -> str:
        """Resolved Postgres connection string for the scheme store.

        Prefers DATABASE_URL and falls back to SUPABASE_DB_URL, so the existing
        Supabase configuration keeps working unchanged.
        """
        return self.DATABASE_URL or self.SUPABASE_DB_URL

    # Auth / JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecretkeychangeinproduction12345")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))

    # Optional AI provider (chatbot explanations). Empty => safe code-based fallback.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Chatbot model name (backend only). Set to a model your Gemini account supports.
    # gemini-2.5-flash was retired for new keys; this default is currently served.
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview").strip() or "gemini-3-flash-preview"

    # External scheme-discovery agent/webhook (Priority 3 integration). Empty => disabled.
    DISCOVERY_WEBHOOK_URL: str = os.getenv(
        "DISCOVERY_WEBHOOK_URL",
        "https://api.agents.snsihub.ai/webhook-test/government-scheme-discovery",
    )

    # Google OAuth (used by /api/auth/google). Must be configured to enable the flow.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # Firebase Authentication (used by /api/auth/firebase).
    # This is the Firebase Project ID from your web app config (public, not a secret).
    # It is the audience/issuer used to verify Firebase ID tokens. Empty => disabled.
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")

    # CORS: a single explicit allow-list. Never combine "*" with credentials.
    CORS_ORIGINS: list = _parse_origins(
        os.getenv("CORS_ORIGINS"),
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
        ],
    )

    # Server binding (used by startup scripts / uvicorn)
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))


settings = Settings()
