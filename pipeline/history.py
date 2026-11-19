"""Turn parsed annual reports into the series the history page draws.

`derive_history(seasons, production, sources)` takes `annual.parse_annual`
output (one dict per season, any order) and `annual.production_history`
output, and returns one JSON-ready dict. What it decides, so the page doesn't:

- Seasons are sorted and must be consecutive: a gap raises, since a missing
  year would silently join its neighbours on every chart.
- Every season has clean tons and USD by product. Destinations, ports and the
  monthly table are in shipped weight before 2005/06, so destinations carry
  `base` and ports and months are only given from 2005/06.
- Fineness: `fina_pct` is the fine share of clean tons in every season, but
  the cut-off moved from 24.9 µ to 24.5 µ in 2005/06; the other classes are
  not comparable across the change and are kept per era.
- `remanente_total` (availability - local use - exports) is the carryover
  measure that means the same in every issue; FLA's printed carryover
  subtracted a pipeline stock in some years.
- Shares and USD/kg are computed here; printed shares are never used.
"""

from __future__ import annotations

from typing import Any

from pipeline.derive import _per_kg, _weighted_microns
from pipeline.parse import PRODUCTS, ReportError

MONTH_ORDER = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]


def derive_history(
    seasons: list[dict[str, Any]], production: list[dict[str, Any]], sources: dict[str, str]
) -> dict[str, Any]:
    seasons = sorted(seasons, key=lambda s: s["temporada"])
    starts = [int(s["temporada"][:4]) for s in seasons]
    if starts != list(range(starts[0], starts[0] + len(starts))):
        raise ReportError(
            f"annual seasons are not consecutive: {[s['temporada'] for s in seasons]}"
        )
    rows = [_season(s, sources) for s in seasons]
    countries = sorted({d["pais"] for r in rows for d in r["destinos"]})
    return {
        "temporadas": rows,
        "produccion": production,
        "paises": countries,
    }


def _season(s: dict[str, Any], sources: dict[str, str]) -> dict[str, Any]:
    tons, usd = s["productos"], s["ingresos"]
    clean = s["base"] == "limpia"
    destinations = [d for d in s["destinos"] if d["pais"] != "__total__"]
    shipped_total = next(d for d in s["destinos"] if d["pais"] == "__total__")["total"]
    balance = s["balance"]["__total__"]
    out: dict[str, Any] = {
        "temporada": s["temporada"],
        "numero": s["numero"],
        "archivo": s["archivo"],
        "url": sources.get(s["archivo"]),
        "emision": s["emision"],
        "base": s["base"],
        "total_t": tons["total"],
        "toneladas": {p: tons[p] for p in PRODUCTS if tons.get(p)},
        "ingresos_usd": usd["total"],
        "ingresos": {p: usd[p] for p in PRODUCTS if usd.get(p)},
        "usd_kg": _per_kg(usd["total"], tons["total"]),
        "usd_kg_producto": {
            p: _per_kg(usd[p], tons[p]) for p in PRODUCTS if tons.get(p) and usd.get(p)
        },
        "destinos": sorted(
            ({"pais": d["pais"], "t": d["total"]} for d in destinations if d.get("total")),
            key=lambda d: -d["t"],
        ),
        "destinos_total_t": shipped_total,
        "balance": {
            k: balance[k]
            for k in (
                "saldo_previo",
                "produccion",
                "disponibilidad",
                "consumo_local",
                "stock_operativo",
                "exportado",
                "remanente",
                "remanente_total",
            )
            if k in balance
        },
        "avisos": s.get("avisos", []),
    }
    if clean:
        fineness = s["finura"]["__total__"]
        microns = [r for r in s["micrones"] if r["rango"] != "__total__"]
        ports = [r for r in s["puertos"] if r["puerto"] != "__total__"]
        out["finura"] = {k: fineness.get(k, 0.0) for k in ("fina", "mediana", "gruesa")}
        out["fina_pct"] = fineness.get("fina", 0.0) / tons["total"]
        out["micron_promedio"] = _weighted_microns(microns).get("total")
        out["patagonia_pct"] = sum(r.get("total", 0.0) for r in ports if r["patagonico"]) / sum(
            r.get("total", 0.0) for r in ports
        )
        out["mensual"] = _monthly(s["mensual"], s["temporada"])
    else:
        old = s["finura_antigua"]
        out["finura_antigua"] = {k: v for k, v in old.items() if k != "total"}
        out["fina_pct"] = old.get("fina", 0.0) / tons["total"]
    return out


def _monthly(rows: list[dict[str, Any]], season: str) -> list[dict[str, Any]]:
    """Twelve months July-June, each with clean tons and USD."""
    if [int(r["mes"][5:]) for r in rows] != MONTH_ORDER:
        raise ReportError(f"{season}: monthly table is not July to June")
    return [
        {
            "mes": r["mes"],
            "t": r["total"],
            "usd": r.get("ingresos"),
            "ajuste_anual": r["ajuste_anual"],
        }
        for r in rows
    ]
