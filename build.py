"""Rebuild the site's data from the FLA PDFs.

    uv run --frozen python build.py            # parse data/raw/*.pdf
    uv run --frozen python build.py --fetch    # first download new issues from flasite.com

Writes data/processed/informes.json (every parsed table, for checking) and
site/data.js (what the site draws) from the monthly issues in data/raw and
the production by province in data/provincias.json,
data/processed/anuales.json and site/historia-data.js from the annual issues
in data/raw/anuales, site/industria-data.js from the annual issues plus
the UN Comtrade files in data/raw/comercio, site/cadena-data.js from the
monthly tops price plus the assumptions in data/cadena.json, and
site/oportunidades-data.js from the monthly, history and chain results. Stops with
the failing check if any source does not add up; nothing is written in that case.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from pipeline.annual import parse_annual, production_history
from pipeline.chain import derive_chain, load_assumptions
from pipeline.comtrade import derive_trade
from pipeline.comtrade import fetch as fetch_trade
from pipeline.derive import derive
from pipeline.fetch import ANNUAL_PAGES, fetch_new, load_sources
from pipeline.history import derive_history
from pipeline.industry import derive_industry
from pipeline.opportunities import derive_opportunities
from pipeline.parse import ReportError, parse_report
from pipeline.provinces import load_provinces

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
ANNUAL = RAW / "anuales"
TRADE = RAW / "comercio"
CHAIN = ROOT / "data" / "cadena.json"
PROVINCES = ROOT / "data" / "provincias.json"
ARGENTINA = ROOT / "site" / "vendor" / "argentina.js"
FIRST_TRADE_YEAR = 2000


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fetch", action="store_true", help="download new PDFs first")
    args = parser.parse_args()

    if args.fetch:
        new = fetch_new(RAW) + fetch_new(ANNUAL, ANNUAL_PAGES)
        new += fetch_trade(TRADE, range(FIRST_TRADE_YEAR, date.today().year))
        print(f"descargados: {', '.join(new) if new else 'ninguno nuevo'}")

    reports = []
    for path in sorted(RAW.glob("*.pdf")):
        try:
            reports.append(parse_report(path))
        except ReportError as error:
            print(f"ERROR {path.name}: {error}", file=sys.stderr)
            return 1

    annual = []
    for path in sorted(ANNUAL.glob("*.pdf")):
        try:
            annual.append(parse_annual(path))
        except ReportError as error:
            print(f"ERROR {path.name}: {error}", file=sys.stderr)
            return 1

    reports.sort(key=lambda r: r["hasta"])
    data = derive(reports, load_sources(RAW))
    data["generado"] = date.today().isoformat()
    try:
        data["produccion_provincias"] = load_provinces(PROVINCES, ARGENTINA)
    except ReportError as error:
        print(f"ERROR {PROVINCES.name}: {error}", file=sys.stderr)
        return 1
    latest = max(annual, key=lambda r: r["temporada"])
    history = derive_history(
        annual, production_history(ANNUAL / latest["archivo"]), load_sources(ANNUAL)
    )
    history["generado"] = data["generado"]
    try:
        industry = derive_industry(annual, derive_trade(TRADE))
    except ReportError as error:
        print(f"ERROR {TRADE.name}: {error}", file=sys.stderr)
        return 1
    industry["generado"] = data["generado"]
    try:
        chain = derive_chain(data, load_assumptions(CHAIN))
    except ReportError as error:
        print(f"ERROR {CHAIN.name}: {error}", file=sys.stderr)
        return 1
    chain["generado"] = data["generado"]
    try:
        opportunities = derive_opportunities(data, history, chain)
    except ReportError as error:
        print(f"ERROR oportunidades: {error}", file=sys.stderr)
        return 1
    opportunities["generado"] = data["generado"]

    processed = ROOT / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    (processed / "informes.json").write_text(json.dumps(reports, ensure_ascii=False, indent=1))
    (processed / "anuales.json").write_text(json.dumps(annual, ensure_ascii=False, indent=1))
    _write_js(ROOT / "site" / "data.js", "DATA", data)
    _write_js(ROOT / "site" / "historia-data.js", "HISTORIA", history)
    _write_js(ROOT / "site" / "industria-data.js", "INDUSTRIA", industry)
    _write_js(ROOT / "site" / "cadena-data.js", "CADENA", chain)
    _write_js(ROOT / "site" / "oportunidades-data.js", "OPORTUNIDADES", opportunities)
    first, last = reports[0]["numero"], reports[-1]["numero"]
    print(f"{len(reports)} informes: EL {first}–{last} -> site/data.js")
    seasons = history["temporadas"]
    print(
        f"{len(seasons)} anuales: {seasons[0]['temporada']}–{seasons[-1]['temporada']}"
        " -> site/historia-data.js"
    )
    trade_years = industry["comercio"]["anios"]
    print(
        f"{len(trade_years)} años de Comtrade: {trade_years[0]['anio']}–{trade_years[-1]['anio']}"
        " -> site/industria-data.js"
    )
    print(f"remera de {chain['producto']['nombre']} -> site/cadena-data.js")
    print(f"{len(opportunities['oportunidades'])} etapas por sumar -> site/oportunidades-data.js")
    for season in seasons:
        for warning in season["avisos"]:
            print(f"aviso {season['temporada']}: {warning}")
    return 0


def _write_js(path: Path, name: str, data: dict) -> None:
    path.write_text(
        f"// Generado por build.py. No editar a mano.\nwindow.{name} = "
        + json.dumps(data, ensure_ascii=False)
        + ";\n"
    )


if __name__ == "__main__":
    sys.exit(main())
