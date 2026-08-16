import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")

ADMIN_EMAIL = "admin@blinkedinjobs.co"
ADMIN_PASSWORD = "Admin@admin_shan17042003"
TESTUSER_EMAIL = "testuser@blinkedinjobs.co"
TESTUSER_PASSWORD = "Testuser@testuser_shan04172003"
REFERRER_EMAIL = "referrer@blinkedinjobs.co"
REFERRER_PASSWORD = "referrer@referrer_shan20030417"
MOCK_API_KEY = os.environ.get("MOCK_API_KEY", "bli_mock_demo_00000000000000000000000000000000")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    s.headers["Authorization"] = f"Bearer {data['token']}"
    return s, data


@pytest.fixture(scope="session")
def admin_session():
    s, data = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return s, data


@pytest.fixture(scope="session")
def user_session():
    s, data = _login(TESTUSER_EMAIL, TESTUSER_PASSWORD)
    return s, data


@pytest.fixture(scope="session")
def referrer_session():
    s, data = _login(REFERRER_EMAIL, REFERRER_PASSWORD)
    return s, data
