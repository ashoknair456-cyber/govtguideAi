import logging
from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
from database import get_db
from rate_limit import limiter
from routes import auth, profile, schemes, chat, admin, saved_schemes, notifications, recommendations, comparison, documents, application_guide, benefits, tracker, fraud, csc, family, features

logger = logging.getLogger("govguide.main")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="GovGuide AI: Citizen Eligibility & Welfare Discovery Platform (Development Sandbox)",
    version="1.0.0"
)

# Enable CORS for frontend integration using an explicit allow-list.
# NOTE: allow_origins=["*"] must never be combined with allow_credentials=True.
cors_origins = settings.CORS_ORIGINS
allow_all = "*" in cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if allow_all else cors_origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply in-memory sliding-window rate limiting to API endpoints."""
    path = request.url.path
    # Only limit API traffic; allow CORS preflight and non-API routes through.
    if not path.startswith("/api") or request.method == "OPTIONS":
        return await call_next(request)

    fwd = request.headers.get("x-forwarded-for")
    client_id = (fwd.split(",")[0].strip() if fwd
                 else (request.client.host if request.client else "unknown"))

    allowed, retry_after = limiter.allow(client_id, path)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please slow down and try again shortly."},
            headers={"Retry-After": str(retry_after)},
        )
    return await call_next(request)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(schemes.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(saved_schemes.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(recommendations.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(application_guide.router, prefix="/api")
app.include_router(benefits.router, prefix="/api")
app.include_router(tracker.router, prefix="/api")
app.include_router(fraud.router, prefix="/api")
app.include_router(csc.router, prefix="/api")
app.include_router(family.router, prefix="/api")
app.include_router(features.router, prefix="/api")

@app.get("/health")
async def health():
    import scheme_db
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "local_json_file",
        "scheme_store": "postgres" if scheme_db.POSTGRES_OK else "local_json_file",
    }

@app.get("/")
async def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "mode": "Sandbox/Demo Mode",
        "notice": "All data generated here is for demonstration purposes. No actual government transactions are performed."
    }

# Seeding Logic on startup
@app.on_event("startup")
async def seed_database():
    db = get_db()
    schemes_col = db["schemes"]
    
    count = await schemes_col.count_documents({})
    if count == 0:
        logger.info("Database schemes collection is empty. Seeding verified government schemes from seed_schemes...")
        try:
            from seed_schemes import SCHEMES
            for scheme_doc in SCHEMES:
                await schemes_col.insert_one(dict(scheme_doc))
            logger.info(f"Successfully seeded {len(SCHEMES)} verified government schemes into database.")
        except Exception as e:
            logger.error(f"Failed to seed schemes from seed_schemes.py: {e}")
    else:
        logger.info(f"Database contains {count} schemes. Skipping scheme seeding.")

    # Always ensure Admin and Demo users exist
    users_col = db["users"]
    admin_phone = "+919999999999"
    existing_admin = await users_col.find_one({"phone": admin_phone})
    if not existing_admin:
        await users_col.insert_one({
            "_id": admin_phone,
            "phone": admin_phone,
            "role": "admin",
            "name": "Admin Official",
            "created_at": datetime.utcnow()
        })
        logger.info(f"Seeded Admin User Phone: {admin_phone}")
        
    demo_phone = "+919876543210"
    existing_demo = await users_col.find_one({"phone": demo_phone})
    if not existing_demo:
        await users_col.insert_one({
            "_id": demo_phone,
            "phone": demo_phone,
            "role": "user",
            "name": "Arun Kumar",
            "created_at": datetime.utcnow()
        })
        logger.info(f"Seeded Demo Citizen Phone: {demo_phone}")

    # Seed initial profile for demo citizen if missing
    profiles_col = db["profiles"]
    demo_prof = await profiles_col.find_one({"user_id": demo_phone})
    if not demo_prof:
        await profiles_col.insert_one({
            "_id": demo_phone,
            "user_id": demo_phone,
            "profile": {
                "full_name": "Arun Kumar",
                "mobile_number": demo_phone,
                "age": 22,
                "gender": "Male",
                "state": "Maharashtra",
                "district": "Mumbai",
                "rural_or_urban": "Urban",
                "annual_family_income": "₹1,00,000 - ₹3,00,000",
                "income_range": "1-3 Lakhs",
                "occupation": "Student",
                "employment_status": "Student",
                "education_level": "Undergraduate",
                "student_status": True,
                "is_student": True,
                "farmer_status": False,
                "is_farmer": False,
                "disability_status": False,
                "is_disabled": False,
                "family_size": 4,
                "category": "General",
                "housing_status": "Pucca"
            },
            "updated_at": datetime.utcnow()
        })
        logger.info(f"Seeded initial demo profile for {demo_phone}")

@app.on_event("startup")
async def init_scheme_store():
    """
    Best-effort initialization of the optional Supabase/PostgreSQL verified-scheme
    store. If Postgres is not configured or unreachable, everything stays on the
    local JSON file database - this never blocks or crashes startup.
    """
    import scheme_db
    import scheme_store
    try:
        if not scheme_db.resolve_status():
            logger.info("Postgres scheme store not available; using local JSON file store.")
            return
        if await scheme_db.ensure_schema():
            stats = await scheme_store.migrate_from_mongo(get_db())
            logger.info(f"Postgres scheme store ready: {stats}")
    except Exception as e:  # noqa: BLE001 - must never break startup
        logger.warning(f"Postgres scheme store init skipped due to error: {e}")
        scheme_db.POSTGRES_OK = False

