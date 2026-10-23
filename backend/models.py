from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional, Union
from datetime import datetime

# ==================== AUTH MODELS ====================

class GoogleAuthRequest(BaseModel):
    token: str

class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    registration_type: str = Field("email", pattern=r"^(email|mobile)$")
    email: Optional[str] = None
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,14}$")
    password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)
    captcha_id: str
    captcha_answer: str

class LoginRequest(BaseModel):
    login_type: str = Field("email", pattern=r"^(email|mobile)$")
    identifier: str  # email or phone
    password: str

class OTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\+?[0-9]{10,14}$")
    name: Optional[str] = None
    state: Optional[str] = None
    occupation: Optional[str] = None

class OTPVerify(BaseModel):
    phone: str
    otp: str
    session_token: Optional[str] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    state: Optional[str] = None
    occupation: Optional[str] = None
    category: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    # Permanent, opaque identifier for the account. Unlike user_id (which is the
    # login phone/email) it never changes and is safe to reference from features.
    internal_id: Optional[str] = None
    role: str
    full_name: Optional[str] = None
    is_new_profile: bool = False

# ==================== PROFILE MODEL (12.3 FIELDS) ====================

class UserProfile(BaseModel):
    # Core Identity
    full_name: str = "Citizen"
    age: Optional[int] = 25
    gender: Optional[str] = "Male"  # Male, Female, Other
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    
    # Geographic & Location (12.6)
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = "Mumbai"
    location: Optional[str] = None  # City/Town/Village
    rural_or_urban: Optional[str] = "Urban"  # Rural, Urban
    
    # Financial & Livelihood
    annual_family_income: Optional[str] = "₹1,00,000 - ₹3,00,000"
    income_range: Optional[str] = "1-3 Lakhs"  # Normalized for rules engine
    annual_income_numeric: Optional[float] = None  # Numeric income for income_limit (lte) checks
    occupation: Optional[str] = "General"
    employment_status: Optional[str] = "Employed"  # Employed, Unemployed, Student, Retired, Self-Employed
    
    # Education & Academic
    education_level: Optional[str] = "Secondary"
    student_status: Optional[bool] = False
    course: Optional[str] = None
    
    # Social & Household Demographics
    marital_status: Optional[str] = "Single"  # Single, Married, Widowed, Divorced
    farmer_status: Optional[bool] = False
    land_ownership: Optional[str] = "None"  # None, Marginal (<1 hectare), Small (1-2 hectares), Medium
    disability_status: Optional[bool] = False
    housing_status: Optional[str] = "Pucca"  # Kutcha, Semi-Pucca, Pucca, Rented, Homeless
    business_status: Optional[str] = "None"  # None, Micro Enterprise, Small Business, Aspiring Entrepreneur
    family_details: Optional[str] = "4 members"
    
    # Compatibility & Search Fields
    category: Optional[str] = "General"  # General, OBC, SC, ST, EWS
    is_minority: Optional[bool] = False
    is_student: Optional[bool] = False
    is_farmer: Optional[bool] = False
    is_disabled: Optional[bool] = False
    family_size: Optional[int] = 4
    has_bpl_card: Optional[bool] = False
    extra_info: Dict[str, Any] = {}

    class Config:
        extra = "allow"

class ProfileResponse(BaseModel):
    user_id: str
    profile: Optional[UserProfile] = None
    updated_at: datetime

# ==================== SCHEME & RULES MODELS ====================

class EligibilityRule(BaseModel):
    field: str
    operator: str
    value: Any

class ConditionalDocument(BaseModel):
    document_name: str
    condition_field: str
    condition_operator: str
    condition_value: Any
    description: Optional[str] = None

class Scheme(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    description: str
    short_description: Optional[str] = None
    benefits: str
    financial_amount: Optional[str] = None
    category: str
    classification: str = "Central"  # Central, State, Union Territory
    ministry: Optional[str] = None
    department: Optional[str] = None
    state: Optional[str] = None
    target_beneficiaries: Optional[str] = None
    eligibility_criteria: str
    rules: List[EligibilityRule] = []
    required_documents: List[str] = []
    conditional_documents: List[ConditionalDocument] = []
    application_process: Optional[str] = None
    application_mode: Optional[str] = "Online"
    application_deadline: Optional[str] = None
    official_website: Optional[str] = None
    official_url: str
    official_application_url: Optional[str] = None
    official_source: str
    source_name: Optional[str] = None
    last_verified: str = "2026-08-01"
    verification_status: str = "PENDING_VERIFICATION"
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        extra = "allow"
        populate_by_name = True

class SchemeCreate(BaseModel):
    name: str
    description: str
    short_description: Optional[str] = None
    benefits: str
    financial_amount: Optional[str] = None
    category: str
    classification: str = "Central"
    ministry: Optional[str] = None
    department: Optional[str] = None
    state: Optional[str] = None
    target_beneficiaries: Optional[str] = None
    eligibility_criteria: str
    rules: List[EligibilityRule] = []
    required_documents: List[str] = []
    conditional_documents: List[ConditionalDocument] = []
    application_process: Optional[str] = None
    application_mode: Optional[str] = "Online"
    application_deadline: Optional[str] = None
    official_website: Optional[str] = None
    official_url: str
    official_application_url: Optional[str] = None
    official_source: str
    source_name: Optional[str] = None
    last_verified: str = "2026-08-01"
    verification_status: str = "PENDING_VERIFICATION"
    status: str = "ACTIVE"

    class Config:
        extra = "allow"

class SchemeVersion(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    scheme_id: str
    version: int
    changes: str
    previous_data: Dict[str, Any]
    current_data: Dict[str, Any]
    source: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        extra = "allow"
        populate_by_name = True

class GovernmentSource(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    url: str
    category: str # e.g. Ministry, State Portal
    status: str = "Active"
    last_scanned: Optional[datetime] = None

class SourceScanLog(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    source_id: str
    scanned_at: datetime = Field(default_factory=datetime.utcnow)
    status: str
    new_schemes_found: int = 0
    updated_schemes_found: int = 0
    error_message: Optional[str] = None

class SchemeUpdateLog(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    scheme_id: str
    update_type: str # 'New', 'Updated', 'Closed'
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "Pending Verification"

# ==================== CHAT & AI PROFILE SYNC MODELS ====================

class ChatMessage(BaseModel):
    sender: str  # "user" or "bot"
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatHistory(BaseModel):
    user_id: str
    messages: List[ChatMessage] = []

class ChatInput(BaseModel):
    message: str
    language: Optional[str] = "en"

class ChatResponse(BaseModel):
    reply: str
    sender: str = "bot"
    audio_base64: Optional[str] = None

class ProfileSyncChatRequest(BaseModel):
    message: str
    language: str = "en"
    current_profile: Dict[str, Any] = {}

class ProfileSyncChatResponse(BaseModel):
    reply: str
    extracted_fields: Dict[str, Any]
    updated_profile: Dict[str, Any]
    next_question: Optional[str]
    missing_fields: List[str]
    is_ready_for_confirmation: bool

# ==================== RECOMMENDATION MODELS ====================

class Recommendation(BaseModel):
    scheme_id: str
    name: str
    match_score: int
    eligibility_status: str
    benefits: str
    why_qualify: str
    required_documents: List[str] = []
    deadline: Optional[str] = None
    official_url: str
    official_website: Optional[str] = None
    category: Optional[str] = None
    classification: Optional[str] = None
    state: Optional[str] = None
    ministry: Optional[str] = None
    financial_amount: Optional[str] = None
    application_mode: Optional[str] = "Online"
    target_beneficiaries: Optional[str] = None

class RecommendationResponse(BaseModel):
    recommendations: List[Recommendation] = []
    missing_fields: List[str] = []

# ==================== SAVED SCHEMES & NOTIFICATIONS ====================

class SavedScheme(BaseModel):
    user_id: str
    scheme_id: str
    saved_at: datetime = Field(default_factory=datetime.utcnow)
    reminder_date: Optional[str] = None
    scheme: Optional[Dict[str, Any]] = None

class Notification(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    title: str
    message: str
    type: str = "general"
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        extra = "allow"
        populate_by_name = True

