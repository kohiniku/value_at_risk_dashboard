from datetime import date

from sqlalchemy import desc, func, select

from app.db_ch.models import ValueAtRisk
from app.models.domain.filters import BranchFilters
from app.models.domain.specifications import AddonBranchFilterSpec
from app.repositories.base_repository import BaseRepository


class SnapshotDateRepository(BaseRepository):
    """基準日・対象期間などの抽出を担うリポジトリ"""

    def get_latest_scenario_date(self, branch_filters: BranchFilters | None = None) -> date | None:
        stmt = select(func.max(ValueAtRisk.asof_date))

        if branch_filters:
            spec = AddonBranchFilterSpec(branch_filters)
            if (expr := spec.to_expr(ValueAtRisk)) is not None:
                stmt = stmt.where(expr)

        return self.fetch_scalar(stmt)
