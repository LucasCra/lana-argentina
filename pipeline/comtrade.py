"""Argentina's foreign trade in wool, by processing stage, from UN Comtrade.

Comtrade republishes what each country's customs report: calendar years, net
weight in kg, exports FOB and imports CIF in current dollars. It does not line
up with FLA seasons (July-June) or FLA's clean-basis tons, so the site keeps
the two apart.

`fetch(raw_dir, years)` downloads, per calendar year, `comtrade-<year>.json`
(what Argentina reports, world totals for every code in `STAGES`) and
`espejo-<year>.json` (what every other country reports importing from
Argentina, for the chapter 51 codes in `MIRROR`), plus `origenes-<year>.json`
(Argentina's imports by partner) for the latest year. It records each URL in
`raw_dir/fuentes.json` and never touches an existing file; delete one to
download it again. The public preview API needs no key but allows about one
call per second and 500 rows per call; a full download takes about two minutes.

`derive_trade(raw_dir)` reads those files and returns, per year, dollars and
kilos by flow and stage, the mirror totals, and import origins for the latest
year.

Two decisions worth knowing. HS codes change between revisions (HS1996 to
HS2022), mostly for garments: `STAGES` lists every wool code of every
revision, each year answers only with the codes its own revision has, and
`codigos` in the output says which ones that was. Within a year the country
reported, Comtrade omits flows that were zero, so a stage with no rows is 0.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from pipeline.fetch import _get, load_sources
from pipeline.parse import ReportError

API = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
ARGENTINA = 32
ROW_CAP = 500
_FILTERS = "&partner2Code=0&customsCode=C00&motCode=0"

# Sheep wool and its products, from the farm gate to the shop. Chapter 51 codes
# also cover fine animal hair (alpaca, guanaco) where the HS does not split it.
STAGES: dict[str, list[str]] = {
    "sucia": ["510111", "510119"],
    "lavada": ["510121", "510129", "510130"],
    "peinada": ["510510", "510521", "510529"],
    "subproductos": ["510310", "510320", "510400"],
    "hilados": ["5106", "5107", "5109"],
    "telas": ["5111", "5112", "600610"],
    # Knitted (61) then woven (62). 610110, 610311, 610411, 611010, 611410 and
    # 611591 exist only up to HS2002; 620111/620211 became 620120/620220 in HS2022.
    "prendas": (
        "610110 610210 610311 610331 610341 610411 610431 610441 610451 610461 611010 "
        "611011 611410 611591 611594 611691 620111 620120 620211 620220 620311 620331 "
        "620341 620411 620431 620441 620451 620461 621131 621141 621420"
    ).split(),
    "hogar": ["560221", "570110", "570231", "570241", "570291", "570310", "630120"],
}
MANUFACTURES = ["hilados", "telas", "prendas", "hogar"]
_STAGE_OF = {code: stage for stage, codes in STAGES.items() for code in codes}

# Mirror codes are 4-digit so they mean the same in every revision; 5105 also
# holds fine-animal-hair tops, a small share for Argentina.
MIRROR = {"5105": "peinada", "5106": "hilados", "5107": "hilados", "5109": "hilados"}
MIRROR |= {"5111": "telas", "5112": "telas"}
_GROUP_REPORTERS = {0, 97, 975}  # world, European Union, ASEAN: would count twice

# Spanish names for the partners that can reach the origins chart; the rest
# are summed as "otros". A new top partner stops the build so it gets a name.
PARTNERS = {
    "156": "China", "380": "Italia", "604": "Perú", "504": "Marruecos", "699": "India",
    "450": "Madagascar", "792": "Turquía", "76": "Brasil", "50": "Bangladés",
    "842": "Estados Unidos", "642": "Rumania", "251": "Francia", "764": "Tailandia",
    "116": "Camboya", "484": "México", "826": "Reino Unido", "818": "Egipto",
    "620": "Portugal", "704": "Vietnam", "788": "Túnez", "858": "Uruguay",
    "100": "Bulgaria", "616": "Polonia", "276": "Alemania", "724": "España",
    "152": "Chile", "490": "Taiwán", "344": "Hong Kong", "360": "Indonesia",
    "586": "Pakistán", "410": "Corea del Sur", "392": "Japón", "36": "Australia",
}  # fmt: skip
TOP_ORIGINS = 10


def fetch(raw_dir: Path, years: range) -> list[str]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    sources = load_sources(raw_dir)
    downloaded = []
    for year in years:
        reported = (
            f"{API}?reporterCode={ARGENTINA}&period={year}&cmdCode={','.join(_STAGE_OF)}"
            f"&flowCode=X,M&partnerCode=0{_FILTERS}"
        )
        mirror = f"{API}?period={year}&partnerCode={ARGENTINA}&cmdCode={','.join(MIRROR)}"
        mirror += f"&flowCode=M{_FILTERS}"
        for name, url in ((f"comtrade-{year}.json", reported), (f"espejo-{year}.json", mirror)):
            if _save(raw_dir / name, url):
                sources[name] = url
                downloaded.append(name)
    latest = max((int(p.stem[-4:]) for p in raw_dir.glob("comtrade-*.json")), default=None)
    name = f"origenes-{latest}.json"
    if latest is not None and not (raw_dir / name).exists():
        # One call per stage keeps each answer under the row cap.
        parts = []
        for stage in MANUFACTURES:
            url = (
                f"{API}?reporterCode={ARGENTINA}&period={latest}"
                f"&cmdCode={','.join(STAGES[stage])}&flowCode=M{_FILTERS}"
            )
            parts.append({"url": url, "respuesta": _call(url)})
        (raw_dir / name).write_text(json.dumps(parts, ensure_ascii=False) + "\n")
        sources[name] = [p["url"] for p in parts]
        downloaded.append(name)
    (raw_dir / "fuentes.json").write_text(json.dumps(sources, indent=2, sort_keys=True) + "\n")
    return downloaded


def derive_trade(raw_dir: Path) -> dict[str, Any]:
    years = []
    for path in sorted(raw_dir.glob("comtrade-*.json")):
        year = int(path.stem[-4:])
        row = _year(year, json.loads(path.read_text())["data"], path.name)
        mirror = raw_dir / f"espejo-{year}.json"
        if mirror.exists():
            row["espejo"] = _mirror(json.loads(mirror.read_text())["data"], mirror.name)
        years.append(row)
    if not years:
        raise ReportError(f"no Comtrade files in {raw_dir}; run build.py --fetch")
    numbers = [y["anio"] for y in years]
    if numbers != list(range(numbers[0], numbers[-1] + 1)):
        raise ReportError(f"Comtrade years are not consecutive: {numbers}")
    origins = raw_dir / f"origenes-{numbers[-1]}.json"
    return {
        "anios": years,
        "etapas": list(STAGES),
        "manufacturas": MANUFACTURES,
        "origenes": (
            {"anio": numbers[-1], **_origins(json.loads(origins.read_text()))}
            if origins.exists()
            else None
        ),
        "api": API,
    }


def _year(year: int, rows: list[dict[str, Any]], name: str) -> dict[str, Any]:
    if not rows:
        raise ReportError(f"{name}: Comtrade has no data for {year}")
    if len(rows) >= ROW_CAP:
        raise ReportError(f"{name}: {len(rows)} rows, the answer may be cut at {ROW_CAP}")
    revisions = {r["classificationCode"] for r in rows}
    if len(revisions) != 1:
        raise ReportError(f"{name}: more than one HS revision {sorted(revisions)}")
    seen: set[tuple[str, str]] = set()
    flows = {flow: _empty(STAGES) for flow in ("X", "M")}
    codes: dict[str, set[str]] = {stage: set() for stage in STAGES}
    for r in rows:
        key = (r["flowCode"], r["cmdCode"])
        if r["partnerCode"] != 0 or key in seen or r["cmdCode"] not in _STAGE_OF:
            raise ReportError(f"{name}: unexpected row {key} partner {r['partnerCode']}")
        seen.add(key)
        stage = _STAGE_OF[r["cmdCode"]]
        _add(flows[r["flowCode"]][stage], r)
        codes[stage].add(r["cmdCode"])
    return {
        "anio": year,
        "revision_hs": revisions.pop(),
        "exportaciones": flows["X"],
        "importaciones": flows["M"],
        "codigos": {stage: sorted(c) for stage, c in codes.items()},
    }


def _mirror(rows: list[dict[str, Any]], name: str) -> dict[str, Any]:
    """Imports from Argentina as other countries report them, CIF."""
    if len(rows) >= ROW_CAP:
        raise ReportError(f"{name}: {len(rows)} rows, the answer may be cut at {ROW_CAP}")
    totals = _empty(dict.fromkeys(MIRROR.values()))
    reporters: set[int] = set()
    seen: set[tuple[int, str]] = set()
    for r in rows:
        key = (r["reporterCode"], r["cmdCode"])
        if r["partnerCode"] != ARGENTINA or key in seen or r["cmdCode"] not in MIRROR:
            raise ReportError(f"{name}: unexpected row {key} partner {r['partnerCode']}")
        seen.add(key)
        if r["reporterCode"] in _GROUP_REPORTERS:
            continue
        reporters.add(r["reporterCode"])
        _add(totals[MIRROR[r["cmdCode"]]], r)
    return {**totals, "paises_informantes": len(reporters)}


def _origins(parts: list[dict[str, Any]]) -> dict[str, Any]:
    """Import dollars by partner and stage, the top partners named, the rest summed."""
    by_partner: dict[str, dict[str, float]] = {}
    world: dict[str, float] = {}
    for part in parts:
        rows = part["respuesta"]["data"]
        if len(rows) >= ROW_CAP:
            raise ReportError(f"origins call returned {len(rows)} rows, may be cut: {part['url']}")
        for r in rows:
            stage = _STAGE_OF[r["cmdCode"]]
            if r["partnerCode"] == 0:
                world[stage] = world.get(stage, 0.0) + r["primaryValue"]
                continue
            partner = by_partner.setdefault(str(r["partnerCode"]), {})
            partner[stage] = partner.get(stage, 0.0) + r["primaryValue"]
    for stage, usd in world.items():
        listed = sum(p.get(stage, 0.0) for p in by_partner.values())
        if abs(listed - usd) > max(1.0, usd * 0.001):
            raise ReportError(f"origins for {stage}: partners add to {listed:.0f}, world {usd:.0f}")
    ranked = sorted(by_partner, key=lambda code: -sum(by_partner[code].values()))
    top, rest = ranked[:TOP_ORIGINS], ranked[TOP_ORIGINS:]
    unnamed = [code for code in top if code not in PARTNERS]
    if unnamed:
        raise ReportError(f"origins: add a Spanish name to PARTNERS for codes {unnamed}")
    others: dict[str, float] = {}
    for code in rest:
        for stage, usd in by_partner[code].items():
            others[stage] = others.get(stage, 0.0) + usd
    return {
        "paises": [{"pais": PARTNERS[code], "usd": by_partner[code]} for code in top],
        "otros": {"paises": len(rest), "usd": others},
        "mundo": world,
    }


def _empty(stages: Any) -> dict[str, dict[str, float | None]]:
    return {stage: {"usd": 0.0, "kg": 0.0, "usd_kg": None} for stage in stages}


def _add(total: dict[str, Any], row: dict[str, Any]) -> None:
    """Add one row; `usd_kg` counts only rows that carry a weight."""
    total["usd"] += row["primaryValue"]
    if row["netWgt"]:
        weighed = (total["usd_kg"] or 0.0) * total["kg"] + row["primaryValue"]
        total["kg"] += row["netWgt"]
        total["usd_kg"] = weighed / total["kg"]


def _save(path: Path, url: str) -> bool:
    if path.exists():
        return False
    response = _call(url)
    if not response.get("data"):
        return False  # year not published yet
    path.write_text(json.dumps(response, ensure_ascii=False) + "\n")
    return True


def _call(url: str) -> dict[str, Any]:
    for attempt in range(6):
        time.sleep(1.5 + attempt * 2)  # the preview API allows about one call per second
        try:
            return json.loads(_get(url))
        except RuntimeError as error:
            if "429" not in str(error):
                raise
    raise RuntimeError(f"Comtrade kept answering 429 (rate limit) for {url}")
