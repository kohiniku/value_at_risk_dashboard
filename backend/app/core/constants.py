"""Shared constants for VaR."""

PORTFOLIO_AGGREGATE_RIC = "ALL_ASSETS"
SCENARIO_WINDOW = 800
HUNDRED_MILLION = 100_000_000

# # 特殊対応: DOWとNASDAQに関してはファクターIDをSP500のもので上書きする
# - 背景: 個別にファクターIDが割り当てられているものの、計算上は簡単化のためSP500の価格を当てることになったため
# - 備考: 当初display_unit_idの向き先を変えて対応しようとしたが、結局各ファクターIDの価格を使ってVaRを計算することになってしまうのでやむなくこの方法を採った
CANONICAL_FACTOR_ID_OVERRIDES: dict[str, str] = {
    # NASDAQ100
    "000031": "000028",
    # ダウ平均
    "000102": "000028",
}

# フロント向けにおいてのみ、VaR計算から除外するプロダクト
PREFER_IMPORTED_DELTA_EXCLUDED_KEYS: set[tuple[str, str, str, str]] = {
    (
        "Equity(JPY)(IC)",
        "000029",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Equity Index ETF",  # 日株ETF(TOPIX)
    ),
    (
        "Equity(JPY)(IC)",
        "000029",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Equity Index Futures",  # 日株先物(TOPIX)
    ),
    (
        "Equity(JPY)(IC)",
        "000029",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Listed Equity Index Options",  # 日株OP(TOPIX)
    ),
    (
        "Equity(JPY)(IC)",
        "000030",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Equity Index ETF",  # 日株ETF(日経)
    ),
    (
        "Equity(JPY)(IC)",
        "000030",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Equity Index Futures",  # 日株先物(日経)
    ),
    (
        "Equity(JPY)(IC)",
        "000030",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Listed Equity Index Options",  # 日株OP(日経)
    ),
    (
        "Equity & Commodity(non-JPY)(IC)",
        "000028",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Equity Index ETF",  # 外株ETF(SP500)
    ),
    (
        "Equity & Commodity(non-JPY)(IC)",
        "000028",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Listed Equity Index Options",  # 外株オプション(SP500)
    ),
    (
        "Equity & Commodity(non-JPY)(IC)",
        "000100",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Equity Index ETF",  # 外株ETF(EuroStoxx)
    ),
    (
        "Fixed Income(non-JPY)",
        "000094",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "MBS General",  # MBS
    ),
    (
        "Fixed Income(non-JPY)",
        "000017",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "MBS General",  # MBS(米国AAA社債指数として) - デルタ除外用定義
    ),
    (
        "Fixed Income(non-JPY)",
        "000088",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Money Market",
    ),
    (
        "Fixed Income(non-JPY)",
        "000088",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "CMO - Floater",
    ),
    (
        "Fixed Income(non-JPY)",
        "000088",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "IRS",
    ),
    (
        "Equity & Commodity(non-JPY)(IC)",
        "000088",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Listed Equity Index Options",
    ),
    (
        "Fixed Income(JPY)",
        "000083",
        "Fixed Income & Equity Investment Dept(IC)",
        "IRS",
    ),
    (
        "Equity(JPY)(IC)",
        "000083",
        "Fixed Income & Equity Investment Dept(IC)",
        "Listed Equity Index Options",
    ),
    (
        "ALM Operation",
        "000083",
        "Treasury Dept(JPY)",
        "Money Market",
    ),
    (
        "Fixed Income(non-JPY)",
        "000083",
        "Int'l Fixed Income & Equity Investment Dept(IC)",
        "IRS",
    ),
    (
        "Fixed Income(JPY)",
        "000083",
        "Fixed Income & Equity Investment Dept(IC)",
        "MBS - JHFA",
    ),
    (
        "ALM Operation",
        "000083",
        "Treasury Dept(JPY)",
        "Swaptions",
    ),
    (
        "Fixed Income(JPY)",
        "000083",
        "Fixed Income & Equity Investment Dept(IC)",
        "Corporate",
    ),
    (
        "ALM Operation",
        "000083",
        "Treasury Dept(JPY)",
        "IRS",
    ),
    (
        "Fixed Income(non-JPY)",
        "000083",
        "Int'l Fixed Income & Equity Investment Dept(IC)",
        "Money Market",
    ),
    (
        "Fixed Income(JPY)",
        "000083",
        "Fixed Income & Equity Investment Dept(IC)",
        "Municipal Bonds",
    ),
    (
        "Fixed Income(JPY)",
        "000077",
        "Fixed Income & Equity Investment Dept(IC)",  # 証券投資部
        "Inflation Linked Bonds",  # 物価連動国債
    ),
    (
        "Fixed Income(non-JPY)",
        "000078",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "Inflation Linked Bonds",  # 物価連動国債
    ),
    (
        "Fixed Income(non-JPY)",
        "000088",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "MBS General",  # MBS(米ドルRFRとして) - デルタ除外用定義
    ),
    (
        "Fixed Income(non-JPY)",
        "000091",
        "Int'l Fixed Income & Equity Investment Dept(IC)",  # 国際証券投資部
        "MBS General",  # MBS(ドルスワプションVolとして) - ベガ除外用定義
    ),
}


def get_direct_pl_import_products(includes_imported_data: bool) -> list[str]:
    """Get valid products that use direct PL import instead of dynamic delta simulation."""
    if includes_imported_data:
        return [
            "SOFR Factor - Extracted from IRS",  # 米金利(べース金利成分)
            "US IRS Spread",  # 米金利(スワップスプレッド)
            "TONA Factor - Extracted from JPY IRS",  # 円金利(べース金利成分)
            "JPY IRS Spread",  # 円金利(スワップスプレッド)
            "UST Factor - Extracted from MBS",  # MBS(ベース金利成分)
            "MBS Spread",  # MBS(スプレッド)
            "US Corporate Bond Funds",  # 米金利(クレジットリスク)
        ]
    return ["MBS General"]
