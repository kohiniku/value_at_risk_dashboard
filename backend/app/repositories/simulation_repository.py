from datetime import date

from sqlalchemy import select

from app.db_ch.models import Currencies, DisplayUnit, Factor, RiskCategories
from app.models.domain.filters import BranchFilters
from app.models.domain.strategies import DataResolutionStrategy
from app.models.var import SimulationFactor
from app.queries.exposure_query import ExposureQuery
from app.repositories.base_repository import BaseRepository


class SimulationRepository(BaseRepository):
    """シミュレーション設定関連のデータアクセスを担うリポジトリ"""

    def fetch_simulation_factors_rows(
        self,
        as_of: date,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None = None,
    ) -> list[SimulationFactor]:
        delta_sum_factor = ExposureQuery.build_delta_sum_factor_cte(as_of, data_resolution_strategy, branch_filters)
        vega_sum_factor = ExposureQuery.build_vega_sum_factor_cte(as_of, data_resolution_strategy, branch_filters)
        exposure_union = ExposureQuery.build_exposure_union_cte(delta_sum_factor, vega_sum_factor)
        base_positions = ExposureQuery.build_base_positions_cte(exposure_union)

        stmt = (
            select(
                base_positions.c.factor_id,
                Factor.factor_name,
                Factor.description,
                base_positions.c.base_position,
                RiskCategories.risk_category_name,
                Currencies.currency_name,
                DisplayUnit.display_unit_name,
            )
            .select_from(base_positions)
            .join(Factor, Factor.factor_id == base_positions.c.factor_id)
            .join(DisplayUnit, Factor.display_unit_id == DisplayUnit.display_unit_id, isouter=True)
            .join(RiskCategories, DisplayUnit.risk_category_id == RiskCategories.risk_category_id, isouter=True)
            .join(Currencies, DisplayUnit.currency_id == Currencies.currency_id, isouter=True)
            .order_by(
                RiskCategories.risk_category_id.asc().nulls_last(),
                Currencies.currency_id.asc().nulls_last(),
                DisplayUnit.display_unit_id.asc().nulls_last(),
                base_positions.c.factor_id.asc(),
            )
        )

        rows = self.fetch_all(stmt)
        return [
            SimulationFactor(
                factor_id=row[0],
                factor_name=row[1],
                description=row[2],
                base_position=float(row[3]) if row[3] is not None else 0.0,
                risk_class=row[4],
                currency=row[5],
                risk_factor=row[6],
            )
            for row in rows
        ]
