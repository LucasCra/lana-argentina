"""Rebuild the site's data from the FLA PDFs.

    uv run --frozen python build.py            # parse data/raw/*.pdf
    uv run --frozen python build.py --fetch    # first download new issues from flasite.com

Writes data/processed/informes.json (every parsed table, for checking) and
site/data.js (what the site draws). Stops with the failing check if any PDF
does not add up; nothing is written in that case.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from pipeline.derive import derive
from pipeline.fetch import fetch_new, load_sources
from pipeline.parse import ReportError, parse_report

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fetch", action="store_true", help="download new PDFs first")
    args = parser.parse_args()

    if args.fetch:
        new = fetch_new(RAW)
        print(f"descargados: {', '.join(new) if new else 'ninguno nuevo'}")

    reports = []
    for path in sorted(RAW.glob("*.pdf")):
        try:
            reports.append(parse_report(path))
        except ReportError as error:
            print(f"ERROR {path.name}: {error}", file=sys.stderr)
            return 1

    reports.sort(key=lambda r: r["hasta"])
    data = derive(reports, load_sources(RAW))
    data["generado"] = date.today().isoformat()

    processed = ROOT / "data" / "processed"
    processed.mkdir(parents=True, exist_ok=True)
    (processed / "informes.json").write_text(json.dumps(reports, ensure_ascii=False, indent=1))
    (ROOT / "site" / "data.js").write_text(
        "// Generado por build.py. No editar a mano.\nwindow.DATA = "
        + json.dumps(data, ensure_ascii=False)
        + ";\n"
    )
    first, last = reports[0]["numero"], reports[-1]["numero"]
    print(f"{len(reports)} informes: EL {first}–{last} -> site/data.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
