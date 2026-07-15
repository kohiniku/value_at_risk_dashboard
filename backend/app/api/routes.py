from fastapi import APIRouter

from app.api.endpoints import dates, simulations, var

router = APIRouter()

router.include_router(var.router, tags=["VaR"])
router.include_router(simulations.router, tags=["Simulations"])
router.include_router(dates.router, tags=["Dates"])
