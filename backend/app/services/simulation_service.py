import csv
import re
from datetime import date, datetime, timedelta
from io import StringIO

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.domain.filters import BranchFilters
from app.models.domain.strategies import DataResolutionStrategy
from app.models.var import SimulationAdjustment, SimulationFactor
from app.repositories.simulation_repository import SimulationRepository

SIMULATION_ADJUSTMENTS_TEMPLATE_HEADERS = [
    "基準日",
    "リスク分類",
    "通貨",
    "リスクファクター",
    "ファクター番号",
    "ファクター名",
    "基準日のポジション量",
    "ポジション増減",
]


class SimulationService:
    """シミュレーション用のファクター取得やアップロードを行うサービス"""

    def __init__(self, session: Session):
        self.session = session

    def parse_excel_as_of(self, value: object) -> date | None:
        """Excel (UTF-8 TSV) date parsing logic."""
        if not value:
            return None
        val_str = str(value).strip()
        if not val_str:
            return None

        # yyyy-mm-dd
        if re.match(r"^\d{4}-\d{2}-\d{2}$", val_str):
            try:
                return datetime.strptime(val_str, "%Y-%m-%d").date()
            except ValueError:
                return None
        # yyyy/mm/dd
        if re.match(r"^\d{4}/\d{1,2}/\d{1,2}$", val_str):
            try:
                return datetime.strptime(val_str, "%Y/%m/%d").date()
            except ValueError:
                return None

        # Excel serial number
        try:
            excel_date = int(float(val_str))
            # Excel uses 1900-01-01 as day 1 (with 1900 leap year bug).
            # In python, 1899-12-30 + delta is commonly used to adjust for 1900-02-29.
            return (datetime(1899, 12, 30) + timedelta(days=excel_date)).date()
        except (ValueError, TypeError):
            pass

        return None

    def parse_factor_id(self, value: object) -> str | None:
        """Parse factor_id, padding with leading zeros to 6 digits if integer."""
        if not value:
            return None
        val_str = str(value).strip()
        if not val_str:
            return None

        try:
            # Excel might format 102 as "102.0"
            if val_str.endswith(".0"):
                num = int(val_str[:-2])
            else:
                num = int(val_str)
            return f"{num:06d}"
        except ValueError:
            # Not an integer, keep as string
            return val_str

    def parse_float(self, value: object) -> float | None:
        """Parse float value (removing commas etc.)."""
        if not value:
            return None
        val_str = str(value).strip().replace(",", "")
        if not val_str:
            return None
        try:
            return float(val_str)
        except ValueError:
            return None

    def fetch_simulation_factors_rows(
        self,
        as_of: date,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None = None,
    ) -> list[SimulationFactor]:
        repo = SimulationRepository(self.session)
        return repo.fetch_simulation_factors_rows(as_of, data_resolution_strategy, branch_filters)

    async def import_simulation_adjustments(self, file: UploadFile) -> tuple[date, list[SimulationAdjustment]]:
        if not file.filename or not file.filename.endswith((".csv", ".tsv", ".txt")):
            raise HTTPException(status_code=400, detail="CSV/TSV ファイルのみアップロード可能です")

        content_bytes = await file.read()

        # Try decoding in typical Japanese encodings
        for encoding in ["utf-8-sig", "utf-8", "cp932", "shift_jis"]:
            try:
                content = content_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="ファイルの文字コードを判別できませんでした(UTF-8 または Shift_JIS推奨)")

        dialect = csv.Sniffer().sniff(content[:1024]) if content else csv.excel()
        reader = csv.reader(StringIO(content), dialect=dialect)

        try:
            headers = next(reader)
        except StopIteration as exc:
            raise HTTPException(status_code=400, detail="ファイルが空です") from exc

        # Use simple fallback header checking logic
        if not headers or len(headers) < 8:
            raise HTTPException(status_code=400, detail="フォーマットが不正です。ダウンロードしたテンプレートを使用してください")

        adjustments: list[SimulationAdjustment] = []
        first_as_of = None
        for idx, row in enumerate(reader, start=2):
            if not row or not any(x.strip() for x in row):
                continue
            if len(row) < 8:
                continue

            as_of = self.parse_excel_as_of(row[0])
            factor_id = self.parse_factor_id(row[4])
            base_position = self.parse_float(row[6])
            delta_100m = self.parse_float(row[7])

            if not factor_id:
                raise HTTPException(status_code=400, detail=f"{idx}行目: ファクター番号が不正です")
            if as_of is None:
                raise HTTPException(status_code=400, detail=f"{idx}行目: 基準日が不正です ({row[0]})")
            if base_position is None:
                raise HTTPException(status_code=400, detail=f"{idx}行目: 基準日のポジション量が不正です")
            if delta_100m is None:
                raise HTTPException(status_code=400, detail=f"{idx}行目: ポジション増減(億円)が不正です")

            if first_as_of is None:
                first_as_of = as_of
            elif first_as_of != as_of:
                raise HTTPException(status_code=400, detail=f"{idx}行目: 基準日が複数混在しています")

            adjustments.append(
                SimulationAdjustment(
                    factor_id=factor_id,
                    position_delta=delta_100m,
                )
            )

        if not adjustments or first_as_of is None:
            raise HTTPException(status_code=400, detail="有効なデータ行が見つかりませんでした")

        return first_as_of, adjustments
