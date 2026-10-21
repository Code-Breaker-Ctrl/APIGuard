import httpx
from typing import Dict, Any, Optional
from app.engine.models import IdentityProfile

DEFAULT_CREDENTIALS = {
    "user_a": {
        "identity_id": "usr_alice_101",
        "username": "alice@acme.corp",
        "password": "password_alice_123",
        "role": "customer"
    },
    "user_b": {
        "identity_id": "usr_bob_202",
        "username": "bob@adversary.io",
        "password": "password_bob_456",
        "role": "customer"
    },
    "admin": {
        "identity_id": "usr_admin_001",
        "username": "admin@corp.internal",
        "password": "password_admin_999",
        "role": "admin"
    },
    "support": {
        "identity_id": "usr_support_002",
        "username": "support@corp.internal",
        "password": "password_support_777",
        "role": "support"
    }
}

class AuthRegistry:
    """
    Manages test identities and dynamically logs in via the target's /auth/login endpoint
    to obtain real signed bearer tokens.
    """
    def __init__(self, base_url: str = "http://127.0.0.1:8000/target"):
        self.base_url = base_url.rstrip("/")

    async def authenticate_all(
        self,
        client: Optional[httpx.AsyncClient] = None
    ) -> Dict[str, IdentityProfile]:
        profiles = {}
        should_close = False
        if client is None:
            client = httpx.AsyncClient(timeout=5.0)
            should_close = True

        try:
            for key, creds in DEFAULT_CREDENTIALS.items():
                resp = await client.post(
                    f"{self.base_url}/auth/login",
                    json={"username": creds["username"], "password": creds["password"]}
                )
                if resp.status_code != 200:
                    raise RuntimeError(f"Authentication failed for {creds['username']}: {resp.status_code} {resp.text}")

                data = resp.json()
                profiles[key] = IdentityProfile(
                    identity_id=data.get("user_id", creds["identity_id"]),
                    username=creds["username"],
                    password=creds["password"],
                    role=data.get("role", creds["role"]),
                    token=data.get("token")
                )
            return profiles
        finally:
            if should_close:
                await client.aclose()
