"""BlinkedIn v2 backend regression + new-feature suite."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")


# ---- Auth Regression ----
class TestAuthRegression:
    def test_admin_login(self, admin_session):
        s, data = admin_session
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@blinkedinjobs.co"
        assert "token" in data and len(data["token"]) > 20

    def test_auth_me(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@blinkedinjobs.co"

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@blinkedinjobs.co", "password": "wrong"},
                          timeout=10)
        assert r.status_code == 401


# ---- Register + welcome email ----
class TestRegister:
    def test_register_new_user_triggers_email(self, base_url):
        import uuid
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@blinkedinjobs.co"
        r = requests.post(f"{base_url}/api/auth/register",
                          json={"name": "Reg Test", "email": email, "password": "Test@1234"},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == email.lower()
        # Email log check: give background task a moment
        time.sleep(1.5)
        # Not asserted here; only verified in email_log via direct DB check separately


# ---- Jobs ----
class TestJobs:
    def test_jobs_paginated_no_salary(self, base_url):
        r = requests.get(f"{base_url}/api/jobs?page=1&limit=5", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "jobs" in data and "total" in data and "pages" in data
        assert 0 < len(data["jobs"]) <= 5
        for j in data["jobs"]:
            assert "salary" not in j, f"Salary must not be present: {j.keys()}"

    def test_recent_jobs_no_salary(self, base_url):
        r = requests.get(f"{base_url}/api/jobs/recent?limit=5", timeout=10)
        assert r.status_code == 200
        for j in r.json():
            assert "salary" not in j


# ---- Companies ----
class TestCompanies:
    def test_companies_60plus(self, base_url):
        r = requests.get(f"{base_url}/api/companies", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 60, f"expected 60+ companies, got {len(data)}"
        names = [c["name"] for c in data]
        for expected in ["IBM", "Cognizant", "Nokia", "Target"]:
            assert expected in names
        for c in data:
            assert "name" in c and "logo" in c and "url" in c
            assert c["logo"].startswith("https://")


# ---- Leaderboard ----
class TestLeaderboard:
    def test_leaderboard_referrers(self, base_url):
        r = requests.get(f"{base_url}/api/leaderboard/referrers?limit=10", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"expected 5+ referrers seeded, got {len(data)}"
        first = data[0]
        assert "company_logo" in first
        # Sorted desc by score derived from earnings/refs
        # Filter guarantees only verified employees; verify company + logo populated
        for d in data:
            assert d.get("employee_company")
            assert "company_logo" in d


# ---- Subscriptions ----
class TestSubscriptions:
    def test_ai_plans(self, base_url):
        r = requests.get(f"{base_url}/api/subscription/plans?kind=ai", timeout=10)
        assert r.status_code == 200
        plans = r.json()
        keys = {p["lookup_key"] for p in plans}
        assert keys == {"ai_monthly_1499", "ai_yearly_12999"}
        amounts = {p["lookup_key"]: p["amount"] for p in plans}
        assert amounts["ai_monthly_1499"] == 149900
        assert amounts["ai_yearly_12999"] == 1299900

    def test_job_plans_still_3(self, base_url):
        r = requests.get(f"{base_url}/api/subscription/plans?kind=job", timeout=10)
        assert r.status_code == 200
        plans = r.json()
        assert len(plans) == 3
        keys = {p["lookup_key"] for p in plans}
        assert keys == {"monthly_199", "half_399", "yearly_699"}


# ---- Stripe checkout (AI plan) ----
class TestCheckout:
    def test_ai_checkout_creates_session(self, user_session):
        s, _ = user_session
        r = s.post(f"{BASE_URL}/api/payments/checkout",
                   json={"lookup_key": "ai_monthly_1499", "origin_url": BASE_URL},
                   timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "checkout_url" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com/") or "stripe.com" in data["checkout_url"]
        assert "session_id" in data


# ---- Apply job: dedup + admin bypass ----
class TestApply:
    def test_apply_dedup(self, user_session):
        s, _ = user_session
        r = requests.get(f"{BASE_URL}/api/jobs?page=1&limit=1", timeout=10)
        job_id = r.json()["jobs"][0]["id"]
        # Reset applications_used snapshot via /auth/me before
        me1 = s.get(f"{BASE_URL}/api/auth/me").json()
        used_before = me1.get("applications_used", 0)
        r1 = s.post(f"{BASE_URL}/api/jobs/{job_id}/apply", timeout=10)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        # Could be first-time or already-applied depending on prior tests. In either case, second call must be already:true
        r2 = s.post(f"{BASE_URL}/api/jobs/{job_id}/apply", timeout=10)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already") is True, f"second apply should return already: got {d2}"
        me2 = s.get(f"{BASE_URL}/api/auth/me").json()
        used_after = me2.get("applications_used", 0)
        # Counter increment by at most 1 across the two calls
        assert used_after - used_before <= 1, f"dedup should not double-count: {used_before} -> {used_after}"

    def test_admin_apply_no_limit(self, admin_session):
        s, _ = admin_session
        me_before = s.get(f"{BASE_URL}/api/auth/me").json()
        before = me_before.get("applications_used", 0)
        r = requests.get(f"{BASE_URL}/api/jobs?page=2&limit=5", timeout=10)
        for j in r.json()["jobs"][:3]:
            resp = s.post(f"{BASE_URL}/api/jobs/{j['id']}/apply", timeout=10)
            assert resp.status_code == 200, resp.text
        me = s.get(f"{BASE_URL}/api/auth/me").json()
        after = me.get("applications_used", 0)
        # admin (privileged) must not have counter incremented
        assert after == before, f"privileged admin should not increment: {before} -> {after}"


# ---- My applications ----
class TestMyApplications:
    def test_my_applications_dedup(self, user_session):
        s, _ = user_session
        r = s.get(f"{BASE_URL}/api/jobs/mine/applications", timeout=10)
        assert r.status_code == 200
        apps = r.json()
        assert isinstance(apps, list)
        # NEW dedup: ignore legacy docs missing company/role
        seen = set()
        for a in apps:
            if "company" in a and "role" in a:
                key = (a["company"], a["role"])
                assert key not in seen, f"duplicate application: {key}"
                seen.add(key)


# ---- Contact ----
class TestContact:
    def test_contact_triggers_email(self, base_url):
        payload = {"name": "Tester", "email": "TEST_contact@example.com",
                   "subject": "Hello", "message": "Test message body"}
        r = requests.post(f"{base_url}/api/contact", json=payload, timeout=15)
        assert r.status_code == 200
        assert "5 working days" in r.json().get("message", "")


# ---- Admin stats ----
class TestAdminStats:
    def test_admin_stats_has_ai_subscribers(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/stats", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "ai_subscribers" in data
        assert isinstance(data["ai_subscribers"], int)
        assert "subscribers" in data and "users" in data and "jobs" in data


# ---- AI scrape endpoint (best-effort, must not 500) ----
class TestAiScrape:
    def test_ai_scrape_endpoint(self, admin_session):
        s, _ = admin_session
        # Seed a job url first
        r = s.post(f"{BASE_URL}/api/admin/job-urls",
                   json={"company": "TEST_AI_Company",
                         "url": "https://example.com",
                         "logo": "https://logo.clearbit.com/example.com"},
                   timeout=10)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # Call ai-scrape (may take 5-15s)
        r2 = s.post(f"{BASE_URL}/api/admin/job-urls/{uid}/ai-scrape", timeout=60)
        assert r2.status_code == 200, f"AI scrape failed: {r2.status_code} {r2.text}"
        data = r2.json()
        assert data.get("ok") is True
        assert "added" in data and data["added"] >= 1
        assert data.get("mode") in ("ai", "fallback")
