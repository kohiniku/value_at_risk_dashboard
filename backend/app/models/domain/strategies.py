from typing import Any, Protocol

from sqlalchemy import and_, or_


class DataResolutionStrategy(Protocol):
    """データソース（日報優先など）の解決戦略"""

    @property
    def includes_imported_data(self) -> bool:
        """日報などの外部取込データを加味するかどうか（アドオンVaR等の計算要否に影響）"""
        ...

    def apply_to_model(self, model: Any) -> Any | None: ...


class DefaultDataResolutionStrategy(DataResolutionStrategy):
    """通常の日報データを含めないデフォルトのデータ取得戦略"""

    @property
    def includes_imported_data(self) -> bool:
        return False

    def apply_to_model(self, model: Any) -> Any | None:
        if not hasattr(model, "imported_datetime"):
            return None
        return model.imported_datetime.is_(None)


class PreferImportedDataStrategy(DataResolutionStrategy):
    """日報データ(imported_datetime)を優先して取得する戦略"""

    def __init__(self, excluded_keys: set[tuple[str, str, str, str]]):
        self.excluded_keys = excluded_keys

    @property
    def includes_imported_data(self) -> bool:
        return True

    def apply_to_model(self, model: Any) -> Any | None:
        if not hasattr(model, "imported_datetime"):
            return None
        if not self.excluded_keys:
            return None

        disj = []
        for section_code, factor_id, dept_name, product in sorted(self.excluded_keys):
            disj.append(
                and_(
                    model.section_code == section_code,
                    model.factor_id == factor_id,
                    model.dept_name == dept_name,
                    model.product == product,
                )
            )
        return or_(
            and_(
                model.imported_datetime.is_(None),
                ~or_(*disj),
            ),
            model.imported_datetime.isnot(None),
        )
