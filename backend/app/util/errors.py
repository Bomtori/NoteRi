# backend/app/errors.py
from fastapi import HTTPException, status

class OAuthProviderConflict(HTTPException):
    def __init__(self, *, registered_provider: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "OAUTH_PROVIDER_CONFLICT",
                "message": f"이미 {registered_provider}로 가입된 이메일입니다. 해당 제공사로 로그인해 주세요.",
                "registered_provider": registered_provider,   # 프론트가 안내 버튼 만들 때 사용
            },
        )
