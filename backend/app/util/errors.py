# backend/app/errors.py
from __future__ import annotations
from fastapi import HTTPException, status


class OAuthProviderConflict(Exception):
    """기존 가입된 소셜 provider와 충돌 시 사용"""

    def __init__(self, registered_provider: str):
        self.registered_provider = registered_provider
        super().__init__(f"Account already linked with {registered_provider}")


class DomainError(Exception):
    """도메인 레벨 공통 예외의 베이스 클래스."""
    default_message = "Domain error"

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.default_message)


class NotReadyError(DomainError):
    """리소스가 아직 준비되지 않은 상태(예: 오디오 duration 미확정/미생성)."""
    default_message = "Resource is not ready yet."


class AlreadyDebitedError(DomainError):
    """이미 차감이 완료된 상태."""
    default_message = "Already debited."


class UsageExceededError(DomainError):
    """요금제 한도(allocated_seconds)를 초과."""
    default_message = "Usage exceeded the plan limit."