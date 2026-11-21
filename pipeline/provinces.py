"""Wool production by province, for the origin map on index.html.

`load_provinces(path, geo)` reads data/provincias.json (hand-made from one
government slide; the file says how each value was measured) and checks it
against the province outlines in site/vendor/argentina.js: every province
must have an outline, and the provinces cannot add up to more than the
printed national total. The remainder is returned as `resto`, because the
slide gives no breakdown for the provinces it leaves out, and those are
unknown, not zero.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline.parse import ReportError

_PREFIX = 'echarts.registerMap("argentina", '


def outline_names(geo: Path) -> set[str]:
    """Province names in the ECharts map file."""
    text = geo.read_text()
    start = text.index(_PREFIX) + len(_PREFIX)
    end = text.rindex(");")
    features = json.loads(text[start:end])["features"]
    return {f["properties"]["name"] for f in features}


def load_provinces(path: Path, geo: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    for key in ("zafra", "unidad", "total_nacional", "fuente", "url", "metodo", "provincias"):
        if not data.get(key):
            raise ReportError(f"provincias.json: falta {key!r}")
    names = outline_names(geo)
    unknown = sorted(set(data["provincias"]) - names)
    if unknown:
        raise ReportError(f"provincias sin contorno en el mapa: {', '.join(unknown)}")
    if any(t <= 0 for t in data["provincias"].values()):
        raise ReportError("provincias.json: una provincia sin toneladas no va en la lista")
    listed = sum(data["provincias"].values())
    total = data["total_nacional"]
    if listed > total:
        raise ReportError(f"las provincias suman {listed} t, más que el total nacional {total} t")
    return {
        "zafra": data["zafra"],
        "unidad": data["unidad"],
        "total_nacional": total,
        "fuente": data["fuente"],
        "url": data["url"],
        "provincias": [
            {"provincia": k, "toneladas": v}
            for k, v in sorted(data["provincias"].items(), key=lambda kv: -kv[1])
        ],
        "resto": total - listed,
        "sin_dato": sorted(names - set(data["provincias"])),
    }
