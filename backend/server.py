"""BlinkedIn - FastAPI backend v2
Rebrand + AI Agents + Leaderboard + Real Resend emails + expanded companies + dedup applications.
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import jwt
import bcrypt
import stripe
import secrets
import logging
import asyncio
import random
import re
import resend
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from pydantic import BaseModel, EmailStr
from bson import ObjectId
import httpx
import anthropic
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from data import COMPANIES, ROLES, LOCATIONS, PLANS, FREE_EMAILS, DEFAULT_AGENT_PROMPT, logo_url as logo

# ============ Setup ============
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("blinkedin")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tls=True, tlsCAFile=certifi.where())
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", FRONTEND_URL)  # used inside emails — points to production
MOCK_API_KEY = os.environ.get("MOCK_API_KEY", "bli_mock_demo_00000000000000000000000000000000")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "blinkedinsupport@gmail.com")
LOGO_URL = os.environ.get("LOGO_URL", "")

# --- Direct Anthropic API (replaces Emergent's LLM proxy) ---
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
# Check https://docs.claude.com/en/docs/about-claude/models for the current model id
# if this ever starts returning a "model not found" error — model names get retired.
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

# --- Direct Google OAuth (replaces Emergent's managed-auth proxy) ---
# Create an OAuth 2.0 Client ID at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# --- Mock/demo job data ---
# The original build seeded ~500 randomly-generated fake jobs so the demo felt alive,
# and fell back to fake jobs whenever a real scrape/AI-extract came back empty.
# Default this OFF: a real deployment should show real jobs or nothing, never a fake
# posting dressed up as real. Set ALLOW_MOCK_JOBS=true only for local demo/UI testing.
ALLOW_MOCK_JOBS = os.environ.get("ALLOW_MOCK_JOBS", "false").lower() == "true"

FREE_EMAILS_LEGACY = FREE_EMAILS  # unused, kept for potential legacy imports

# ============ Helpers ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(uid: str, email: str, role: str) -> str:
    return jwt.encode({"sub": uid, "email": email, "role": role,
                       "exp": datetime.now(timezone.utc) + timedelta(days=7),
                       "type": "access"}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

def clear_auth_cookie(response: Response):
    response.delete_cookie("access_token", path="/")

def serialize_doc(doc: Dict) -> Dict:
    if not doc: return doc
    doc = dict(doc)
    if "_id" in doc: doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId): doc[k] = str(v)
        if isinstance(v, datetime): doc[k] = v.isoformat()
    doc.pop("password_hash", None)
    return doc

async def get_current_user(request: Request) -> Dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "): token = auth[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user: raise HTTPException(401, "User not found")
    return serialize_doc(user)

async def get_admin(user: Dict = Depends(get_current_user)) -> Dict:
    if user.get("role") != "admin": raise HTTPException(403, "Admin only")
    return user

def is_privileged(email: str) -> bool:
    return email.lower() in FREE_EMAILS

# ============ Email helper ============
def _brand_email(inner_html: str, title: str = "BlinkedIn") -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:40px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
          <tr><td style="background:#5B4FFF;padding:32px;text-align:center;">
            <img src="{LOGO_URL}" alt="BlinkedIn" width="200" style="display:inline-block;border-radius:12px;" />
          </td></tr>
          <tr><td style="padding:36px 40px;color:#1a1a1a;font-size:15px;line-height:1.6;">
            {inner_html}
          </td></tr>
          <tr><td style="background:#f6f7f9;padding:20px;text-align:center;font-size:12px;color:#888;">
            © 2026 BlinkedIn · Job feed that never sleeps.<br/>
            Questions? Reply to this email — we're humans.
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>"""

async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    if not resend.api_key:
        logger.info(f"[MOCK EMAIL to {to}] {subject}")
        await db.email_log.insert_one({"to": to, "subject": subject, "html": html, "mode": "mock", "created_at": datetime.now(timezone.utc)})
        return None
    try:
        result = await asyncio.to_thread(resend.Emails.send, {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html})
        eid = (result or {}).get("id")
        await db.email_log.insert_one({"to": to, "subject": subject, "mode": "resend", "email_id": eid, "created_at": datetime.now(timezone.utc)})
        return eid
    except Exception as e:
        logger.error(f"Resend failed for {to}: {e}")
        await db.email_log.insert_one({"to": to, "subject": subject, "mode": "failed", "error": str(e), "created_at": datetime.now(timezone.utc)})
        return None

# ============ Models ============
class RegisterReq(BaseModel):
    name: str; email: EmailStr; password: str

class LoginReq(BaseModel):
    email: EmailStr; password: str

class GoogleAuthReq(BaseModel):
    id_token: str

class JobUrlReq(BaseModel):
    company: str; url: str; logo: Optional[str] = None
    location_filter: Optional[str] = None  # e.g. "Bangalore" / "Remote" / "" for no filter
    recent_only: bool = True  # if true, only keep postings the model marks as today/yesterday/recent

class ContactReq(BaseModel):
    name: str; email: EmailStr; subject: str; message: str

class ReferralSubmitReq(BaseModel):
    job_id: str; first_name: str; last_name: str; email: EmailStr
    address: str; message: Optional[str] = ""; resume_url: Optional[str] = ""

class EmployeeRegisterReq(BaseModel):
    first_name: str; last_name: str; dob: str; email: EmailStr; address: str
    company: str; govt_id: Optional[str] = ""; company_id: Optional[str] = ""
    bank_account: str; ifsc: str; branch: str; upi: Optional[str] = ""; resume_url: Optional[str] = ""

class WithdrawReq(BaseModel):
    amount: float

class CheckoutReq(BaseModel):
    lookup_key: str; origin_url: str

class ProofUploadReq(BaseModel):
    referral_id: str; proof_type: str; proof_url: str

class ConsentReq(BaseModel):
    accepted: bool

class ForgotPasswordReq(BaseModel):
    email: EmailStr

class ResetPasswordReq(BaseModel):
    token: str
    new_password: str

class ChangePasswordReq(BaseModel):
    current_password: str
    new_password: str

class ResendVerificationReq(BaseModel):
    email: EmailStr

# ============ App ============
app = FastAPI(title="BlinkedIn API")
api = APIRouter(prefix="/api")

# ============ Companies + helpers ============
# COMPANIES, ROLES, LOCATIONS, PLANS, DEFAULT_AGENT_PROMPT, logo() imported from data.py
def logo_proxy(domain: str) -> str:
    """Backend proxy URL — safe fallback path if Clearbit is unreachable from client."""
    return f"/api/logo/{domain}"

def _gen_job(company: Dict) -> Dict:
    return {
        "company": company["name"],
        "logo": logo(company["domain"]),
        "role": random.choice(ROLES),
        "experience": f"{random.randint(1, 10)}-{random.randint(11, 15)} yrs",
        "location": random.choice(LOCATIONS),
        "type": random.choice(["Full-time", "Contract", "Hybrid"]),
        "description": "Join a world-class team building products used by millions. You'll collaborate with a cross-functional group and own features end-to-end.",
        "requirements": ["Strong programming skills", "5+ years experience", "Team player", "Problem-solving mindset"],
        "apply_url": company["url"],
        "posted_at": datetime.now(timezone.utc),
    }

# ============ Auth ============
def _gen_token() -> str:
    return secrets.token_urlsafe(32)

async def _create_verification_token(user_id: str, email: str) -> str:
    tok = _gen_token()
    await db.verification_tokens.insert_one({
        "token": tok, "user_id": user_id, "email": email,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=2),
        "used": False,
    })
    return tok

async def _send_verification_email(email: str, name: str, token: str) -> bool:
    link = f"{PUBLIC_APP_URL}/verify-email/{token}"
    html = _brand_email(
        f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>One click to verify, {name.split(' ')[0]}!</h2>"
        f"<p>Thanks for joining BlinkedIn. Please verify your email so we can keep your account secure.</p>"
        f"<p><a href='{link}' style='display:inline-block;background:#5B4FFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;'>Verify my email</a></p>"
        f"<p style='color:#888;font-size:13px;'>Or paste this link in your browser:<br/><code style='word-break:break-all;font-size:12px;'>{link}</code></p>"
        f"<p style='color:#888;font-size:12px;'>This link expires in 48 hours. If you didn't sign up for BlinkedIn, ignore this email.</p>"
    )
    result = await send_email(email, "Verify your BlinkedIn email", html)
    return result is not None

async def _send_password_reset_email(email: str, name: str, token: str) -> bool:
    link = f"{PUBLIC_APP_URL}/reset-password/{token}"
    html = _brand_email(
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
        f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>Password reset requested</h2>"
        f"<p>Hi {name.split(' ')[0]}, we received a request to reset your BlinkedIn password.</p>"
        f"<p><a href='{link}' style='display:inline-block;background:#5B4FFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;'>Reset my password</a></p>"
        f"<p style='color:#888;font-size:13px;'>Or paste this link in your browser:<br/><code style='word-break:break-all;font-size:12px;'>{link}</code></p>"
        f"<p style='color:#888;font-size:12px;'>This link expires in 1 hour. If you didn't request this, ignore this email — your password stays the same.</p>"
    )
    result = await send_email(email, "Reset your BlinkedIn password", html)
    return result is not None

@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower().strip()
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    pre_verified = is_privileged(email)  # seeded emails skip verification
    doc = {
        "email": email, "name": req.name, "password_hash": hash_password(req.password),
        "role": "user", "verified": pre_verified, "provider": "local",
        "applications_used": 0, "subscription": None, "is_employee": False,
        "employee_verified": False, "avatar": None,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    token = create_access_token(uid, email, "user")
    set_auth_cookie(response, token)
    await log_activity("register", email)
    # Send verification email (unless pre-verified admin/seeded)
    verify_link = None
    email_delivered = False
    if not pre_verified:
        vtoken = await _create_verification_token(uid, email)
        email_delivered = await _send_verification_email(email, req.name, vtoken)
        # Graceful fallback: if Resend cannot deliver (sandbox / unverified domain),
        # auto-verify so the account is fully usable. The verification link is still
        # returned so the client can show it or the admin can manually verify later.
        if not email_delivered:
            await db.users.update_one({"_id": res.inserted_id}, {"$set": {"verified": True, "email_delivery": "unavailable"}})
            doc["verified"] = True
            verify_link = f"{PUBLIC_APP_URL}/verify-email/{vtoken}"
            logger.warning(f"Auto-verified {email} (email delivery unavailable — verify your Resend domain to enable real emails)")
    else:
        # Just a welcome for pre-verified accounts
        asyncio.create_task(send_email(email, "Welcome to BlinkedIn 🚀",
            _brand_email(f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>Welcome, {req.name}!</h2>"
                         f"<p>Your BlinkedIn account is ready.</p>")))
    doc["_id"] = res.inserted_id
    return {
        "user": serialize_doc(doc), "token": token,
        "verification_sent": email_delivered,
        "auto_verified": (not pre_verified) and (not email_delivered),
        "verify_link": verify_link,  # only set when email couldn't be delivered
    }

@api.post("/auth/login")
async def login(req: LoginReq, response: Response, request: Request):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_access_token(str(user["_id"]), email, user.get("role", "user"))
    set_auth_cookie(response, token)
    await db.sessions.insert_one({
        "user_id": str(user["_id"]), "email": email,
        "ip": request.client.host if request.client else "",
        "ua": request.headers.get("user-agent", ""),
        "created_at": datetime.now(timezone.utc)
    })
    await log_activity("login", email)
    return {"user": serialize_doc(user), "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: Dict = Depends(get_current_user)):
    return user

@api.post("/auth/google")
async def google_auth(req: GoogleAuthReq, response: Response, request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in isn't configured on this server yet (missing GOOGLE_CLIENT_ID).")
    try:
        # Verifies the JWT's signature, audience, issuer, and expiry against Google's
        # public keys directly — no third-party auth proxy involved.
        idinfo = google_id_token.verify_oauth2_token(
            req.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception as e:
        raise HTTPException(401, f"Google auth failed: {e}")
    data = {"email": idinfo.get("email", ""), "name": idinfo.get("name", ""), "picture": idinfo.get("picture")}
    email = data.get("email", "").lower().strip()
    if not email: raise HTTPException(400, "No email from Google")
    user = await db.users.find_one({"email": email})
    if not user:
        doc = {
            "email": email, "name": data.get("name", email.split("@")[0]),
            "password_hash": None, "role": "user", "verified": True,
            "provider": "google", "avatar": data.get("picture"),
            "applications_used": 0, "subscription": None,
            "is_employee": False, "employee_verified": False,
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": res.inserted_id})
    token = create_access_token(str(user["_id"]), email, user.get("role", "user"))
    set_auth_cookie(response, token)
    await db.sessions.insert_one({
        "user_id": str(user["_id"]), "email": email,
        "ip": request.client.host if request.client else "",
        "provider": "google", "created_at": datetime.now(timezone.utc)
    })
    await log_activity("login_google", email)
    return {"user": serialize_doc(user), "token": token}

# --- Email verification & password recovery ---
@api.post("/auth/verify-email/{token}")
async def verify_email(token: str):
    rec = await db.verification_tokens.find_one({"token": token})
    if not rec or rec.get("used"):
        raise HTTPException(400, "Invalid or already-used verification link")
    exp = rec.get("expires_at")
    if exp:
        exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if exp_utc < datetime.now(timezone.utc):
            raise HTTPException(400, "This verification link has expired. Request a new one.")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])}, {"$set": {"verified": True}})
    await db.verification_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}})
    await log_activity("email_verified", rec["email"])
    return {"ok": True, "email": rec["email"]}

@api.post("/auth/resend-verification")
async def resend_verification(req: ResendVerificationReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    fallback_link = None
    delivered = False
    if user and not user.get("verified"):
        vtoken = await _create_verification_token(str(user["_id"]), email)
        delivered = await _send_verification_email(email, user.get("name", "there"), vtoken)
        if not delivered:
            # sandbox/domain-unverified: auto-verify + hand back the link so user isn't stuck
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"verified": True, "email_delivery": "unavailable"}})
            fallback_link = f"{PUBLIC_APP_URL}/verify-email/{vtoken}"
    return {
        "ok": True,
        "message": "If that email exists, a verification link has been sent.",
        "delivered": delivered,
        "fallback_link": fallback_link,  # only present when email delivery is unavailable
    }

@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    delivered = False
    fallback_link = None
    if user and user.get("provider", "local") == "local":
        tok = _gen_token()
        await db.password_reset_tokens.insert_one({
            "token": tok, "user_id": str(user["_id"]), "email": email,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
        })
        delivered = await _send_password_reset_email(email, user.get("name", "there"), tok)
        if not delivered:
            fallback_link = f"{PUBLIC_APP_URL}/reset-password/{tok}"
        await log_activity("forgot_password_request", email)
    return {
        "ok": True,
        "message": "If that email exists, a password reset link has been sent.",
        "delivered": delivered,
        "fallback_link": fallback_link,  # only present when email delivery is unavailable
    }

@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordReq):
    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    rec = await db.password_reset_tokens.find_one({"token": req.token})
    if not rec or rec.get("used"):
        raise HTTPException(400, "Invalid or already-used reset link")
    exp = rec.get("expires_at")
    exp_utc = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
    if exp_utc < datetime.now(timezone.utc):
        raise HTTPException(400, "This reset link has expired. Request a new one.")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}})
    await log_activity("password_reset", rec["email"])
    return {"ok": True, "email": rec["email"]}

@api.post("/auth/change-password")
async def change_password(req: ChangePasswordReq, user: Dict = Depends(get_current_user)):
    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not full or not full.get("password_hash"):
        raise HTTPException(400, "Password change unavailable for this account (Google sign-in)")
    if not verify_password(req.current_password, full["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"password_hash": hash_password(req.new_password)}})
    await log_activity("password_change", user["email"])
    return {"ok": True}

# ============ Activity log ============
async def log_activity(action: str, email: str, meta: Dict = None):
    await db.activity_log.insert_one({
        "action": action, "email": email, "meta": meta or {},
        "created_at": datetime.now(timezone.utc)
    })

# ============ Jobs ============
async def _cap_jobs():
    total = await db.jobs.count_documents({})
    if total > 500:
        excess = total - 500
        oldest = await db.jobs.find().sort("posted_at", 1).limit(excess).to_list(excess)
        ids = [o["_id"] for o in oldest]
        await db.jobs.delete_many({"_id": {"$in": ids}})

async def seed_jobs():
    if not ALLOW_MOCK_JOBS:
        return
    count = await db.jobs.count_documents({})
    if count < 120:
        for company in COMPANIES:
            for _ in range(random.randint(2, 4)):
                await db.jobs.insert_one(_gen_job(company))
        await _cap_jobs()

@api.get("/jobs")
async def list_jobs(page: int = 1, limit: int = 15, q: str = "", location: str = "", experience: str = ""):
    filt = {}
    if q:
        filt["$or"] = [{"company": {"$regex": q, "$options": "i"}}, {"role": {"$regex": q, "$options": "i"}}]
    if location:
        filt["location"] = {"$regex": location, "$options": "i"}
    if experience:
        filt["experience"] = {"$regex": experience, "$options": "i"}
    total = await db.jobs.count_documents(filt)
    skip = (page - 1) * limit
    docs = await db.jobs.find(filt, {"salary": 0}).sort("posted_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"jobs": [serialize_doc(d) for d in docs], "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api.get("/jobs/recent")
async def recent_jobs(limit: int = 10):
    docs = await db.jobs.find({}, {"salary": 0}).sort("posted_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(d) for d in docs]

@api.get("/jobs/{job_id}")
async def get_job(job_id: str):
    doc = await db.jobs.find_one({"_id": ObjectId(job_id)}, {"salary": 0})
    if not doc: raise HTTPException(404, "Job not found")
    return serialize_doc(doc)

@api.post("/jobs/{job_id}/apply")
async def apply_job(job_id: str, user: Dict = Depends(get_current_user)):
    if not user.get("verified"):
        raise HTTPException(403, "Please verify your email before applying. Check your inbox or resend the verification link.")
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job: raise HTTPException(404, "Job not found")
    privileged = is_privileged(user["email"]) or user.get("role") == "admin"
    has_sub = _has_active_subscription(user)
    # Deduplicate: check existing application
    existing = await db.applications.find_one({"user_id": user["id"], "company": job["company"], "role": job["role"]})
    if existing:
        return {"ok": True, "already": True, "applications_used": user.get("applications_used", 0)}
    # Check limits
    if not privileged and not has_sub and user.get("applications_used", 0) >= 10:
        raise HTTPException(402, "You have crossed the limit of free usage, Please subscribe to continue the services")
    await db.applications.insert_one({
        "user_id": user["id"], "user_email": user["email"], "job_id": job_id,
        "company": job["company"], "role": job["role"], "logo": job.get("logo"),
        "applied_at": datetime.now(timezone.utc)
    })
    if not privileged and not has_sub:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$inc": {"applications_used": 1}})
    return {"ok": True, "already": False}

@api.get("/jobs/mine/applications")
async def my_applications(user: Dict = Depends(get_current_user)):
    docs = await db.applications.find({"user_id": user["id"]}).sort("applied_at", -1).to_list(500)
    return [serialize_doc(d) for d in docs]

@api.get("/jobs/{job_id}/referrer-available")
async def referrer_available(job_id: str):
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job: raise HTTPException(404, "Job not found")
    count = await db.users.count_documents({
        "is_employee": True, "employee_verified": True, "employee_company": job["company"]
    })
    return {"available": count > 0, "count": count, "company": job["company"]}

# ============ Referrals ============
@api.post("/referrals")
async def submit_referral(req: ReferralSubmitReq, user: Dict = Depends(get_current_user)):
    if not user.get("verified"):
        raise HTTPException(403, "Please verify your email before requesting a referral.")
    if not (_has_active_subscription(user) or is_privileged(user["email"])):
        raise HTTPException(402, "Subscription required for referrals")
    job = await db.jobs.find_one({"_id": ObjectId(req.job_id)})
    if not job: raise HTTPException(404, "Job not found")
    doc = {
        "user_id": user["id"], "user_email": user["email"],
        "job_id": req.job_id, "company": job["company"], "role": job["role"],
        "first_name": req.first_name, "last_name": req.last_name,
        "email": req.email, "address": req.address, "message": req.message,
        "resume_url": req.resume_url, "status": "pending", "proofs": [],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.referrals.insert_one(doc)
    return {"ok": True, "id": str(res.inserted_id)}

@api.get("/referrals/mine")
async def my_referrals(user: Dict = Depends(get_current_user)):
    docs = await db.referrals.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [serialize_doc(d) for d in docs]

@api.post("/referrals/{ref_id}/proof")
async def upload_proof(ref_id: str, req: ProofUploadReq, user: Dict = Depends(get_current_user)):
    r = await db.referrals.find_one({"_id": ObjectId(ref_id), "user_id": user["id"]})
    if not r: raise HTTPException(404, "Referral not found")
    await db.referrals.update_one({"_id": ObjectId(ref_id)},
        {"$push": {"proofs": {"type": req.proof_type, "url": req.proof_url,
            "verified": False, "uploaded_at": datetime.now(timezone.utc)}}})
    return {"ok": True}

# ============ Leaderboard ============
@api.get("/leaderboard/referrers")
async def leaderboard_referrers(limit: int = 10):
    docs = await db.users.find(
        {"is_employee": True, "employee_verified": True},
        {"employee_first_name": 1, "employee_last_name": 1, "name": 1, "email": 1,
         "employee_company": 1, "avatar": 1,
         "employee_referrals_count": 1, "employee_interview_count": 1, "employee_offer_count": 1,
         "employee_total_earned": 1}
    ).to_list(500)
    for d in docs:
        d["_score"] = d.get("employee_total_earned", 0) * 100 + d.get("employee_referrals_count", 0) + d.get("employee_interview_count", 0) * 3 + d.get("employee_offer_count", 0) * 10
        d["company_logo"] = next((logo(c["domain"]) for c in COMPANIES if c["name"] == d.get("employee_company")), "")
    docs.sort(key=lambda x: -x["_score"])
    return [serialize_doc({**d, "_id": d["_id"]}) for d in docs[:limit]]

# ============ Employees ============
@api.post("/employees/register")
async def register_employee(req: EmployeeRegisterReq, user: Dict = Depends(get_current_user)):
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {
        "is_employee": True, "employee_verified": False,
        "employee_first_name": req.first_name, "employee_last_name": req.last_name,
        "employee_dob": req.dob, "employee_address": req.address,
        "employee_company": req.company, "employee_govt_id": req.govt_id,
        "employee_company_id": req.company_id, "employee_bank": req.bank_account,
        "employee_ifsc": req.ifsc, "employee_branch": req.branch,
        "employee_upi": req.upi, "employee_resume": req.resume_url,
        "employee_earnings": 0, "employee_total_earned": 0,
        "employee_referrals_count": 0, "employee_interview_count": 0,
        "employee_offer_count": 0,
        "employee_submitted_at": datetime.now(timezone.utc),
    }})
    return {"ok": True}

@api.get("/employees/referrals")
async def employee_referrals(user: Dict = Depends(get_current_user)):
    if not (user.get("is_employee") and user.get("employee_verified")):
        raise HTTPException(403, "Not a verified employee")
    company = user.get("employee_company")
    docs = await db.referrals.find({"company": company}).sort("created_at", -1).to_list(500)
    return [serialize_doc(d) for d in docs]

@api.get("/employees/earnings")
async def get_earnings(user: Dict = Depends(get_current_user)):
    if not user.get("is_employee"): raise HTTPException(403, "Not an employee")
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return {
        "current_earnings": u.get("employee_earnings", 0),
        "total_earned": u.get("employee_total_earned", 0),
        "referrals_count": u.get("employee_referrals_count", 0),
        "interview_count": u.get("employee_interview_count", 0),
        "offer_count": u.get("employee_offer_count", 0),
        "verified": u.get("employee_verified", False),
    }

@api.post("/employees/withdraw")
async def withdraw(req: WithdrawReq, user: Dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    earn = u.get("employee_earnings", 0)
    if req.amount < 10: raise HTTPException(400, "Minimum withdrawal is $10")
    if req.amount > earn: raise HTTPException(400, "Insufficient earnings")
    await db.withdrawals.insert_one({
        "user_id": user["id"], "email": user["email"], "amount": req.amount,
        "status": "pending", "created_at": datetime.now(timezone.utc)
    })
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"employee_earnings": 0}})
    return {"ok": True}

# ============ Subscriptions ============
# PLANS imported from data.py

def _has_active_subscription(user: Dict, kind: str = "job") -> bool:
    sub = user.get("subscription") if kind == "job" else user.get("ai_subscription")
    if not sub: return False
    exp = sub.get("expires_at")
    if not exp: return False
    if isinstance(exp, str):
        try: exp = datetime.fromisoformat(exp)
        except Exception: return False
    if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
    return exp > datetime.now(timezone.utc)

@api.get("/subscription/plans")
async def get_plans(kind: str = "job"):
    return [{"lookup_key": k, "amount": v["amount"], "currency": v["currency"],
             "name": v["name"], "months": v["interval_months"], "kind": v["kind"]}
            for k, v in PLANS.items() if v["kind"] == kind]

@api.post("/payments/checkout")
async def create_checkout(req: CheckoutReq, user: Dict = Depends(get_current_user)):
    if req.lookup_key not in PLANS: raise HTTPException(400, "Invalid plan")
    plan = PLANS[req.lookup_key]
    session = stripe.checkout.Session.create(
        line_items=[{
            "price_data": {
                "currency": plan["currency"], "unit_amount": plan["amount"],
                "product_data": {"name": f"BlinkedIn {plan['name']}"},
            }, "quantity": 1,
        }],
        mode="payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata={"user_id": user["id"], "lookup_key": req.lookup_key, "kind": plan["kind"]},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["id"], "email": user["email"],
        "lookup_key": req.lookup_key, "amount": plan["amount"], "currency": plan["currency"],
        "kind": plan["kind"], "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    })
    return {"checkout_url": session.url, "session_id": session.id}

@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id})
    if not rec: raise HTTPException(404, "Transaction not found")
    if rec.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, rec)
                rec = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError: pass
    return {"session_id": rec["session_id"], "status": rec["status"], "payment_status": rec["payment_status"], "kind": rec.get("kind", "job")}

async def _mark_paid(session_id: str, rec: Dict):
    plan = PLANS.get(rec["lookup_key"])
    if not plan: return
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=30 * plan["interval_months"])
    result = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now}}
    )
    if not result.modified_count: return
    sub_field = "ai_subscription" if plan["kind"] == "ai" else "subscription"
    update = {"$set": {sub_field: {
        "plan": rec["lookup_key"], "amount": rec["amount"],
        "started_at": now.isoformat(), "expires_at": exp.isoformat(),
        "session_id": session_id,
    }}}
    # Generate API key for AI subscription
    if plan["kind"] == "ai":
        api_key = f"bli_{secrets.token_urlsafe(32)}"
        update["$set"]["ai_subscription"]["api_key"] = api_key
    await db.users.update_one({"_id": ObjectId(rec["user_id"])}, update)
    # Receipt email
    u = await db.users.find_one({"_id": ObjectId(rec["user_id"])})
    if u:
        asyncio.create_task(send_email(u["email"], f"Payment received · {plan['name']}",
            _brand_email(f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>You're all set!</h2>"
                         f"<p>Your subscription <strong>{plan['name']}</strong> is now active until <strong>{exp.strftime('%d %b %Y')}</strong>.</p>"
                         f"<p>Amount paid: ₹{rec['amount']/100:.2f}</p>"
                         + (f"<p style='background:#f0edff;padding:12px;border-radius:8px;'><strong>API key:</strong> <code style='word-break:break-all;'>{update['$set']['ai_subscription']['api_key']}</code></p>" if plan["kind"] == "ai" else "")
                         + f"<p><a href='{FRONTEND_URL}/profile' style='display:inline-block;background:#5B4FFF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;'>Go to profile</a></p>")))

@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        return {"status": "ignored"}
    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed":
        rec = await db.payment_transactions.find_one({"session_id": obj["id"]})
        if rec: await _mark_paid(obj["id"], rec)
    return {"status": "ok"}

# ============ Contact ============
@api.post("/contact")
async def contact(req: ContactReq):
    await db.contact_messages.insert_one({
        **req.model_dump(), "status": "new", "created_at": datetime.now(timezone.utc)
    })
    # Fire-and-forget confirmation email
    asyncio.create_task(send_email(req.email, "We received your message · BlinkedIn",
        _brand_email(f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>Thanks for reaching out, {req.name}!</h2>"
                     f"<p>We've received your message and will be reaching out within <strong>5 working days</strong>.</p>"
                     f"<p style='background:#f6f7f9;padding:14px;border-radius:8px;font-size:13px;'><strong>Your message:</strong><br/>{req.subject}<br/><br/><em>{req.message}</em></p>"
                     f"<p>In the meantime, feel free to browse fresh roles or explore our AI Agents API.</p>"
                     f"<p><a href='{FRONTEND_URL}' style='display:inline-block;background:#5B4FFF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;'>Back to BlinkedIn</a></p>")))
    # Notify support
    asyncio.create_task(send_email(SUPPORT_EMAIL, f"[New feedback] {req.subject}",
        _brand_email(f"<h3>New contact form submission</h3>"
                     f"<p><strong>From:</strong> {req.name} &lt;{req.email}&gt;<br/>"
                     f"<strong>Subject:</strong> {req.subject}</p>"
                     f"<p>{req.message}</p>")))
    return {"ok": True, "message": "Thanks! We'll reach out within 5 working days."}

# ============ Cookies ============
@api.post("/cookies/consent")
async def cookie_consent(req: ConsentReq, response: Response):
    response.set_cookie("cookie_consent", "1" if req.accepted else "0",
                        max_age=60*60*24*365, path="/", samesite="lax")
    return {"ok": True}

# ============ AI Agents ============
_anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None

# Heuristic markers that suggest a plain HTTP GET actually returned job content
# rather than an empty JS-shell (React/Angular SPA career pages, e.g. Google Careers).
_JOB_PAGE_MARKERS = ("job", "career", "role", "position", "hiring", "apply")

async def _fetch_career_page_html(url: str) -> str:
    """Fetch a career page's content, working for BOTH static HTML and JS-rendered
    SPA career sites (Google, Meta, Workday-based portals, etc).

    Strategy: try a plain HTTP GET first (cheap, fast). If the response is too thin
    or doesn't look like it contains real listing text, fall back to a headless
    browser render via Playwright, which executes the page's JS the same way a
    real visitor's browser would — this is what lets the agent work on ANY URL,
    not just static pages.
    """
    html_body = ""
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0 BlinkedIn AI Agent"})
            if r.status_code == 200:
                html_body = r.text
    except Exception as e:
        logger.warning(f"Plain fetch failed for {url}: {e}")

    looks_thin = len(html_body) < 3000
    looks_job_free = not any(m in html_body.lower() for m in _JOB_PAGE_MARKERS)
    if not (looks_thin or looks_job_free):
        return html_body

    # Fall back to a real headless browser so client-rendered job boards work too.
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(user_agent="Mozilla/5.0 BlinkedIn AI Agent")
            await page.goto(url, timeout=30000, wait_until="networkidle")
            # give client-side rendering (React/Vue/Workday etc.) a moment to paint jobs
            await page.wait_for_timeout(2000)
            rendered = await page.content()
            await browser.close()
            if len(rendered) > len(html_body):
                return rendered
    except ImportError:
        logger.warning(
            "Playwright not installed — JS-rendered career pages (e.g. Google Careers) "
            "may return empty results. Run: pip install playwright && playwright install --with-deps chromium"
        )
    except Exception as e:
        logger.warning(f"Playwright render failed for {url}: {e}")

    return html_body


def _parse_posted_date(value) -> Optional[datetime]:
    """Best-effort parse of whatever the model returned for posted_date into a UTC datetime."""
    if not value or not isinstance(value, str):
        return None
    v = value.strip().lower()
    now = datetime.now(timezone.utc)
    try:
        if v in ("today",):
            return now
        if v in ("yesterday",):
            return now - timedelta(days=1)
        m = re.match(r"(\d+)\s*day", v)
        if m:
            return now - timedelta(days=int(m.group(1)))
        # try ISO date
        return datetime.fromisoformat(value.strip()[:10]).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _filter_and_sort_jobs(jobs_data: List[Dict], location_filter: Optional[str] = None,
                           recent_only: bool = True, recent_days: int = 3) -> List[Dict]:
    """Apply the location + recency logic the agent is supposed to enforce, then sort
    newest-first. Jobs with no parseable date are kept (many sites simply don't show one)
    but sorted after ones with a known-recent date."""
    now = datetime.now(timezone.utc)
    out = []
    for j in jobs_data:
        loc = (j.get("location") or "").lower()
        if location_filter:
            lf = location_filter.strip().lower()
            if lf and lf not in loc and not (lf == "remote" and "remote" in loc):
                continue
        parsed = _parse_posted_date(j.get("posted_date"))
        if recent_only and parsed is not None and (now - parsed).days > recent_days:
            continue  # explicitly old posting — drop it
        j["_parsed_posted_at"] = parsed or now  # unknown-date jobs still surface, sorted last
        out.append(j)
    out.sort(key=lambda j: j["_parsed_posted_at"], reverse=True)
    return out


async def _ai_extract_jobs(html_content: str, company_name: str, custom_prompt: Optional[str] = None) -> List[Dict]:
    """Use Claude to extract jobs from raw HTML. Optional custom system prompt per agent.
    Talks to the Anthropic API directly — no third-party proxy in the loop."""
    if not _anthropic_client:
        logger.error("ANTHROPIC_API_KEY not set — cannot run AI extraction. Add it to backend/.env")
        return []
    try:
        import json as _json
        snippet = html_content[:40000]
        system_message = custom_prompt or DEFAULT_AGENT_PROMPT
        response = await _anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=3000,
            system=system_message,
            messages=[{"role": "user", "content": f"Company: {company_name}\n\nHTML:\n{snippet}"}],
        )
        text = "".join(block.text for block in response.content if block.type == "text").strip()
        start = text.find("[")
        end = text.rfind("]")
        if start >= 0 and end > start:
            data = _json.loads(text[start:end+1])
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"AI extract failed for {company_name}: {e}")
    return []

@api.post("/admin/job-urls/{uid}/ai-scrape")
async def ai_scrape(uid: str, admin: Dict = Depends(get_admin)):
    ju = await db.job_urls.find_one({"_id": ObjectId(uid)})
    if not ju: raise HTTPException(404, "URL not found")
    added = 0
    jobs_data = []
    try:
        html_body = await _fetch_career_page_html(ju["url"])
        raw = await _ai_extract_jobs(html_body, ju["company"]) if html_body else []
        jobs_data = _filter_and_sort_jobs(raw, ju.get("location_filter"), ju.get("recent_only", True))
        for j in jobs_data[:10]:
            role = j.get("role", "Software Engineer")
            if await db.jobs.find_one({"company": ju["company"], "role": role}):
                continue
            await db.jobs.insert_one({
                "company": ju["company"], "logo": ju["logo"],
                "role": role,
                "experience": j.get("experience", "3-5 yrs"),
                "location": j.get("location", "Remote"),
                "type": "Full-time",
                "description": j.get("description", "Join our team."),
                "requirements": ["Strong skills", "Team player"],
                "apply_url": j.get("apply_url") or ju["url"],
                "posted_at": j["_parsed_posted_at"],
            })
            added += 1
    except Exception as e:
        logger.error(f"AI scrape failed: {e}")
    # Fallback: only fabricate demo jobs if explicitly opted into mock mode
    if added == 0 and ALLOW_MOCK_JOBS:
        for _ in range(random.randint(1, 3)):
            await db.jobs.insert_one(_gen_job({"name": ju["company"], "domain": ju["logo"].split("/")[-1] if ju["logo"] else "example.com", "url": ju["url"]}))
            added += 1
    await db.job_urls.update_one({"_id": ObjectId(uid)}, {"$set": {"last_fetched": datetime.now(timezone.utc), "last_added": added}})
    await _cap_jobs()
    return {"ok": True, "added": added, "mode": "ai" if jobs_data else "fallback"}

# ============ Admin ============
@api.get("/admin/stats")
async def admin_stats(admin: Dict = Depends(get_admin)):
    users = await db.users.count_documents({})
    jobs = await db.jobs.count_documents({})
    apps = await db.applications.count_documents({})
    subs = await db.users.count_documents({"subscription": {"$ne": None}})
    ai_subs = await db.users.count_documents({"ai_subscription": {"$ne": None}})
    revenue = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    referrals = await db.referrals.count_documents({})
    pending_emp = await db.users.count_documents({"is_employee": True, "employee_verified": False})
    pending_wd = await db.withdrawals.count_documents({"status": "pending"})
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    active_24h = len(await db.sessions.distinct("user_id", {"created_at": {"$gte": since}}))
    return {
        "users": users, "jobs": jobs, "applications": apps, "subscribers": subs,
        "ai_subscribers": ai_subs,
        "revenue": (revenue[0]["total"] if revenue else 0) / 100,
        "referrals": referrals, "pending_employees": pending_emp,
        "pending_withdrawals": pending_wd, "active_users_24h": active_24h,
    }

@api.get("/admin/logins")
async def admin_logins(admin: Dict = Depends(get_admin)):
    docs = await db.sessions.find().sort("created_at", -1).limit(100).to_list(100)
    return [serialize_doc(d) for d in docs]

@api.get("/admin/employees")
async def admin_employees(admin: Dict = Depends(get_admin)):
    docs = await db.users.find({"is_employee": True}).to_list(500)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/employees/{uid}/verify")
async def admin_verify_employee(uid: str, admin: Dict = Depends(get_admin)):
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"employee_verified": True}})
    return {"ok": True}

@api.post("/admin/employees/{uid}/reject")
async def admin_reject_employee(uid: str, admin: Dict = Depends(get_admin)):
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"is_employee": False, "employee_verified": False}})
    return {"ok": True}

@api.get("/admin/referrals")
async def admin_referrals(admin: Dict = Depends(get_admin)):
    docs = await db.referrals.find().sort("created_at", -1).limit(500).to_list(500)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/referrals/{ref_id}/verify-proof")
async def verify_proof(ref_id: str, proof_type: str, admin: Dict = Depends(get_admin)):
    r = await db.referrals.find_one({"_id": ObjectId(ref_id)})
    if not r: raise HTTPException(404, "Referral not found")
    emp = await db.users.find_one({"employee_company": r["company"], "employee_verified": True})
    if not emp: raise HTTPException(400, "No verified employee for this company")
    await db.referrals.update_one({"_id": ObjectId(ref_id), "proofs.type": proof_type},
        {"$set": {"proofs.$.verified": True}})
    inc = {}
    if proof_type == "referred": inc["employee_referrals_count"] = 1
    elif proof_type == "interview": inc["employee_interview_count"] = 1
    elif proof_type == "offer": inc["employee_offer_count"] = 1
    if inc: await db.users.update_one({"_id": emp["_id"]}, {"$inc": inc})
    updated = await db.users.find_one({"_id": emp["_id"]})
    r_count = updated.get("employee_referrals_count", 0)
    i_count = updated.get("employee_interview_count", 0)
    o_count = updated.get("employee_offer_count", 0)
    total_target = (r_count // 50) * 10 + (i_count // 20) * 10 + (o_count // 2) * 10
    total_current = updated.get("employee_total_earned", 0)
    diff = total_target - total_current
    if diff > 0:
        await db.users.update_one({"_id": emp["_id"]},
            {"$inc": {"employee_earnings": diff, "employee_total_earned": diff}})
    return {"ok": True, "reward_added": max(diff, 0)}

@api.get("/admin/withdrawals")
async def admin_withdrawals(admin: Dict = Depends(get_admin)):
    docs = await db.withdrawals.find().sort("created_at", -1).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/withdrawals/{wid}/approve")
async def approve_withdrawal(wid: str, admin: Dict = Depends(get_admin)):
    w = await db.withdrawals.find_one({"_id": ObjectId(wid)})
    if not w: raise HTTPException(404, "Not found")
    await db.withdrawals.update_one({"_id": ObjectId(wid)},
        {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc)}})
    asyncio.create_task(send_email(w["email"], "Your withdrawal has been approved 💸",
        _brand_email(f"<h2 style='margin:0 0 12px;color:#5B4FFF;'>Withdrawal approved</h2>"
                     f"<p>Your withdrawal of <strong>${w['amount']}</strong> has been approved and will be transferred to your registered UPI/bank shortly.</p>"
                     f"<p>Thanks for referring great talent!</p>")))
    return {"ok": True}

@api.get("/admin/payments")
async def admin_payments(admin: Dict = Depends(get_admin)):
    docs = await db.payment_transactions.find().sort("created_at", -1).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]

@api.get("/admin/contact")
async def admin_contact(admin: Dict = Depends(get_admin)):
    docs = await db.contact_messages.find().sort("created_at", -1).limit(200).to_list(200)
    return [serialize_doc(d) for d in docs]

@api.get("/admin/job-urls")
async def admin_job_urls(admin: Dict = Depends(get_admin)):
    docs = await db.job_urls.find().sort("created_at", -1).to_list(200)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/job-urls")
async def add_job_url(req: JobUrlReq, admin: Dict = Depends(get_admin)):
    # Auto-fetch logo if not provided
    dom = req.company.lower().replace(" ", "").replace(".", "")
    doc = {"company": req.company, "url": req.url,
           "logo": req.logo or f"https://logo.clearbit.com/{dom}.com",
           "location_filter": req.location_filter or "",
           "recent_only": req.recent_only,
           "active": True, "last_fetched": None,
           "created_at": datetime.now(timezone.utc)}
    res = await db.job_urls.insert_one(doc)
    doc["_id"] = res.inserted_id
    # Auto-create AI agent for this URL
    await _ensure_agent(doc)
    return serialize_doc(doc)

@api.post("/admin/job-urls/{uid}/fetch")
async def fetch_url(uid: str, admin: Dict = Depends(get_admin)):
    """Fetch the career page and AI-extract real postings. (Previously a pure mock —
    now does the same real work as /ai-scrape; kept as a separate route so the
    existing admin UI's two buttons both work.)"""
    ju = await db.job_urls.find_one({"_id": ObjectId(uid)})
    if not ju: raise HTTPException(404, "URL not found")
    added = 0
    jobs_data = []
    try:
        html_body = await _fetch_career_page_html(ju["url"])
        raw = await _ai_extract_jobs(html_body, ju["company"]) if html_body else []
        jobs_data = _filter_and_sort_jobs(raw, ju.get("location_filter"), ju.get("recent_only", True))
        for j in jobs_data[:10]:
            role = j.get("role", "Software Engineer")
            if await db.jobs.find_one({"company": ju["company"], "role": role}):
                continue
            await db.jobs.insert_one({
                "company": ju["company"], "logo": ju["logo"],
                "role": role,
                "experience": j.get("experience", "3-5 yrs"),
                "location": j.get("location", "Remote"),
                "type": "Full-time",
                "description": j.get("description", "Join our team."),
                "requirements": ["Strong skills", "Team player"],
                "apply_url": j.get("apply_url") or ju["url"],
                "posted_at": j["_parsed_posted_at"],
            })
            added += 1
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
    if added == 0 and ALLOW_MOCK_JOBS:
        for _ in range(random.randint(1, 3)):
            await db.jobs.insert_one(_gen_job({"name": ju["company"], "domain": ju["logo"].split("/")[-1] if ju["logo"] else "example.com", "url": ju["url"]}))
            added += 1
    await db.job_urls.update_one({"_id": ObjectId(uid)}, {"$set": {"last_fetched": datetime.now(timezone.utc), "last_added": added}})
    await _cap_jobs()
    return {"ok": True, "added": added, "mode": "ai" if jobs_data else "none"}

# ============ Public info ============
@api.get("/companies")
async def list_companies():
    return [{"name": c["name"], "logo": logo(c["domain"]), "url": c["url"]} for c in COMPANIES]

# ============ Logo proxy (with fallback) ============
@api.get("/logo/{domain}")
async def get_logo(domain: str):
    """Proxy logo requests through backend so we can fall back if Clearbit is unreachable."""
    from fastapi.responses import Response, RedirectResponse
    domain = domain.strip().lower()
    sources = [
        f"https://logo.clearbit.com/{domain}",
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
    ]
    for url in sources:
        try:
            async with httpx.AsyncClient(timeout=4, follow_redirects=True) as c:
                r = await c.get(url)
                if r.status_code == 200 and len(r.content) > 200:
                    return Response(content=r.content, media_type=r.headers.get("content-type", "image/png"),
                                    headers={"Cache-Control": "public, max-age=86400"})
        except Exception:
            continue
    return Response(status_code=404)

# ============ AI Agents system ============
# Each agent = one company URL that we periodically re-scrape.
# DEFAULT_AGENT_PROMPT imported from data.py
AGENT_INTERVAL_SECONDS = int(os.environ.get("AGENT_INTERVAL_SECONDS", "300"))  # default: re-check each company every 5 min
AGENT_SCHEDULER_TICK_SECONDS = int(os.environ.get("AGENT_SCHEDULER_TICK_SECONDS", "30"))  # how often the scheduler loop wakes up
AGENT_BATCH_SIZE = int(os.environ.get("AGENT_BATCH_SIZE", "5"))  # how many due agents run per tick

async def _ensure_agent(job_url_doc: Dict):
    existing = await db.agents.find_one({"job_url_id": str(job_url_doc["_id"])})
    if existing:
        return existing
    doc = {
        "job_url_id": str(job_url_doc["_id"]),
        "company": job_url_doc["company"],
        "url": job_url_doc["url"],
        "logo": job_url_doc.get("logo"),
        "location_filter": job_url_doc.get("location_filter") or "",
        "recent_only": job_url_doc.get("recent_only", True),
        "status": "running",
        "created_at": datetime.now(timezone.utc),
        "last_run_at": None,
        "next_run_at": datetime.now(timezone.utc),
        "last_added": 0,
        "total_jobs_found": 0,
        "run_count": 0,
        "error_count": 0,
        "last_error": None,
        "health": "healthy",
        "system_prompt": DEFAULT_AGENT_PROMPT,
        "training_notes": "",
    }
    res = await db.agents.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc

async def _run_agent_once(agent: Dict) -> int:
    """Run one agent iteration — fetch URL, AI-extract jobs, insert new ones. Returns count added."""
    added = 0
    error = None
    jobs_data = []
    try:
        html_body = await _fetch_career_page_html(agent["url"])
        raw = await _ai_extract_jobs(html_body, agent["company"], agent.get("system_prompt")) if html_body else []
        jobs_data = _filter_and_sort_jobs(raw, agent.get("location_filter"), agent.get("recent_only", True))
    except Exception as e:
        error = str(e)[:200]
    for j in jobs_data[:10]:
        role = j.get("role", "Software Engineer")
        # Skip if very similar job already exists (dedup by company + role)
        if await db.jobs.find_one({"company": agent["company"], "role": role}):
            continue
        await db.jobs.insert_one({
            "company": agent["company"],
            "logo": agent.get("logo"),
            "role": role,
            "experience": j.get("experience", "3-5 yrs"),
            "location": j.get("location", "Remote"),
            "type": "Full-time",
            "description": j.get("description", "Join our team."),
            "requirements": ["Strong skills", "Team player"],
            "apply_url": j.get("apply_url") or agent["url"],
            "posted_at": j["_parsed_posted_at"],
            "agent_id": str(agent["_id"]),
        })
        added += 1
    # Fallback: only fabricate demo jobs if explicitly opted into mock mode.
    # With a real ANTHROPIC_API_KEY and a real career-page URL, added==0 usually just
    # means "nothing new since last run" — that's expected steady-state, not a failure.
    if added == 0 and not error and ALLOW_MOCK_JOBS:
        for _ in range(random.randint(0, 2)):
            await db.jobs.insert_one({
                **_gen_job({"name": agent["company"], "domain": (agent.get("logo", "").split("/")[-1] or "example.com"), "url": agent["url"]}),
                "agent_id": str(agent["_id"]),
            })
            added += 1
    # Update agent record
    now = datetime.now(timezone.utc)
    update = {
        "last_run_at": now,
        "next_run_at": now + timedelta(seconds=AGENT_INTERVAL_SECONDS),
        "last_added": added,
        "run_count": agent.get("run_count", 0) + 1,
    }
    if error:
        update["error_count"] = agent.get("error_count", 0) + 1
        update["last_error"] = error
        update["health"] = "degraded" if agent.get("error_count", 0) < 3 else "error"
    else:
        update["health"] = "healthy"
        update["last_error"] = None
    await db.agents.update_one({"_id": agent["_id"]}, {
        "$set": update,
        "$inc": {"total_jobs_found": added},
    })
    await _cap_jobs()
    return added

async def _agent_scheduler():
    """Background loop that runs due agents every ~AGENT_SCHEDULER_TICK_SECONDS.
    This is what keeps agents 'active' — it must run inside a long-lived process.
    (This is exactly why the backend can't be deployed as Netlify serverless functions —
    see the deployment notes in README_SELF_HOSTED.md.)"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            due = await db.agents.find({
                "status": "running",
                "next_run_at": {"$lte": now},
            }).limit(AGENT_BATCH_SIZE).to_list(AGENT_BATCH_SIZE)
            for agent in due:
                try:
                    added = await _run_agent_once(agent)
                    if added:
                        logger.info(f"Agent {agent.get('company')}: +{added} new job(s)")
                except Exception as e:
                    logger.error(f"Agent {agent.get('company')} failed: {e}")
        except Exception as e:
            logger.error(f"Scheduler tick failed: {e}")
        await asyncio.sleep(AGENT_SCHEDULER_TICK_SECONDS)

# Agent admin endpoints
@api.get("/admin/agents")
async def admin_agents(admin: Dict = Depends(get_admin)):
    docs = await db.agents.find().sort("created_at", -1).to_list(500)
    return [serialize_doc(d) for d in docs]

@api.post("/admin/agents/{aid}/pause")
async def admin_pause_agent(aid: str, admin: Dict = Depends(get_admin)):
    await db.agents.update_one({"_id": ObjectId(aid)}, {"$set": {"status": "paused"}})
    return {"ok": True}

@api.post("/admin/agents/{aid}/start")
async def admin_start_agent(aid: str, admin: Dict = Depends(get_admin)):
    await db.agents.update_one({"_id": ObjectId(aid)}, {"$set": {"status": "running", "next_run_at": datetime.now(timezone.utc)}})
    return {"ok": True}

@api.post("/admin/agents/{aid}/run-now")
async def admin_run_agent(aid: str, admin: Dict = Depends(get_admin)):
    agent = await db.agents.find_one({"_id": ObjectId(aid)})
    if not agent: raise HTTPException(404, "Agent not found")
    added = await _run_agent_once(agent)
    return {"ok": True, "added": added}

@api.delete("/admin/agents/{aid}")
async def admin_delete_agent(aid: str, purge_jobs: bool = False, admin: Dict = Depends(get_admin)):
    """Delete an agent. If purge_jobs=true, also remove jobs previously created by this agent."""
    agent = await db.agents.find_one({"_id": ObjectId(aid)})
    if not agent: raise HTTPException(404, "Agent not found")
    # Delete companion job_url record
    if agent.get("job_url_id"):
        try:
            await db.job_urls.delete_one({"_id": ObjectId(agent["job_url_id"])})
        except Exception:
            pass
    deleted_jobs = 0
    if purge_jobs:
        r = await db.jobs.delete_many({"agent_id": aid})
        deleted_jobs = r.deleted_count
    await db.agents.delete_one({"_id": ObjectId(aid)})
    return {"ok": True, "deleted_jobs": deleted_jobs}

@api.get("/admin/agents/{aid}/jobs")
async def admin_agent_jobs(aid: str, admin: Dict = Depends(get_admin)):
    docs = await db.jobs.find({"agent_id": aid}).sort("posted_at", -1).limit(50).to_list(50)
    return [serialize_doc(d) for d in docs]

class AgentInstructionsReq(BaseModel):
    system_prompt: str
    training_notes: Optional[str] = ""

@api.get("/admin/agents/{aid}")
async def admin_get_agent(aid: str, admin: Dict = Depends(get_admin)):
    a = await db.agents.find_one({"_id": ObjectId(aid)})
    if not a: raise HTTPException(404, "Agent not found")
    return serialize_doc(a)

@api.post("/admin/agents/{aid}/instructions")
async def admin_update_instructions(aid: str, req: AgentInstructionsReq, admin: Dict = Depends(get_admin)):
    await db.agents.update_one({"_id": ObjectId(aid)}, {"$set": {
        "system_prompt": req.system_prompt,
        "training_notes": req.training_notes,
        "instructions_updated_at": datetime.now(timezone.utc),
    }})
    return {"ok": True}

@api.post("/admin/agents/{aid}/test")
async def admin_test_agent(aid: str, admin: Dict = Depends(get_admin)):
    """Dry-run: fetch URL, extract jobs with the current instructions, return preview without saving."""
    a = await db.agents.find_one({"_id": ObjectId(aid)})
    if not a: raise HTTPException(404, "Agent not found")
    error = None
    html_body = ""
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as c:
            r = await c.get(a["url"], headers={"User-Agent": "Mozilla/5.0 BlinkedIn AI Agent"})
            html_body = r.text if r.status_code == 200 else ""
            if r.status_code != 200:
                error = f"HTTP {r.status_code}"
    except Exception as e:
        error = str(e)[:200]
    if not html_body:
        return {"ok": False, "error": error or "Empty response", "jobs": []}
    jobs = await _ai_extract_jobs(html_body, a["company"], a.get("system_prompt"))
    return {"ok": True, "jobs": jobs, "count": len(jobs), "html_size": len(html_body)}

@api.get("/admin/agents/prompt/default")
async def get_default_prompt(admin: Dict = Depends(get_admin)):
    return {"system_prompt": DEFAULT_AGENT_PROMPT}

# ============ Embed API (for API customers) ============
async def _mock_api_enabled() -> bool:
    doc = await db.settings.find_one({"_id": "mock_api"})
    return bool(doc and doc.get("enabled"))

async def get_api_customer(request: Request) -> Dict:
    """Auth for embed API — check API key in header or query."""
    api_key = request.headers.get("Authorization", "").replace("Bearer ", "").strip()
    if not api_key:
        api_key = request.query_params.get("api_key", "").strip()
    if not api_key or not api_key.startswith("bli_"):
        raise HTTPException(401, "Missing or invalid API key")
    # MOCK KEY PATH — bypass subscription check when admin has enabled it
    if api_key == MOCK_API_KEY:
        if not await _mock_api_enabled():
            raise HTTPException(403, "Mock API is currently disabled by admin")
        return {"_id": "mock", "email": "mock@blinkedin.demo", "is_mock": True,
                "ai_subscription": {"api_key": api_key}}
    user = await db.users.find_one({"ai_subscription.api_key": api_key})
    if not user:
        raise HTTPException(401, "API key not recognized")
    # Check expiry
    sub = user.get("ai_subscription", {})
    exp = sub.get("expires_at")
    if exp:
        try:
            exp_dt = datetime.fromisoformat(exp) if isinstance(exp, str) else exp
            if exp_dt.tzinfo is None: exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if exp_dt <= datetime.now(timezone.utc):
                raise HTTPException(402, "Subscription expired")
        except HTTPException: raise
        except Exception: pass
    return user

@api.get("/embed/jobs")
async def embed_jobs(request: Request, page: int = 1, limit: int = 20, q: str = "", location: str = "", company: str = ""):
    customer = await get_api_customer(request)
    filt = {}
    if q: filt["$or"] = [{"company": {"$regex": q, "$options": "i"}}, {"role": {"$regex": q, "$options": "i"}}]
    if location: filt["location"] = {"$regex": location, "$options": "i"}
    if company: filt["company"] = {"$regex": company, "$options": "i"}
    total = await db.jobs.count_documents(filt)
    skip = (page - 1) * min(limit, 50)
    docs = await db.jobs.find(filt).sort("posted_at", -1).skip(skip).limit(min(limit, 50)).to_list(min(limit, 50))
    # Log usage
    await db.api_usage.insert_one({
        "customer_id": str(customer["_id"]), "customer_email": customer["email"],
        "endpoint": "embed_jobs", "count": len(docs),
        "at": datetime.now(timezone.utc),
    })
    return {
        "jobs": [serialize_doc(d) for d in docs],
        "total": total, "page": page, "pages": (total + limit - 1) // limit,
        "powered_by": "BlinkedIn",
        "watermark_url": LOGO_URL,
    }

@api.get("/embed/companies")
async def embed_companies(request: Request):
    await get_api_customer(request)
    return [{"name": c["name"], "logo": logo(c["domain"])} for c in COMPANIES]

# Admin: API customers
@api.get("/admin/api-customers")
async def admin_api_customers(admin: Dict = Depends(get_admin)):
    docs = await db.users.find({"ai_subscription": {"$ne": None}}).to_list(500)
    result = []
    for d in docs:
        sub = d.get("ai_subscription", {})
        # Sum revenue from paid ai transactions
        usage_count = await db.api_usage.count_documents({"customer_id": str(d["_id"])})
        result.append({
            "id": str(d["_id"]),
            "email": d["email"],
            "name": d.get("name"),
            "plan": sub.get("plan"),
            "amount": sub.get("amount", 0),
            "started_at": sub.get("started_at"),
            "expires_at": sub.get("expires_at"),
            "api_key_preview": (sub.get("api_key") or "")[:12] + "...",
            "usage_count": usage_count,
        })
    return result

# ============ Admin: Mock API control ============
@api.get("/admin/mock-api")
async def admin_get_mock_api(admin: Dict = Depends(get_admin)):
    doc = await db.settings.find_one({"_id": "mock_api"}) or {}
    usage = await db.api_usage.count_documents({"customer_email": "mock@blinkedin.demo"})
    return {
        "enabled": bool(doc.get("enabled")),
        "key": MOCK_API_KEY,
        "usage_count": usage,
        "updated_at": doc.get("updated_at"),
        "updated_by": doc.get("updated_by"),
    }

class MockApiToggleReq(BaseModel):
    enabled: bool

@api.post("/admin/mock-api/toggle")
async def admin_toggle_mock_api(req: MockApiToggleReq, admin: Dict = Depends(get_admin)):
    await db.settings.update_one(
        {"_id": "mock_api"},
        {"$set": {"enabled": req.enabled, "updated_at": datetime.now(timezone.utc), "updated_by": admin.get("email")}},
        upsert=True,
    )
    return {"ok": True, "enabled": req.enabled}

@api.get("/admin/mock-api/usage")
async def admin_mock_api_usage(admin: Dict = Depends(get_admin)):
    docs = await db.api_usage.find({"customer_email": "mock@blinkedin.demo"}).sort("at", -1).limit(50).to_list(50)
    return [serialize_doc(d) for d in docs]

# ============ Init ============
app.include_router(api)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index("posted_at")
    await db.applications.create_index([("user_id", 1), ("company", 1), ("role", 1)])
    await db.verification_tokens.create_index("token", unique=True)
    await db.verification_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    # Seeded, always-pre-verified accounts pulled from .env
    seeds = [
        {
            "email": os.environ.get("ADMIN_EMAIL", "admin@blinkedinjobs.co").lower(),
            "password": os.environ.get("ADMIN_PASSWORD", "Admin@123"),
            "name": "Admin", "role": "admin",
        },
        {
            "email": os.environ.get("TESTUSER_EMAIL", "testuser@blinkedinjobs.co").lower(),
            "password": os.environ.get("TESTUSER_PASSWORD", "Test@123"),
            "name": "Test User", "role": "user",
        },
    ]
    for s in seeds:
        existing = await db.users.find_one({"email": s["email"]})
        pw_hash = hash_password(s["password"])
        if not existing:
            await db.users.insert_one({
                "email": s["email"], "name": s["name"], "role": s["role"],
                "password_hash": pw_hash, "verified": True, "provider": "local",
                "applications_used": 0, "subscription": None,
                "is_employee": False, "employee_verified": False,
                "created_at": datetime.now(timezone.utc),
            })
        else:
            update = {"verified": True, "role": s["role"]}
            if not verify_password(s["password"], existing.get("password_hash", "")):
                update["password_hash"] = pw_hash
            await db.users.update_one({"email": s["email"]}, {"$set": update})
    # Seed test referrer (verified employee)
    ref_email = os.environ.get("REFERRER_EMAIL", "referrer@blinkedinjobs.co").lower()
    ref_password = os.environ.get("REFERRER_PASSWORD", "Test@123")
    ref_hash = hash_password(ref_password)
    existing_ref = await db.users.find_one({"email": ref_email})
    if not existing_ref:
        await db.users.insert_one({
            "email": ref_email, "name": "Referrer Test", "role": "user",
            "password_hash": ref_hash, "verified": True, "provider": "local",
            "applications_used": 0, "subscription": None,
            "is_employee": True, "employee_verified": True,
            "employee_company": "Google", "employee_first_name": "Ravi", "employee_last_name": "Kumar",
            "employee_earnings": 40, "employee_total_earned": 80,
            "employee_referrals_count": 210, "employee_interview_count": 42, "employee_offer_count": 6,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        update = {"verified": True, "is_employee": True, "employee_verified": True}
        if not verify_password(ref_password, existing_ref.get("password_hash", "")):
            update["password_hash"] = ref_hash
        await db.users.update_one({"email": ref_email}, {"$set": update})
    # Demo referrers for leaderboard — synthetic data, only seeded in mock/demo mode
    if ALLOW_MOCK_JOBS:
        demo_refs = [
            ("priya@blinkedinjobs.co", "Priya Sharma", "Microsoft", 145, 24, 4),
            ("arjun@blinkedinjobs.co", "Arjun Patel", "Amazon", 98, 18, 3),
            ("sara@blinkedinjobs.co", "Sara Chen", "Meta", 72, 12, 2),
            ("alex@blinkedinjobs.co", "Alex Kumar", "Nvidia", 65, 8, 1),
        ]
        for em, nm, co, rc, ic, oc in demo_refs:
            if not await db.users.find_one({"email": em}):
                total_earned = (rc // 50) * 10 + (ic // 20) * 10 + (oc // 2) * 10
                first, last = nm.split(" ", 1)
                await db.users.insert_one({
                    "email": em, "name": nm, "role": "user",
                    "password_hash": hash_password("Test@123"), "verified": True, "provider": "local",
                    "applications_used": 0, "subscription": None,
                    "is_employee": True, "employee_verified": True,
                    "employee_company": co, "employee_first_name": first, "employee_last_name": last,
                    "employee_earnings": total_earned, "employee_total_earned": total_earned,
                    "employee_referrals_count": rc, "employee_interview_count": ic, "employee_offer_count": oc,
                    "created_at": datetime.now(timezone.utc),
                })
    await seed_jobs()
    # Start background agent scheduler
    asyncio.create_task(_agent_scheduler())
    logger.info("Startup complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()

_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_env and _cors_env != "*":
    _allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
elif _cors_env == "*":
    _allowed_origins = ["*"]
else:
    _allowed_origins = [FRONTEND_URL]
if "http://localhost:3000" not in _allowed_origins and "*" not in _allowed_origins:
    _allowed_origins.append("http://localhost:3000")
logger.info(f"CORS allowed origins: {_allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
