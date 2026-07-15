from datetime import date

from fastapi import APIRouter, Query

from app.services.date_service import DateService

router = APIRouter()


@router.get("/var/previous_business_day")
def get_previous_business_day_endpoint(target_date: date = Query(..., description="Target date")) -> dict:
    """Return the previous business day for a given date."""
    return {"previous_business_day": DateService.get_previous_business_day(target_date)}
