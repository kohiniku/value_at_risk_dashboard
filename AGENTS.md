## AGENT AI Repository Guidance

This file provides strict guidance and historical context for **AGENT AI** when working with code in this repository. Read completely before touching the codebase.

---

## 1. Project Overview

- A dashboard that visualizes **Value at Risk (VaR)** for assets held by a financial institution using the **99% historical method**.
- Manages **20+ assets** across categories such as **Equities / Rates / Credit / Mortgages / Commodities**, enabling instant comparison of VaR levels, diversification effects, and drivers of change.
- Displayed data is retrieved from a dedicated **OLAP database (ClickHouse)**.
- UX requirements:
  - **All UI text is Japanese** (full Japanese localization).
  - **Auto-refresh only** (no refresh button).
  - Users must identify change points intuitively via **in-chart labels** and **table color-coding**, not by legends alone.

---

## 2. Technology Stack & Environment

- **Frontend**: Next.js (App Router) + Tailwind CSS + ApexCharts + shadcn/ui components
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy ORM
- **Package Management**: Python (`uv`), Node (`pnpm`)
- **Database**: ClickHouse (`CHDB_*` / `app/db_ch/*`)
- **Deployment**: docker compose + nginx reverse proxy (CORS_ORIGINS is a JSON array)

---

## 3. Required Functions & UX Rules

### 3.1) Valuation Date Control (Base Date)
- In the top-of-screen **FiltersBar**, the user selects a base date.
- **Optimization**: Base date is calculated client-side as "previous business day" by default, reducing initial load dependency on DB.
- When the date changes, all summary, charts, tables, KPI cards, and time series must update immediately.

### 3.2) VaR Comparison Chart
- `VarContributionChart` must compare: **stacked contributions of individual assets** vs **portfolio VaR**.
- Card footer must display the **diversification effect**.
- Each stack segment must render an **in-chart data label** (Japanese asset name + value in "m" units).

### 3.3) Asset-Level Table
- **Column order**: 金利 → 株・REIT → クレジット → コモディティ → 為替 → 調整
- **Four change drivers**: Drop (`window_drop`) / Add (`window_add`) / Position (`position_change`) / Rank (`ranking_shift`). Use background colors for these. Header text must be black. Numbers must be signed.
- Horizontal bar graph at row end is for magnitude comparison (do not place under the table).

### 3.4) KPI Cards + Detail Area
- `SummaryCards` must display: total VaR, largest contributing asset, diversification effect.
- `TimeseriesControls` (asset selector / 30-day window) must be placed **adjacent to** the time series chart, NOT in the FiltersBar.

### 3.5) Scenario P/L Distribution [⚠️ ATTENTION: SUSPENDED]
- *Original Spec*: Fetch 800 days of scenario P/L and render as a histogram.
- *Current Status*: **Currently NOT displayed on the UI.** Background polling for this heavy API caused severe performance degradation (Ghost Polling incident). Do not re-enable polling or UI rendering without explicit instruction.

---

## 4. Critical Mandates & Recurrence Prevention (Incident History)

The following rules were established after AI agents caused silent bugs, UI inconsistencies, system outages, and severe performance regressions. **Explicitly verify these points before concluding a task.**

### 4.1) Operational Safety & Infrastructure
- **Verify Targets**: ALWAYS verify the names of containers, files, or processes before executing destructive commands. (Past Incident: Restarted an unrelated Elasticsearch container instead of the target).
- **Docker Volumes & `pnpm`**: When updating frontend packages, `pnpm`'s symlinks often break inside Docker bind mounts, causing `Module not found` errors. 
  - **Rule**: NEVER use temporary hacks like `pnpm install --force`. ALWAYS use `node-linker=hoisted` in `.npmrc` for Docker compatibility.
- **Safe Cleanup of Temp Files**: When creating scripts (`patch.py`, `extract.py`) for refactoring, clean them up immediately. 
  - **Rule**: Use exact file paths with Python (`os.remove()`). Never use unsafe shell wildcards (`rm *`) which are blocked by safety constraints.

### 4.2) Database Performance & Safe Queries (OLAP Specific)
- **Know the Schema**: Run `SHOW CREATE TABLE` to understand indices (`ORDER BY`) and types before writing aggregations.
- **No Blind Casting**: DO NOT force type conversions (like `CAST(x, Float)`) to silence DB errors. It disables indices and triggers catastrophic full table scans.
- **The CTE Cross-Join Trap**: ClickHouse optimizers fail at partition pruning when filtering via joined CTEs.
  - **Rule**: NEVER abstract partition keys (like `asof_date`) into a single-row CTE (`target_date = select('2026-04-01')`) and join it. ALWAYS bind filter variables directly into the `WHERE` clause (`WHERE asof_date = '2026-04-01'`) to maintain millisecond response times.

### 4.3) API Contracts & Data Boundaries
- **Pydantic Model Consistency**: When refactoring Repositories/Services, ensure returned keys and types exactly match the Pydantic response models. 
  - **Incident**: Returning `as_of_date` instead of `date`, or `data_points` instead of `values` caused silent 503 Validation Errors.
- **Unit Conversions**: Pay strict attention to display units (e.g., raw ClickHouse values vs. UI "億円" values). Do not accidentally drop divisions by `100_000_000` during refactoring.
- **Cross-Boundary Grep**: If modifying a payload format (e.g., `TOTAL` to `total`), you MUST `grep` the frontend codebase to see how it is consumed. Ask the user before making architectural changes to contracts.

### 4.4) Business Logic Preservation
- **Silent Omissions in Refactoring**: When splitting God Classes into Repositories, extreme care must be taken not to drop fallback logic.
  - **Incident**: Accidental deletion of `as_of = latest_date` fallback caused API failures when the date was not explicitly requested. Missing a `UNION ALL` branch dropped total category calculations.
- **Consistent Calculation Pipelines**: When a specific mode (e.g., Simulation) is ON, execute its pipeline consistently even if delta inputs are zero. Do not fall back to the "OFF" mode logic.
- **No Math Alteration**: NEVER alter underlying mathematical or business logic (e.g., 800-day standard deviation rules) just to "clean up" the code.

### 4.5) Error Handling
- **NEVER Swallow Exceptions**: Do NOT use bare `except Exception:` to return empty fallbacks (e.g., `[]`, `{}`). Wrap code properly, log tracebacks, and raise standard `HTTPException` (500/503). Let the system fail loudly rather than silently hiding bugs.

---

## 5. Refactoring Directions & Design Principles

The primary goal is **refactoring that preserves existing behavior** (improving maintainability and safety without changing specs).

### Prioritized Evaluation Criteria
1. **Eliminate "Half-Baked" Objects**: Objects must be valid at creation (complete constructors + guard clauses). Never pass JSON strings deep into Services; parse them at the API layer via Dependency Injection (FastAPI `Depends`).
2. **Immutability**: Avoid reassignment. Express changes by creating new instances (`final` patterns).
3. **High Cohesion / Low Coupling**: Move calculation logic closer to the data (e.g., risk direction flags inside DTOs). Avoid excessive `public`.
4. **Break Down "God Classes" / Transaction Scripts**: Separate DB Query building (Repository/QueryObjects), Business Rules (Domain Service), and API routing. Do not overuse static utils.
5. **Simplify Conditionals**: Use early returns. Apply **Strategy** and **Specification** patterns to eliminate explosive `if/else` flags (like `prefer_imported_delta`).
6. **Collections**: Encapsulate collections. Expose them as unmodifiable externally.

### Naming & Methods
- **Purpose-Based Naming**: Concrete, narrowly-scoped names. No serial numbers or vague words (`Common`, `Util`, `Manager`).
- **Tell, Don't Ask**: Command–query separation. Minimize parameters, avoid flag arguments, and never pass null.

### Testing Expectations
- Always verify API integrity after refactoring.
- **Backend**: `uv run python -m unittest discover tests` (Ensure `test_var_api.py` and `test_query_integrity.py` pass).
- **Frontend**: `pnpm run lint` and Vitest.
