"""The series the industry page draws that the history page does not have.

`derive_industry(seasons, trade)` takes `annual.parse_annual` output (one dict
per season, any order) and `comtrade.derive_trade` output, and returns one
JSON-ready dict. The page also loads historia-data.js for exports by product
and USD/kg per season; nothing here repeats those.

- `consumo`: FLA's local industrial use of wool per season, greasy basis, from
  the season's own balance, with its share of that balance's production and
  the split by fineness from 2005/06. `redondo` marks figures that are a
  multiple of 500 t: up to 2018/19 FLA prints round estimates (2,000 t in ten
  of eleven seasons from 2007/08), so they are not a measured trend.
- `manufacturas`: FLA's exports of yarn (hilados) and fabric (tejidos) per
  season, clean tons and USD. None where the issue has no such column
  (2003/04-2009/10), which is not the same as the 0 printed from 2015/16.
- `calendario`: FLA's clean tons of tops (peinada) and of all products per
  calendar year, summed from the monthly tables of two consecutive seasons,
  so they can stand next to Comtrade's calendar years. Only years with all
  twelve months (from 2006) are given.
- `comercio`: `trade` unchanged.
"""

from __future__ import annotations

from typing import Any

from pipeline.parse import FINENESS, ReportError

ROUND_TONS = 500


def derive_industry(seasons: list[dict[str, Any]], trade: dict[str, Any]) -> dict[str, Any]:
    seasons = sorted(seasons, key=lambda s: s["temporada"])
    return {
        "consumo": [_consumption(s) for s in seasons],
        "manufacturas": [_manufactures(s) for s in seasons],
        "calendario": _calendar_years(seasons),
        "comercio": trade,
    }


def _consumption(s: dict[str, Any]) -> dict[str, Any]:
    total = s["balance"]["__total__"]
    used, produced = total["consumo_local"], total["produccion"]
    by_class = {f: s["balance"][f]["consumo_local"] for f in FINENESS if f in s["balance"]} or None
    return {
        "temporada": s["temporada"],
        "produccion": produced,
        "consumo_local": used,
        "consumo_pct": used / produced,
        "redondo": used % ROUND_TONS == 0,
        "finura": by_class,
    }


def _manufactures(s: dict[str, Any]) -> dict[str, Any]:
    return {
        "temporada": s["temporada"],
        **{
            p: {"t": s["productos"].get(p), "usd": s["ingresos"].get(p)}
            for p in ("hilados", "tejidos")
        },
    }


def _calendar_years(seasons: list[dict[str, Any]]) -> list[dict[str, Any]]:
    months: dict[str, dict[str, Any]] = {}
    for s in seasons:
        for row in s.get("mensual") or []:
            if row["mes"] in months:
                raise ReportError(f"month {row['mes']} printed by two seasons")
            months[row["mes"]] = row
    years = sorted({int(m[:4]) for m in months})
    out = []
    for year in years:
        rows = [months.get(f"{year}-{m:02d}") for m in range(1, 13)]
        if None in rows:
            continue
        out.append(
            {
                "anio": year,
                "peinada_t": sum(r.get("peinada", 0.0) for r in rows),
                "total_t": sum(r["total"] for r in rows),
            }
        )
    return out
