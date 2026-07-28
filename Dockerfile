# Production image: nginx serves static Vite build, proxies /api to uvicorn.
FROM node:22-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-group dev
COPY backend/app ./app
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=frontend-build /build/dist /usr/share/nginx/html

EXPOSE 8080
# ponytail: sh -c instead of a supervisor; two processes, container dies if nginx dies
# --no-sync: without it, `uv run` re-checks the lockfile's default sync target
# (which includes the dev group) and re-downloads pytest/mypy/ruff/etc. on
# every container start, since the build only synced --no-group dev. --no-sync
# just runs uvicorn in the venv frozen at build time — no runtime network dependency.
CMD ["sh", "-c", "uv run --no-sync uvicorn app.main:app --host 127.0.0.1 --port 8000 & exec nginx -g 'daemon off;'"]
