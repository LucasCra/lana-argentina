"""Rebuild the site's data from the FLA PDFs.

    uv run --frozen python build.py            # parse data/raw/*.pdf
    uv run --frozen python build.py --fetch    # first download new issues from flasite.com

Writes data/processed/informes.json (every parsed table, for checking) and
site/data.js (what the site draws) from the monthly issues in data/raw, and
data/processed/anuales.json and site/historia-data.js from the annual issues
in data/raw/anuales. Stops with the failing check if any PDF does not add up;
nothing is written in that case.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from pipeline.annual import parse_annual, production_history
from pipeline.derive import derive
from pipeline.fetch import ANNUAL_PAGES, fetch_new, load_sources
from pipeline.history import derive_history
from pipeline.parse import ReportError, parse_report

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
ANNUAL = RAW / "anuales"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fetch", action="store_true", help="download new PDFs first")
    args = parser.parse_args()

    if args.fetch:
        new = fetch_new(RAW) + fetch_new(ANNUAL, ANNUAL_PAGES)
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
    latest = max(annual, key=lambda r: r["temporada"])
    history = derive_history(
        annual, production_history(ANNUAL / latest["archivo"]), load_sources(ANNUAL)
    )
    history["generado"] = data["generado"]

    processed = ROOT / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    (processed / "informes.json").write_text(json.dumps(reports, ensure_ascii=False, indent=1))
    (processed / "anuales.json").write_text(json.dumps(annual, ensure_ascii=False, indent=1))
    _write_js(ROOT / "site" / "data.js", "DATA", data)
    _write_js(ROOT / "site" / "historia-data.js", "HISTORIA", history)
    first, last = reports[0]["numero"], reports[-1]["numero"]
    print(f"{len(reports)} informes: EL {first}–{last} -> site/data.js")
    seasons = history["temporadas"]
    print(
        f"{len(seasons)} anuales: {seasons[0]['temporada']}–{seasons[-1]['temporada']}"
        " -> site/historia-data.js"
    )
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
