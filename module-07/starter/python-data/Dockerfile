FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src

# TODO: Add the runtime configuration
# Requirements:
# - EXPOSE port 8000
# - Add a HEALTHCHECK instruction that tests http://localhost:8000/health
#   Use python's urllib instead of curl (slim images may not have curl)
# - Set CMD to run uvicorn: uvicorn src.main:app --host 0.0.0.0 --port 8000
