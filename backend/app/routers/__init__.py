# backend/app/routers/__init__.py
import pkgutil, importlib, inspect
from fastapi import FastAPI, APIRouter

def register_routers(app: FastAPI) -> None:
    pkg = __name__  # backend.app.routers
    for m in pkgutil.walk_packages(__path__, prefix=pkg + "."):
        mod = importlib.import_module(m.name)
        # 모듈에 'router'라는 APIRouter 인스턴스가 있으면 include
        router = getattr(mod, "router", None)
        if isinstance(router, APIRouter):
            app.include_router(router)