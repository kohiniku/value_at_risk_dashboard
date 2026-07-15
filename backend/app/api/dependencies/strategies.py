from fastapi import Query

from app.core.constants import PREFER_IMPORTED_DELTA_EXCLUDED_KEYS
from app.models.domain.strategies import DataResolutionStrategy, DefaultDataResolutionStrategy, PreferImportedDataStrategy


def get_data_resolution_strategy(
    prefer_imported_delta: bool = Query(False, description="日報から取り込んだデルタを優先して反映する(フロント閲覧用)"),
) -> DataResolutionStrategy:
    if prefer_imported_delta:
        return PreferImportedDataStrategy(PREFER_IMPORTED_DELTA_EXCLUDED_KEYS)
    return DefaultDataResolutionStrategy()
