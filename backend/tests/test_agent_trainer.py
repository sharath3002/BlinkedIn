"""
BlinkedIn iter-6 backend tests — AI Agent Trainer feature:
 - GET /api/admin/agents/{aid} — single agent w/ system_prompt + training_notes
 - GET /api/admin/agents/prompt/default — default prompt
 - POST /api/admin/agents/{aid}/instructions — update prompt/notes
 - POST /api/admin/agents/{aid}/test — dry-run w/o DB writes
 - New agents auto-created via POST /api/admin/job-urls carry non-empty system_prompt
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")


# ----------- Helpers / fixtures -----------
@pytest.fixture(scope="module")
def created_agent(admin_session):
    """Create a fresh job-url + auto-agent for this test module and clean up after."""
    s, _ = admin_session
    unique = uuid.uuid4().hex[:6]
    company = f"AgentTrainerTest_{unique}"
    payload = {
        "company": company,
        "url": "https://example.com/careers",
        "logo": "https://logo.clearbit.com/example.com",
    }
    rc = s.post(f"{BASE_URL}/api/admin/job-urls", json=payload, timeout=15)
    assert rc.status_code == 200, rc.text
    job_url = rc.json()
    # locate the auto-created agent
    time.sleep(0.6)
    agents_resp = s.get(f"{BASE_URL}/api/admin/agents", timeout=10)
    assert agents_resp.status_code == 200
    agents = agents_resp.json()
    agent = next((a for a in agents if a.get("company") == company), None)
    assert agent is not None, f"agent for {company} not auto-created"
    yield {"agent": agent, "job_url": job_url, "company": company, "session": s}


# ----------- Tests -----------
class TestDefaultPrompt:
    def test_default_prompt_returned(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/agents/prompt/default", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "system_prompt" in data
        sp = data["system_prompt"]
        assert isinstance(sp, str) and len(sp) > 50
        # Sanity — mentions job extraction
        assert "job" in sp.lower() or "extraction" in sp.lower()

    def test_default_prompt_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/agents/prompt/default", timeout=10)
        assert r.status_code in (401, 403), f"expected auth error, got {r.status_code}"


class TestAgentAutoPrompt:
    def test_new_agent_has_default_prompt_populated(self, created_agent):
        agent = created_agent["agent"]
        assert agent.get("system_prompt"), "system_prompt should not be empty on new agent"
        assert len(agent["system_prompt"]) > 50
        # training_notes may be empty string but key should exist
        assert "training_notes" in agent


class TestGetSingleAgent:
    def test_get_agent_returns_prompt_and_notes(self, admin_session, created_agent):
        s = created_agent["session"]
        aid = created_agent["agent"]["id"]
        r = s.get(f"{BASE_URL}/api/admin/agents/{aid}", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == aid
        assert "system_prompt" in data
        assert "training_notes" in data
        assert data["company"] == created_agent["company"]

    def test_get_unknown_agent_404(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/agents/507f1f77bcf86cd799439011", timeout=10)
        assert r.status_code == 404


class TestUpdateInstructions:
    def test_update_instructions_persists(self, created_agent):
        s = created_agent["session"]
        aid = created_agent["agent"]["id"]
        custom_prompt = "You are a strict job extraction bot for AgentTrainerTest. Return ONLY [] for now."
        notes = "Test iteration 6 - only skip life-at pages"
        r = s.post(
            f"{BASE_URL}/api/admin/agents/{aid}/instructions",
            json={"system_prompt": custom_prompt, "training_notes": notes},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # GET verifies persistence
        g = s.get(f"{BASE_URL}/api/admin/agents/{aid}", timeout=10)
        assert g.status_code == 200
        gd = g.json()
        assert gd["system_prompt"] == custom_prompt
        assert gd["training_notes"] == notes

    def test_update_requires_admin(self, created_agent):
        aid = created_agent["agent"]["id"]
        r = requests.post(
            f"{BASE_URL}/api/admin/agents/{aid}/instructions",
            json={"system_prompt": "hack", "training_notes": ""},
            timeout=10,
        )
        assert r.status_code in (401, 403)


class TestAgentDryRun:
    def test_test_endpoint_returns_shape(self, created_agent):
        s = created_agent["session"]
        aid = created_agent["agent"]["id"]

        # baseline job count
        jobs_before = s.get(f"{BASE_URL}/api/admin/agents/{aid}/jobs", timeout=10)
        assert jobs_before.status_code == 200
        count_before = len(jobs_before.json())

        r = s.post(f"{BASE_URL}/api/admin/agents/{aid}/test", timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response shape
        assert "ok" in data
        assert "jobs" in data
        assert isinstance(data["jobs"], list)
        if data["ok"]:
            assert "count" in data
            assert "html_size" in data
            assert isinstance(data["html_size"], int)
            assert data["count"] == len(data["jobs"])

        # CRITICAL: test must NOT create job records
        jobs_after = s.get(f"{BASE_URL}/api/admin/agents/{aid}/jobs", timeout=10)
        assert jobs_after.status_code == 200
        count_after = len(jobs_after.json())
        assert count_after == count_before, (
            f"test endpoint MUST NOT insert jobs — before={count_before} after={count_after}"
        )

    def test_test_unknown_agent_404(self, admin_session):
        s, _ = admin_session
        r = s.post(f"{BASE_URL}/api/admin/agents/507f1f77bcf86cd799439011/test", timeout=10)
        assert r.status_code == 404

    def test_test_requires_admin(self, created_agent):
        aid = created_agent["agent"]["id"]
        r = requests.post(f"{BASE_URL}/api/admin/agents/{aid}/test", timeout=10)
        assert r.status_code in (401, 403)


class TestRegression:
    """Quick regression on unrelated admin endpoints."""

    def test_stats(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/stats", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("users", "jobs", "applications"):
            assert k in d

    def test_agents_list(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/agents", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_api_customers(self, admin_session):
        s, _ = admin_session
        r = s.get(f"{BASE_URL}/api/admin/api-customers", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------- Teardown -----------
@pytest.fixture(scope="module", autouse=True)
def _cleanup(created_agent, admin_session):
    """Best-effort cleanup: delete job-url created by this module (agent record left; no delete endpoint)."""
    yield
    try:
        s = created_agent["session"]
        job_url_id = created_agent["job_url"].get("id")
        if job_url_id:
            # No delete endpoint currently exposed — leave a note in the test output
            pass
    except Exception:
        pass
