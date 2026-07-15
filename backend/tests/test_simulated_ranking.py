import unittest
from datetime import date

from app.repositories.exposure_repository import ExposureRepository


class SimulatedRankingTest(unittest.TestCase):
    """_rank_simulated_rows のPython側ランキングロジックを検証する。

    各系列を昇順ソートしワースト8番目(rn==8)を採用する。
    8点ちょうどの系列では「8番目に小さい値=最大値」になるため期待値を手計算できる。
    """

    def setUp(self):
        # シナリオ日(8日)。du99のみ5日分しか持たず除外対象。
        self.days = [date(2024, 1, k) for k in range(1, 9)]

        # display_unit_id -> (display_unit_name, risk_category_id, risk_category_name, currency_id, currency_name)
        self.dims = {
            10: ("A", 1, "金利", 392, "USD"),
            11: ("B", 1, "金利", 0, "-"),
            12: ("C", 2, "株", 392, "USD"),
            99: ("Z", 3, "為替", 392, "USD"),
        }
        # du10=delta専用(vsum=None), du11=vega専用(dsum=0.0), du12=両方
        self.exposures = {
            10: (1000.0, None),
            11: (0.0, 5.0),
            12: (2.0, 3.0),
        }

        du10 = [-100, -90, -80, -70, -60, -50, -40, -30]
        du11 = [-10, -20, -15, -5, -25, -35, -1, -2]
        du12 = [-200, -100, -50, -300, -150, -250, -220, -180]
        du99 = [-1000, -1000, -1000, -1000, -1000]  # 5日分のみ → 除外

        rows = []
        for du_id, series in ((10, du10), (11, du11), (12, du12)):
            for d, v in zip(self.days, series, strict=True):
                rows.append((du_id, d, float(v)))
        for d, v in zip(self.days[:5], du99, strict=True):
            rows.append((99, d, float(v)))
        self.rows = rows

    def test_ranking_structure_and_values(self):
        result = ExposureRepository._rank_simulated_rows(self.rows, self.dims, self.exposures)

        # 全体(1) + カテゴリ(cat1,cat2の2) + 資産別(du10,du11,du12の3) = 6行。cat3/du99は8日未満で除外。
        self.assertEqual(len(result), 6)

        # 1行目: 全体。日別合算系列の8番目に小さい値(=最大) = s8 の合算 -212
        overall = result[0]
        self.assertEqual(overall.risk_category_id, 0)
        self.assertEqual(overall.display_unit_name, "全リスク合算")
        self.assertAlmostEqual(overall.var_amount_raw, -212.0)
        self.assertEqual(overall.pl_count, 8)
        self.assertIsNone(overall.dsum)

        # カテゴリはrisk_category_id昇順
        cat1, cat2 = result[1], result[2]
        self.assertEqual(cat1.risk_category_id, 1)
        self.assertEqual(cat1.display_unit_name, "カテゴリ合算")
        self.assertAlmostEqual(cat1.var_amount_raw, -32.0)  # du10+du11 の s8 合算 = -32
        self.assertEqual(cat2.risk_category_id, 2)
        self.assertAlmostEqual(cat2.var_amount_raw, -50.0)  # du12 のみ → s3 = -50

        # 資産別は (risk_category_id 昇順, var_amount 降順)
        du_rows = result[3:]
        self.assertEqual([r.display_unit_name for r in du_rows], ["B", "A", "C"])
        b_row, a_row, c_row = du_rows
        self.assertAlmostEqual(b_row.var_amount_raw, -1.0)
        self.assertEqual(b_row.currency_id, 0)
        self.assertEqual(b_row.currency_name, "-")
        self.assertAlmostEqual(b_row.dsum, 0.0)
        self.assertAlmostEqual(b_row.vsum, 5.0)
        self.assertAlmostEqual(a_row.var_amount_raw, -30.0)
        self.assertAlmostEqual(a_row.dsum, 1000.0)
        self.assertIsNone(a_row.vsum)
        self.assertAlmostEqual(c_row.var_amount_raw, -50.0)
        self.assertEqual(c_row.currency_name, "USD")

    def test_missing_exposure_defaults(self):
        # exposures辞書に無いユニットは dsum=0.0 / vsum=None(従来のClickHouse LEFT JOINと同一)
        result = ExposureRepository._rank_simulated_rows(self.rows, self.dims, {})
        du_rows = result[3:]
        for row in du_rows:
            self.assertEqual(row.dsum, 0.0)
            self.assertIsNone(row.vsum)

    def test_exposures_none_keeps_none(self):
        # include_exposures=False相当: dsum/vsumはNone
        result = ExposureRepository._rank_simulated_rows(self.rows, self.dims, None)
        du_rows = result[3:]
        for row in du_rows:
            self.assertIsNone(row.dsum)
            self.assertIsNone(row.vsum)

    def test_empty_input(self):
        self.assertEqual(ExposureRepository._rank_simulated_rows([], self.dims, None), [])

    def test_excludes_series_shorter_than_rank(self):
        # 全display_unitが7日以下なら全系列が除外され空になる
        short_rows = [(10, d, -1.0) for d in self.days[:7]]
        self.assertEqual(ExposureRepository._rank_simulated_rows(short_rows, self.dims, None), [])


if __name__ == "__main__":
    unittest.main()
