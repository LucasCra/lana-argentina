"""Turn parsed reports (season-to-date snapshots) into the series the site draws.

`derive(reports)` takes the output of `parse.parse_report` for any set of
issues and returns one JSON-ready dict. What it decides, so the site doesn't:

- Each month's figures come from the latest issue that prints that month.
  Earlier versions are kept under `revisiones`, because FLA revises months
  (EL 813 gave July 2026 as 1,587 t; EL 816 gives 2,019 t).
- Destination, product income, micron and port data exist only as
  season-to-date totals. `bloques` holds the difference between consecutive
  issues of a season; the first issue of a season is its own block. A block
  can be negative where an issue revised earlier months down; that is kept,
  not clipped. `revision_t` is how far a block's tons differ from the month's
  latest monthly figure.
- Shares, averages and USD/kg are computed here from tons and dollars; the
  printed shares and micron averages are never used.
- Blank stays absent; nothing missing becomes zero.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from pipeline.parse import COUNTRIES, FINENESS, PRODUCTS

MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def derive(reports: list[dict[str, Any]], sources: dict[str, str]) -> dict[str, Any]:
    """Build the site's data. `sources` maps PDF file name to its FLA URL."""
    reports, replaced = _latest_issues(reports)

    return {
        "informes": [_report_meta(r, sources) for r in reports],
        "reemplazados": [_report_meta(r, sources) for r in replaced],
        "meses": _months(reports),
        "revisiones": _revisions(reports),
        "bloques": _blocks(reports),
        "temporadas": _seasons(reports),
        "comparacion": _same_months(_months(reports)),
        "paises_mapa": {name: COUNTRIES[name] for name in _countries(reports)},
    }


def month_label(ym: str) -> str:
    year, month = ym.split("-")
    return f"{MONTH_NAMES[int(month) - 1]} {year[2:]}"


def _latest_issues(reports: list[dict]) -> tuple[list[dict], list[dict]]:
    """One report per number: a rectified re-issue replaces the earlier file.

    FLA re-issues a number as "rectificativa" and both PDFs can sit in
    data/raw. The later issue date wins; the other is returned as replaced.
    """
    by_number: dict[int, list[dict]] = defaultdict(list)
    for r in reports:
        by_number[r["numero"]].append(r)
    kept, replaced = [], []
    for issues in by_number.values():
        issues.sort(key=lambda r: (r["emision"], r["rectificativa"]))
        kept.append(issues[-1])
        replaced.extend(issues[:-1])
    kept.sort(key=lambda r: r["hasta"])
    return kept, replaced


def _report_meta(report: dict, sources: dict[str, str]) -> dict:
    keys = ["numero", "emision", "temporada", "desde", "hasta", "meses", "rectificativa", "archivo"]
    return {
        **{k: report[k] for k in keys},
        "etiqueta": month_label(report["hasta"]),
        "url": sources.get(report["archivo"]),
    }


# ---------------------------------------------------------------- months


# FLA keeps revising a month in the issues after its first print, mostly upward
# (July 2026: 1,587 t in EL 813, 2,019 t from EL 815). A month printed in fewer
# issues than this, in a season that is still open, is flagged provisional.
STABLE_AFTER_ISSUES = 3


def _months(reports: list[dict]) -> list[dict]:
    latest: dict[str, tuple[dict, dict]] = {}
    prints: dict[str, int] = defaultdict(int)
    for report in reports:  # sorted by period, so later issues overwrite earlier ones
        for row in report["mensual"]:
            latest[row["mes"]] = (report, row)
            prints[row["mes"]] += 1
    out = []
    for ym in sorted(latest):
        report, row = latest[ym]
        season_open = report["meses"] < 12
        tons = {p: row[p] for p in PRODUCTS if p in row}
        out.append(
            {
                "mes": ym,
                "etiqueta": month_label(ym),
                "temporada": report["temporada"],
                "toneladas": tons,
                "total_t": row["total"],
                "ingresos_usd": row["ingresos"],
                "usd_kg": _per_kg(row["ingresos"], row["total"]),
                "ajuste_anual": row["ajuste_anual"],
                "provisional": season_open and prints[ym] < STABLE_AFTER_ISSUES,
                "versiones": prints[ym],
                "fuente": report["numero"],
            }
        )
    return out


def _revisions(reports: list[dict]) -> list[dict]:
    versions: dict[str, list[dict]] = defaultdict(list)
    for report in reports:
        for row in report["mensual"]:
            versions[row["mes"]].append(
                {
                    "numero": report["numero"],
                    "total_t": row["total"],
                    "ingresos_usd": row["ingresos"],
                }
            )
    out = []
    for ym in sorted(versions):
        v = versions[ym]
        first, last = v[0], v[-1]
        out.append(
            {
                "mes": ym,
                "etiqueta": month_label(ym),
                "versiones": v,
                "cambio_t": last["total_t"] - first["total_t"],
                "cambio_usd": last["ingresos_usd"] - first["ingresos_usd"],
            }
        )
    return out


# ---------------------------------------------------------------- blocks


def _snapshot(report: dict) -> dict:
    """The season-to-date figures of one issue, flattened for subtraction."""
    destinations = {
        r["pais"]: {p: r[p] for p in PRODUCTS if p in r}
        for r in report["destinos"]
        if r["pais"] != "__total__"
    }
    microns = {
        r["rango"]: r.get("total", 0.0) for r in report["micrones"] if r["rango"] != "__total__"
    }
    ports = {
        r["puerto"]: r.get("total", 0.0) for r in report["puertos"] if r["puerto"] != "__total__"
    }
    fineness = {
        product: {f: row[f] for f in FINENESS if f in row}
        for product, row in report["finura"].items()
        if product != "__total__"
    }
    return {
        "destinos": destinations,
        "ingresos": {p: report["ingresos"][p] for p in PRODUCTS if p in report["ingresos"]},
        "micrones": microns,
        "puertos": ports,
        "finura": fineness,
    }


def _subtract(a: dict, b: dict) -> dict:
    """a - b over nested dicts of numbers; a key missing on one side counts as 0 there."""
    out = {}
    for key in a.keys() | b.keys():
        x, y = a.get(key), b.get(key)
        if isinstance(x, dict) or isinstance(y, dict):
            out[key] = _subtract(x or {}, y or {})
        else:
            out[key] = (x or 0.0) - (y or 0.0)
    return out


def _blocks(reports: list[dict]) -> list[dict]:
    monthly_latest = {m["mes"]: m for m in _months(reports)}
    out = []
    previous: dict | None = None
    for report in reports:
        snap = _snapshot(report)
        same_season = previous is not None and previous["temporada"] == report["temporada"]
        if same_season:
            assert previous is not None
            data = _subtract(snap, _snapshot(previous))
            first_month = _next_month(previous["hasta"])
        else:
            data = snap
            first_month = report["desde"]
        months = _month_range(first_month, report["hasta"])
        tons_by_product: dict[str, float] = defaultdict(float)
        for products in data["destinos"].values():
            for p, v in products.items():
                tons_by_product[p] += v
        total = sum(tons_by_product.values())
        income = sum(data["ingresos"].values())
        latest_total = sum(monthly_latest[m]["total_t"] for m in months)
        out.append(
            {
                "numero": report["numero"],
                "menos": previous["numero"] if same_season and previous else None,
                "temporada": report["temporada"],
                "meses": months,
                "etiqueta": _range_label(months),
                "toneladas": dict(tons_by_product),
                "total_t": total,
                "ingresos": data["ingresos"],
                "ingresos_usd": income,
                "usd_kg": _per_kg(income, total),
                "usd_kg_producto": {
                    p: _per_kg(data["ingresos"].get(p, 0.0), t)
                    for p, t in tons_by_product.items()
                    if t > 0
                },
                "destinos": {
                    country: {**products, "total": sum(products.values())}
                    for country, products in data["destinos"].items()
                    if any(abs(v) > 1e-9 for v in products.values())
                },
                "micrones": data["micrones"],
                "puertos": data["puertos"],
                "finura": data["finura"],
                "revision_t": total - latest_total,
            }
        )
        previous = report
    return out


def _next_month(ym: str) -> str:
    year, month = map(int, ym.split("-"))
    return f"{year + month // 12}-{month % 12 + 1:02d}"


def _month_range(first: str, last: str) -> list[str]:
    months = [first]
    while months[-1] != last:
        months.append(_next_month(months[-1]))
    return months


def _range_label(months: list[str]) -> str:
    if len(months) == 1:
        return month_label(months[0])
    return f"{month_label(months[0])} – {month_label(months[-1])}"


# ---------------------------------------------------------------- seasons


def _seasons(reports: list[dict]) -> list[dict]:
    """The latest season-to-date snapshot of each season, plus its balance history."""
    by_season: dict[str, list[dict]] = defaultdict(list)
    for report in reports:
        by_season[report["temporada"]].append(report)
    out = []
    for season, issues in sorted(by_season.items()):
        last = issues[-1]
        total = next(r for r in last["destinos"] if r["pais"] == "__total__")
        microns = [r for r in last["micrones"] if r["rango"] != "__total__"]
        out.append(
            {
                "temporada": season,
                "numero": last["numero"],
                "desde": last["desde"],
                "hasta": last["hasta"],
                "meses": last["meses"],
                "completa": last["meses"] == 12,
                "toneladas": {p: total[p] for p in PRODUCTS if p in total},
                "total_t": total["total"],
                "ingresos": {p: last["ingresos"][p] for p in PRODUCTS if p in last["ingresos"]},
                "ingresos_usd": last["ingresos"]["total"],
                "usd_kg": _per_kg(last["ingresos"]["total"], total["total"]),
                "usd_kg_producto": {
                    p: _per_kg(last["ingresos"][p], total[p])
                    for p in PRODUCTS
                    if total.get(p) and p in last["ingresos"]
                },
                "destinos": [
                    {
                        "pais": r["pais"],
                        **{p: r[p] for p in PRODUCTS if p in r},
                        "total": r["total"],
                    }
                    for r in last["destinos"]
                    if r["pais"] != "__total__"
                ],
                "por_producto": {
                    product: [r for r in rows if r["pais"] != "__total__"]
                    for product, rows in last["por_producto"].items()
                },
                "finura": {k: v for k, v in last["finura"].items() if k != "__total__"},
                "micrones": microns,
                "micron_promedio": _weighted_microns(microns),
                "puertos": [r for r in last["puertos"] if r["puerto"] != "__total__"],
                "base_sucia": last["base_sucia"],
                "balance": last["balance"],
                "balance_historia": [
                    {"numero": r["numero"], "hasta": r["hasta"], "balance": r["balance"]}
                    for r in issues
                    if r["balance"]
                ],
            }
        )
    return out


def _same_months(months: list[dict]) -> dict | None:
    """The latest season so far against the same months of the season before.

    Built from the monthly table only, the one source that is like-for-like
    across seasons. It has tons by product and total dollars, not dollars by
    product.
    """
    seasons = sorted({m["temporada"] for m in months})
    if len(seasons) < 2:
        return None
    current = [m for m in months if m["temporada"] == seasons[-1]]
    n = len(current)
    previous = [m for m in months if m["temporada"] == seasons[-2]][:n]
    if len(previous) < n:
        return None

    def total(rows: list[dict]) -> dict:
        tons: dict[str, float] = defaultdict(float)
        for m in rows:
            for p, v in m["toneladas"].items():
                tons[p] += v
        t = sum(m["total_t"] for m in rows)
        usd = sum(m["ingresos_usd"] for m in rows)
        return {
            "temporada": rows[0]["temporada"],
            "etiqueta": _range_label([m["mes"] for m in rows]),
            "toneladas": dict(tons),
            "total_t": t,
            "ingresos_usd": usd,
            "usd_kg": _per_kg(usd, t),
        }

    return {"meses": n, "actual": total(current), "anterior": total(previous)}


def _weighted_microns(rows: list[dict]) -> dict[str, float]:
    """Ton-weighted mean micron per product, using each bin's midpoint.

    The open-ended bins (<16.4, >32.6) use 16.2 and 33.0: an assumption, but
    they hold under 1% of tons in every issue.
    """
    out = {}
    for product in [*PRODUCTS, "total"]:
        weight = value = 0.0
        for r in rows:
            tons = r.get(product)
            if not tons:
                continue
            lo = r["desde"] if r["desde"] is not None else 16.0
            hi = r["hasta"] if r["hasta"] is not None else 33.4
            weight += tons
            value += tons * (lo + hi) / 2
        if weight:
            out[product] = value / weight
    return out


def _countries(reports: list[dict]) -> set[str]:
    return {r["pais"] for rep in reports for r in rep["destinos"] if r["pais"] != "__total__"}


def _per_kg(usd: float, tons: float) -> float | None:
    return usd / (tons * 1000) if tons > 0 else None
