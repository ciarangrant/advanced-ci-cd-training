import time
from fastapi import FastAPI, HTTPException

from prometheus_fastapi_instrumentator import Instrumentator, metrics

app = FastAPI(title="Hackathon Data API")
start_time = time.time()

_instrumentator = (
    Instrumentator(excluded_handlers=["/metrics"])
    .add(
        metrics.default(
            metric_namespace="",
            metric_subsystem="",
        )
    )
)
_instrumentator.instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
def health():
    """Health endpoint for Docker HEALTHCHECK and ALB target group checks."""
    return {
        "status": "healthy",
        "uptime": int(time.time() - start_time),
    }


@app.get("/api/data")
def get_data():
    """Sample data processing endpoint."""
    records = [
        {"id": 1, "metric": "deployment_frequency", "value": 4.2, "unit": "per_day"},
        {"id": 2, "metric": "lead_time", "value": 2.1, "unit": "hours"},
        {"id": 3, "metric": "change_failure_rate", "value": 8.5, "unit": "percent"},
        {"id": 4, "metric": "recovery_time", "value": 0.5, "unit": "hours"},
    ]
    return {"records": records, "count": len(records)}


@app.get("/api/data/{record_id}")
def get_record(record_id: int):
    """Retrieve a single data record by ID."""
    records = {
        1: {"id": 1, "metric": "deployment_frequency", "value": 4.2, "unit": "per_day"},
        2: {"id": 2, "metric": "lead_time", "value": 2.1, "unit": "hours"},
        3: {"id": 3, "metric": "change_failure_rate", "value": 8.5, "unit": "percent"},
        4: {"id": 4, "metric": "recovery_time", "value": 0.5, "unit": "hours"},
    }
    if record_id not in records:
        raise HTTPException(status_code=404, detail="Record not found")
    return records[record_id]
