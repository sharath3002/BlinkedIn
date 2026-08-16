"""
BlinkedIn v5 backend tests — new features from iter-5:
 - Logo proxy (/api/logo/{domain})
 - AI Agents CRUD (/api/admin/agents/*) & auto-create on job_urls POST
 - API Customers listing (/api/admin/api-customers)
 - Embed API auth (/api/embed/jobs)
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")


# --------- Logo proxy ---------
class TestLogoProxy:
    def test_logo_valid_domain_returns_image(self):
        r = requests.get(f"{BASE_URL}/api/logo/google.com", timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "image" in ct or "octet-stream" in ct, f"content-type should be image: {ct}"
        assert len(r.content) > 200

    def test_logo_nonexistent_domain_no_500(self):
        r = requests.get(f"{BASE_URL}/api/logo/nonexistentdomain-xyz-12345.com", timeout=20)
        # 200 (fallback returned bytes) or 404 (all failed) acceptable, MUST NOT be 500
        assert r.status_code in (200, 404), f"must not 500, got {r.status_code}: {r.text[:200]}"


# --------- Agents ---------
class TestAgents:
    def test_admin_agents_list_returns_array(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/agents", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_job_url_auto_creates_agent(self, admin_session):
        s, _ = admin_session
        unique = uuid.uuid4().hex[:6]
        company = f"BlinkedInTest_{unique}"
        payload = {
            "company": company,
            "url": f"https://example.com/careers/{unique}",
            "logo": "https://logo.clearbit.com/example.com",
        }
        rc = s.post(f"{BASE_URL}/api/admin/job-urls", json=payload, timeout=15)
        assert rc.status_code == 200, rc.text
        job_url = rc.json()
        assert "id" in job_url

        # give a beat for insert
        time.sleep(0.5)
        rg = s.get(f"{BASE_URL}/api/admin/agents", timeout=10)
        assert rg.status_code == 200
        agents = rg.json()
        matches = [a for a in agents if a.get("company") == company]
        assert len(matches) >= 1, f"expected an agent auto-created for {company}"
        agent = matches[0]
        assert agent.get("status") in ("running", "paused")
        assert "id" in agent or "_id" in agent
        # save id for follow-up tests via env-like class attr
        TestAgents._agent_id = agent.get("id") or agent.get("_id")
        TestAgents._company = company

    def test_pause_agent(self, admin_session):
        s, _ = admin_session
        aid = getattr(TestAgents, "_agent_id", None)
        if not aid:
            pytest.skip("no agent created yet")
        r = s.post(f"{BASE_URL}/api/admin/agents/{aid}/pause", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # verify status via list
        agents = s.get(f"{BASE_URL}/api/admin/agents", timeout=10).json()
        matched = [a for a in agents if (a.get("id") or a.get("_id")) == aid]
        assert matched and matched[0]["status"] == "paused"

    def test_start_agent(self, admin_session):
        s, _ = admin_session
        aid = getattr(TestAgents, "_agent_id", None)
        if not aid:
            pytest.skip("no agent created yet")
        r = s.post(f"{BASE_URL}/api/admin/agents/{aid}/start", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        agents = s.get(f"{BASE_URL}/api/admin/agents", timeout=10).json()
        matched = [a for a in agents if (a.get("id") or a.get("_id")) == aid]
        assert matched and matched[0]["status"] == "running"

    def test_run_now(self, admin_session):
        s, _ = admin_session
        aid = getattr(TestAgents, "_agent_id", None)
        if not aid:
            pytest.skip("no agent created yet")
        r = s.post(f"{BASE_URL}/api/admin/agents/{aid}/run-now", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "added" in data
        assert isinstance(data["added"], int)


# --------- API Customers ---------
class TestApiCustomers:
    def test_admin_api_customers(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/api-customers", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)  # empty is fine
        # If populated, verify shape
        for c in data:
            assert "email" in c
            assert "api_key_preview" in c


# --------- Embed API ---------
class TestEmbedApi:
    def test_embed_jobs_no_key_401(self):
        r = requests.get(f"{BASE_URL}/api/embed/jobs", timeout=10)
        assert r.status_code == 401

    def test_embed_jobs_invalid_key_401(self):
        r = requests.get(
            f"{BASE_URL}/api/embed/jobs",
            headers={"Authorization": "Bearer bli_invalid"},
            timeout=10,
        )
        assert r.status_code == 401

    def test_embed_companies_no_key_401(self):
        r = requests.get(f"{BASE_URL}/api/embed/companies", timeout=10)
        assert r.status_code == 401
