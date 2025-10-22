# backend/app/errors.py
from fastapi import HTTPException, status

class OAuthProviderConflict(Exception):
    """기존 가입된 소셜 provider와 충돌 시 사용"""

    def __init__(self, registered_provider: str):
        self.registered_provider = registered_provider
        super().__init__(f"Account already linked with {registered_provider}")