from datetime import date

from sqlalchemy import desc, select

from app.db_ch.models import Currencies, DisplayUnit, RiskCategories, ScenarioPLFromMatsuri
from app.models.domain.filters import BranchFilters
from app.models.domain.strategies import DataResolutionStrategy
from app.queries.scenario_pl_query import ScenarioPLQuery
from app.repositories.base_repository import BaseRepository


class VolatilityRepository(BaseRepository):
    """ボラティリティ調整に関するデータアクセスを担うリポジトリ"""

    def fetch_volatility_raw_data(
        self,
        as_of: date,
        data_resolution_strategy: DataResolutionStrategy,
        branch_filters: BranchFilters | None,
    ) -> list[tuple[date, str, str, str, str, str, float]]:
        dates = (
            select(ScenarioPLFromMatsuri.from_date)
            .where(ScenarioPLFromMatsuri.asof_date == as_of)
            .distinct()
            .order_by(desc(ScenarioPLFromMatsuri.from_date))
            .limit(800)
        )
        target_dates = self.session.execute(dates).scalars().all()
        if not target_dates:
            return []

        valid_scenario_pl = ScenarioPLQuery.build_valid_stmt(
            asof_date_filter=ScenarioPLFromMatsuri.asof_date == as_of,
            data_resolution_strategy=data_resolution_strategy,
            branch_conditions=branch_filters,
        ).cte("valid_scenario_pl")

        query = (
            select(
                valid_scenario_pl.c.from_date,
                valid_scenario_pl.c.section_code,
                valid_scenario_pl.c.product,
                RiskCategories.risk_category_name,
                Currencies.currency_name,
                DisplayUnit.display_unit_name,
                valid_scenario_pl.c.pl_value,
            )
            .select_from(valid_scenario_pl)
            .join(DisplayUnit, valid_scenario_pl.c.display_unit_id == DisplayUnit.display_unit_id)
            .join(RiskCategories, DisplayUnit.risk_category_id == RiskCategories.risk_category_id, isouter=True)
            .join(Currencies, DisplayUnit.currency_id == Currencies.currency_id, isouter=True)
            .where(valid_scenario_pl.c.from_date.in_(target_dates))
        )

        return self.fetch_all(query)
