FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Chromium + its OS-level deps, needed by the agent's JS-rendering fallback
# (career pages built as React/Angular/Workday SPAs won't return job data from a plain HTTP GET).
RUN playwright install --with-deps chromium

COPY . .

# Railway/Render inject $PORT; default to 8000 for local docker run.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
