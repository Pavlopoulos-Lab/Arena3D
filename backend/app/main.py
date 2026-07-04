from fastapi import FastAPI

from app.routers import attributes as attributes_router
from app.routers import config as config_router
from app.routers import external as external_router
from app.routers import layout as layout_router
from app.routers import network as network_router
from app.routers import session as session_router
from app.routers import topology as topology_router

app = FastAPI(title="Arena3Dweb API", version="3.0.0")
app.include_router(config_router.router)
app.include_router(network_router.router)
app.include_router(layout_router.router)
app.include_router(topology_router.router)
app.include_router(session_router.router)
app.include_router(external_router.router)
app.include_router(attributes_router.router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
