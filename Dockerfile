FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# outDir ../frontend resolves to /frontend inside this build
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Multica CLI so the multica adapter is live (not mock) in-container.
# Login happens automatically at start via MULTICA_TOKEN (see multica._ensure_login).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY collector collector/
COPY --from=web /frontend ./frontend
ENV PORT=8080
EXPOSE 8080
CMD ["python", "-m", "collector.main"]
