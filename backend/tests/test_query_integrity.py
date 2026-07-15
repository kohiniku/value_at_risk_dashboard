import unittest
from datetime import date
from unittest.mock import patch

from app.models.domain.filters import BranchFilters
from app.models.domain.strategies import DefaultDataResolutionStrategy
from app.services.var_service import VarService


class QueryIntegrityTest(unittest.IsolatedAsyncioTestCase):
    async def test_get_dashboard_data_queries(self):
        with patch("app.api.deps.SessionLocal") as MockSession:
            mock_session = MockSession.return_value.__enter__.return_value
            queries = []

            def execute_mock(stmt):
                sql = str(stmt.compile(compile_kwargs={"literal_binds": True})).replace("\n", " ").strip()
                queries.append(sql)

                class _Res:
                    def scalar(self):
                        return 100.0

                    def first(self):
                        return None

                    def all(self):
                        return []

                    def __iter__(self):
                        return iter([])

                    def scalars(self):
                        return self

                return _Res()

            mock_session.execute.side_effect = execute_mock

            service = VarService(mock_session)
            service.get_var_summary(
                as_of=date(2026, 4, 1),
                comparison_date=None,
                branch_filters=BranchFilters(),
                simulation_enabled=False,
                simulation_adjustments=None,
                data_resolution_strategy=DefaultDataResolutionStrategy(),
            )

            self.assertTrue(len(queries) > 0, "Should have executed at least one query")


if __name__ == "__main__":
    unittest.main()
