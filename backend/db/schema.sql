-- ============================================================================
-- GovtGuide AI — Normalized Verified-Scheme Store (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Idempotent: safe to run repeatedly. Referenced by backend/scheme_db.py to
-- bootstrap the Postgres layer. All user/app data (auth, profiles, saved
-- schemes, notifications) stays in MongoDB/JSON; this schema only holds the
-- scheme catalogue + eligibility rules + provenance + reference taxonomies.
--
-- Design notes (spec section 7 / 17):
--   * Every published scheme must trace back to a row in scheme_sources.
--   * government_level + state/union_territory/district prevent a state scheme
--     being shown as nationwide.
--   * scheme_aliases preserves renamed/merged/historical names (section 7).
--   * Rules/benefits/documents are normalized into child tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reference_states_ut (
    code        TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    type        TEXT NOT NULL,            -- 'State' | 'Union Territory'
    iso_code    TEXT
);

CREATE TABLE IF NOT EXISTS reference_categories (
    code        TEXT PRIMARY KEY,         -- 'A'..'U'
    name        TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS schemes (
    scheme_id                 TEXT PRIMARY KEY,
    scheme_name               TEXT NOT NULL,
    official_scheme_name      TEXT,
    short_description         TEXT,
    description               TEXT,
    objectives                TEXT,
    government_level          TEXT NOT NULL DEFAULT 'Central',   -- Central|State|UT|District
    country                   TEXT NOT NULL DEFAULT 'India',
    state                     TEXT,
    union_territory           TEXT,
    district                  TEXT,
    ministry                  TEXT,
    department                TEXT,
    category                  TEXT,
    category_code             TEXT,
    target_beneficiaries      TEXT,
    eligibility_criteria      TEXT,
    benefit_summary           TEXT,          -- legacy free-text benefits string
    financial_amount          TEXT,
    application_mode          TEXT DEFAULT 'Online',
    application_process       TEXT,
    application_steps         TEXT,
    application_start_date    DATE,
    application_end_date      DATE,
    application_deadline      TEXT,
    status                    TEXT NOT NULL DEFAULT 'Active',    -- Active|Inactive|Disabled|Outdated|Closed
    verification_status       TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    official_scheme_url       TEXT,
    official_application_url  TEXT,
    official_guidelines_url   TEXT,
    official_url              TEXT,          -- legacy primary apply link
    official_website          TEXT,          -- legacy portal link
    official_source           TEXT,
    source_name               TEXT,
    source_url                TEXT,
    source_publication_date   DATE,
    last_verified_at          DATE,
    last_updated_at           TIMESTAMPTZ,
    update_notes              TEXT,
    requires_official_verification BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schemes_state           ON schemes (state);
CREATE INDEX IF NOT EXISTS idx_schemes_level           ON schemes (government_level);
CREATE INDEX IF NOT EXISTS idx_schemes_category        ON schemes (category_code);
CREATE INDEX IF NOT EXISTS idx_schemes_status          ON schemes (status);
CREATE INDEX IF NOT EXISTS idx_schemes_end_date        ON schemes (application_end_date);
CREATE INDEX IF NOT EXISTS idx_schemes_last_verified   ON schemes (last_verified_at);

CREATE TABLE IF NOT EXISTS scheme_aliases (
    id             BIGSERIAL PRIMARY KEY,
    scheme_id      TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    alias          TEXT NOT NULL,
    alias_type     TEXT DEFAULT 'alternative',   -- alternative|renamed_from|merged_from|historical
    effective_from DATE,
    note           TEXT
);
CREATE INDEX IF NOT EXISTS idx_aliases_scheme ON scheme_aliases (scheme_id);

CREATE TABLE IF NOT EXISTS scheme_eligibility_rules (
    id             BIGSERIAL PRIMARY KEY,
    scheme_id      TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    field          TEXT NOT NULL,
    operator       TEXT NOT NULL,               -- eq|neq|gte|lte|in|nin
    value          JSONB,                        -- scalar or list, mirrors engine rules
    min_age        INT,
    max_age        INT,
    gender         TEXT,
    income_limit   NUMERIC,                      -- numeric annual income ceiling
    social_category TEXT,
    occupation     TEXT,
    education      TEXT,
    residence      TEXT,
    disability_pct NUMERIC,
    landholding    TEXT,
    other          TEXT,
    requires_official_verification BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_rules_scheme ON scheme_eligibility_rules (scheme_id);

CREATE TABLE IF NOT EXISTS scheme_benefits (
    id                      BIGSERIAL PRIMARY KEY,
    scheme_id               TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    benefit_type            TEXT,               -- grant|loan|subsidy|insurance|pension|service|reimbursement
    benefit_amount          NUMERIC,
    benefit_amount_text     TEXT,
    benefit_frequency       TEXT,
    contribution_requirements TEXT,
    description             TEXT
);
CREATE INDEX IF NOT EXISTS idx_benefits_scheme ON scheme_benefits (scheme_id);

CREATE TABLE IF NOT EXISTS scheme_documents (
    id                 BIGSERIAL PRIMARY KEY,
    scheme_id          TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    document_name      TEXT NOT NULL,
    is_conditional     BOOLEAN NOT NULL DEFAULT FALSE,
    condition_field    TEXT,
    condition_operator TEXT,
    condition_value    JSONB,
    description        TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_scheme ON scheme_documents (scheme_id);

CREATE TABLE IF NOT EXISTS scheme_sources (
    id                       BIGSERIAL PRIMARY KEY,
    scheme_id                TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    source_name              TEXT,
    source_url               TEXT,
    source_publication_date  DATE,
    retrieved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    note                     TEXT
);
CREATE INDEX IF NOT EXISTS idx_sources_scheme ON scheme_sources (scheme_id);

CREATE TABLE IF NOT EXISTS scheme_versions (
    id           BIGSERIAL PRIMARY KEY,
    scheme_id    TEXT NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
    version      INT NOT NULL,
    snapshot     JSONB,
    changes      TEXT,
    modified_by  TEXT,
    modified_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_versions_scheme ON scheme_versions (scheme_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    entity     TEXT NOT NULL,
    entity_id  TEXT,
    action     TEXT NOT NULL,
    detail     JSONB,
    actor      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Reference data: 28 States + 8 Union Territories (spec section 3)
-- Facts only - not generated/invented content.
-- ============================================================================
INSERT INTO reference_states_ut (code, name, type, iso_code) VALUES
 ('AP','Andhra Pradesh','State','IN-AP'),
 ('AR','Arunachal Pradesh','State','IN-AR'),
 ('AS','Assam','State','IN-AS'),
 ('BR','Bihar','State','IN-BR'),
 ('CG','Chhattisgarh','State','IN-CG'),
 ('GA','Goa','State','IN-GA'),
 ('GJ','Gujarat','State','IN-GJ'),
 ('HR','Haryana','State','IN-HR'),
 ('HP','Himachal Pradesh','State','IN-HP'),
 ('JH','Jharkhand','State','IN-JH'),
 ('KA','Karnataka','State','IN-KA'),
 ('KL','Kerala','State','IN-KL'),
 ('MP','Madhya Pradesh','State','IN-MP'),
 ('MH','Maharashtra','State','IN-MH'),
 ('MN','Manipur','State','IN-MN'),
 ('ML','Meghalaya','State','IN-ML'),
 ('MZ','Mizoram','State','IN-MZ'),
 ('NL','Nagaland','State','IN-NL'),
 ('OD','Odisha','State','IN-OD'),
 ('PB','Punjab','State','IN-PB'),
 ('RJ','Rajasthan','State','IN-RJ'),
 ('SK','Sikkim','State','IN-SK'),
 ('TN','Tamil Nadu','State','IN-TN'),
 ('TG','Telangana','State','IN-TG'),
 ('TR','Tripura','State','IN-TR'),
 ('UP','Uttar Pradesh','State','IN-UP'),
 ('UK','Uttarakhand','State','IN-UK'),
 ('WB','West Bengal','State','IN-WB'),
 ('AN','Andaman and Nicobar Islands','Union Territory','IN-AN'),
 ('CH','Chandigarh','Union Territory','IN-CH'),
 ('DN','Dadra and Nagar Haveli and Daman and Diu','Union Territory','IN-DN'),
 ('DL','Delhi','Union Territory','IN-DL'),
 ('JK','Jammu and Kashmir','Union Territory','IN-JK'),
 ('LA','Ladakh','Union Territory','IN-LA'),
 ('LD','Lakshadweep','Union Territory','IN-LD'),
 ('PY','Puducherry','Union Territory','IN-PY')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Reference data: Scheme category taxonomy A-U (spec section 4)
-- ============================================================================
INSERT INTO reference_categories (code, name, description) VALUES
 ('A','Education and Student Welfare','School/college scholarships, fellowships, fee & hostel assistance'),
 ('B','Women and Girl Child Welfare','Financial aid, maternity, empowerment, widow pensions, marriage assistance'),
 ('C','Farmers and Agriculture','Income support, crop insurance, loans, irrigation, equipment, livestock, fisheries'),
 ('D','Healthcare and Medical Assistance','Health insurance, hospitalization, maternal/child care, medicine subsidies'),
 ('E','Housing and Basic Amenities','Rural/urban housing, sanitation, water, electricity, cooking fuel'),
 ('F','Employment and Unemployment','Job services, apprenticeship, skill development, rural/urban livelihoods'),
 ('G','Business and Entrepreneurship','Startup, MSME, loans, guarantees, artisan and street-vendor support'),
 ('H','Senior Citizen Welfare','Old-age pensions, social security, elderly care and health support'),
 ('I','SC/ST/OBC/EWS and Social Groups','Pre/post-matric scholarships, hostels, coaching, development corporations'),
 ('J','Disability and Divyangjan Welfare','Disability pensions, assistive devices, rehabilitation, barrier-free access'),
 ('K','Rural and Low-Income Family Welfare','Food security, ration, rural livelihoods, financial inclusion'),
 ('L','Workers and Labour Welfare','Construction/unorganized worker boards, EPF/ESIC, e-Shram, maternity for workers'),
 ('M','Pension and Financial inclusion','Social security pensions, APY, PMJJBY, PMSBY, Jan Dhan, DBT'),
 ('N','Food, Nutrition and Child Welfare','Anganwadi, POSHAN, school meals, child protection and nutrition'),
 ('O','Skill Development and Digital Education','Free/technical/vocational training, digital literacy, certification'),
 ('P','Transport and Public Services','Travel concessions, state transport, e-mobility, road-transport welfare'),
 ('Q','Fisheries, Dairy and Animal Husbandry','Fishermen welfare, aquaculture, dairy, livestock insurance, vet services'),
 ('R','Minorities and Community Development','Educational scholarships, skill, entrepreneurship for minority groups'),
 ('S','Sports, Culture and Youth','Sports scholarships, athlete assistance, youth and cultural artist welfare'),
 ('T','Environment and Renewable Energy','Rooftop solar, renewables, e-mobility, biogas, waste management'),
 ('U','Other Government Benefits','Disaster relief, ex-servicemen, legal aid, artisans, tourism, district initiatives')
ON CONFLICT (code) DO NOTHING;
