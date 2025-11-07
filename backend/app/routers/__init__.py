# backend/app/routers/__init__.py
import pkgutil, importlib, inspect
from fastapi import FastAPI, APIRouter

def register_routers(app: FastAPI) -> None:
    pkg = __name__  
    for m in pkgutil.walk_packages(__path__, prefix=pkg + "."):
        mod = importlib.import_module(m.name)
        router = getattr(mod, "router", None)
        if isinstance(router, APIRouter):
            app.include_router(router)