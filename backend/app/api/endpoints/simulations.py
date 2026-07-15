from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_ch_db
from app.models.var import SimulationAdjustmentsImportResponse
from app.services.simulation_service import SimulationService

router = APIRouter()


@router.post("/var/simulation_adjustments/import", response_model=SimulationAdjustmentsImportResponse)
async def import_simulation_adjustments(
    file: UploadFile = File(...),
    session: Session = Depends(get_ch_db),
) -> SimulationAdjustmentsImportResponse:
    try:
        service = SimulationService(session)
        as_of, adjustments = await service.import_simulation_adjustments(file)
        return SimulationAdjustmentsImportResponse(as_of=as_of, adjustments=adjustments)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="ClickHouseへの接続に失敗しました") from exc
