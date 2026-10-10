FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Multica CLI agar adapter multica live (bukan mock) di dalam container.
# Login dilakukan otomatis saat start via MULTICA_TOKEN (lihat multica._ensure_login).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY collector collector/
COPY frontend frontend/
CMD ["python", "-m", "collector.main"]
