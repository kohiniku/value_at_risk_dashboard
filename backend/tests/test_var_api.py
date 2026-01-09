"""Regression-style API checks implemented with unittest (no external deps)."""
from __future__ import annotations

import os
import unittest
from pathlib import Path

TEST_DB_PATH = Path(__file__).with_name("test_var_api.db")
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.api import routes  # noqa: E402
from app.core.constants import PORTFOLIO_AGGREGATE_RIC, SCENARIO_WINDOW  # noqa: E402
from app.db.seed import init_db  # noqa: E402
from app.main import healthcheck  # noqa: E402

init_db()


class VarApiTests(unittest.TestCase):
    """Covers the public VaR endpoints by calling the route handlers directly."""

    @classmethod
    def tearDownClass(cls) -> None:
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()

    def test_healthcheck_responds_ok(self) -> None:
        self.assertEqual(healthcheck(), {"status": "ok"})

    def test_var_summary_contains_assets(self) -> None:
        payload = routes.get_var_summary(as_of=None)

        self.assertGreater(payload.portfolio.total, 0)
        self.assertGreaterEqual(len(payload.assets), 3)
        self.assertGreaterEqual(payload.market_signal.score, 0)
        self.assertLessEqual(payload.market_signal.score, 100)
        self.assertTrue(payload.market_signal.label)
        self.assertTrue(payload.driver_commentary.technical_summary)
        self.assertTrue(payload.driver_commentary.news_summary)
        totals = payload.driver_commentary.driver_totals
        self.assertTrue(any(abs(value) > 0 for value in totals.model_dump().values()))
        first_asset = payload.assets[0]
        self.assertTrue(first_asset.category)
        self.assertSetEqual(
            set(first_asset.contributions.model_dump().keys()),
            {"window_drop", "window_add", "position_change", "ranking_shift"},
        )

    def test_var_timeseries_returns_window(self) -> None:
        summary = routes.get_var_summary(as_of=None)
        target_ric = summary.assets[0].ric
        payload = routes.get_var_timeseries(ric=target_ric, days=14)

        self.assertEqual(payload.ric, target_ric)
        self.assertEqual(len(payload.points), 14)
        self.assertIsNone(payload.points[0].change)
        self.assertIsNotNone(payload.points[1].change)

    def test_news_endpoint_returns_seeded_items(self) -> None:
        payload = routes.get_news(limit=2)
        self.assertEqual(len(payload), 2)
        sources = {item.source for item in payload}
        self.assertEqual(len(sources), 2, msg="ニュースソースが重複しています")
        for item in payload:
            self.assertIn("｜", item.headline)

    def test_var_dates_endpoint(self) -> None:
        dates = routes.list_snapshot_dates()
        self.assertGreaterEqual(len(dates), 2)
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_var_summary_with_explicit_date(self) -> None:
        dates = routes.list_snapshot_dates()
        target = dates[-1]
        payload = routes.get_var_summary(as_of=target)
        self.assertEqual(payload.as_of, target)
        self.assertEqual(payload.market_signal.as_of, target)
        self.assertEqual(payload.driver_commentary.as_of, target)
        self.assertTrue(payload.driver_commentary.technical_summary)
        self.assertTrue(payload.driver_commentary.news_summary)

    def test_scenario_distribution_endpoint(self) -> None:
        payload = routes.get_scenario_distribution(ric=PORTFOLIO_AGGREGATE_RIC)
        self.assertEqual(payload.ric, PORTFOLIO_AGGREGATE_RIC)
        self.assertEqual(len(payload.values), SCENARIO_WINDOW)

        summary = routes.get_var_summary(as_of=None)
        target_ric = summary.assets[0].ric
        asset_payload = routes.get_scenario_distribution(ric=target_ric)
        self.assertEqual(asset_payload.ric, target_ric)


if __name__ == "__main__":
    unittest.main()
