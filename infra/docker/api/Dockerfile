# Stage: development
FROM python:3.12-slim AS development

WORKDIR /app

RUN pip install uv

COPY apps/api/pyproject.toml apps/api/alembic.ini ./

RUN uv pip install --system -e ".[dev]"

COPY apps/api/ ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Stage: production
FROM python:3.12-slim AS production

WORKDIR /app

RUN pip install uv

COPY apps/api/pyproject.toml ./

RUN uv pip install --system .

COPY apps/api/ ./

RUN useradd --create-home --shell /bin/bash avdan && chown -R avdan:avdan /app
USER avdan

EXPOSE 8000

CMD ["gunicorn", "main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
