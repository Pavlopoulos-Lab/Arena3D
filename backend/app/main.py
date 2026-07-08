from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import config
from app.routers import attributes as attributes_router
from app.routers import config as config_router
from app.routers import external as external_router
from app.routers import layout as layout_router
from app.routers import network as network_router
from app.routers import session as session_router
from app.routers import topology as topology_router

app = FastAPI(title="Arena3D API", version="3.0.0")
app.include_router(config_router.router)
app.include_router(network_router.router)
app.include_router(layout_router.router)
app.include_router(topology_router.router)
app.include_router(session_router.router)
app.include_router(external_router.router)
app.include_router(attributes_router.router)


# Defense-in-depth: JSON body endpoints (layout/topology/external) validate
# node/edge counts only *after* Starlette buffers + Pydantic parses the full
# body, so an oversized payload is fully read into memory before rejection.
# Reject early using the declared Content-Length. This is a backstop for
# direct/non-nginx exposure (e.g. docker-compose dev) — the prod deploy's
# nginx client_max_body_size already enforces this at the edge. A request
# without Content-Length (chunked transfer) isn't caught here; it still hits
# the per-endpoint UploadFile checks for the file-upload routes.
@app.middleware("http")
async def limit_body_size(request: Request, call_next):  # type: ignore[no-untyped-def]
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            too_large = int(content_length) > config.MAX_UPLOAD_BYTES
        except ValueError:
            too_large = False  # malformed header — let normal parsing reject it
        if too_large:
            return JSONResponse(status_code=413, content={"detail": "Payload too large."})
    return await call_next(request)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
