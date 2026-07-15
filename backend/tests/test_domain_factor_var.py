import unittest

from app.models.domain.factor_var_result import FactorVarResultRow


class TestFactorVarResultRow(unittest.TestCase):
    def test_compute_risk_direction(self):
        # Overall
        row = FactorVarResultRow(
            risk_category_id=0,
            risk_category_name="全体",
            currency_id=0,
            currency_name="-",
            display_unit_name="全リスク合算",
            var_amount_raw=100.0,
            pl_count=1,
        )
        self.assertTrue(row.compute_risk_direction())

        row.var_amount_raw = -100.0
        self.assertFalse(row.compute_risk_direction())

        # Specific factor with dsum
        row = FactorVarResultRow(
            risk_category_id=1,
            risk_category_name="株式",
            currency_id=1,
            currency_name="JPY",
            display_unit_name="TOPIX",
            var_amount_raw=50.0,
            pl_count=1,
            dsum=10.0,
        )
        self.assertTrue(row.compute_risk_direction())

        row.dsum = -10.0
        self.assertFalse(row.compute_risk_direction())

        # No exposures
        row.dsum = None
        row.vsum = None
        self.assertIsNone(row.compute_risk_direction())


if __name__ == "__main__":
    unittest.main()
