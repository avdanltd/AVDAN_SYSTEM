# Stage: development
FROM python:3.12-slim AS development

WORKDIR /app

RUN pip install uv

COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/alembic.ini ./

# Install the exact versions in uv.lock (not whatever is newest today), then the project itself.
RUN uv export --frozen --extra dev --no-emit-project --no-hashes -o /tmp/requirements.txt \
    && uv pip install --system -r /tmp/requirements.txt \
    && uv pip install --system --no-deps -e .

COPY apps/api/ ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Stage: production
FROM python:3.12-slim AS production

WORKDIR /app

RUN pip install uv

COPY apps/api/pyproject.toml apps/api/uv.lock ./

# Install the exact versions in uv.lock (not whatever is newest today), then the project itself.
# Resolving at build time is what let a new Celery release crash the worker on a routine deploy.
RUN uv export --frozen --no-dev --no-emit-project --no-hashes -o /tmp/requirements.txt \
    && uv pip install --system -r /tmp/requirements.txt \
    && uv pip install --system --no-deps .

COPY apps/api/ ./

RUN useradd --create-home --shell /bin/bash avdan && chown -R avdan:avdan /app
USER avdan

EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
