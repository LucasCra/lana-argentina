"""Checks for wool production by province: data/provincias.json and pipeline/provinces.py."""

import json
from pathlib import Path

import pdfplumber
import pytest

from pipeline.parse import ReportError
from pipeline.provinces import load_provinces, outline_names

ROOT = Path(__file__).parent.parent
PROVINCES = ROOT / "data" / "provincias.json"
GEO = ROOT / "site" / "vendor" / "argentina.js"


def test_outlines_have_all_24_jurisdictions():
    names = outline_names(GEO)
    assert len(names) == 24
    assert {"Chubut", "Santa Cruz", "Buenos Aires", "Ciudad de Buenos Aires"} <= names


def test_load_keeps_unlisted_provinces_as_unknown():
    out = load_provinces(PROVINCES, GEO)
    listed = sum(p["toneladas"] for p in out["provincias"])
    assert out["resto"] == out["total_nacional"] - listed > 0
    assert len(out["sin_dato"]) == 24 - len(out["provincias"])
    assert out["provincias"][0]["provincia"] == "Chubut"


def _write(tmp_path, **changes):
    data = json.loads(PROVINCES.read_text())
    data.update(changes)
    path = tmp_path / "p.json"
    path.write_text(json.dumps(data))
    return path


def test_rejects_name_without_outline(tmp_path):
    with pytest.raises(ReportError, match="sin contorno"):
        load_provinces(_write(tmp_path, provincias={"Rio Negro": 10}), GEO)


def test_rejects_sum_above_national_total(tmp_path):
    with pytest.raises(ReportError, match="más que el total"):
        load_provinces(_write(tmp_path, total_nacional=100), GEO)


def test_values_match_the_bars_in_the_source_pdf():
    """Re-measure the slide's bar chart: bar length against the 0-14,000 t gridlines."""
    data = json.loads(PROVINCES.read_text())
    with pdfplumber.open(ROOT / "data" / data["archivo"]) as pdf:
        page = pdf.pages[8]
        ticks = {w["text"]: (w["x0"] + w["x1"]) / 2 for w in page.extract_words() if w["top"] > 450}
        zero, top = ticks["0"], ticks["14.000"]
        labels = {w["text"]: w["top"] for w in page.extract_words() if 190 < w["top"] < 440}
        bars = {round(r["top"]): r["x1"] for r in page.rects if r["x0"] > 1000 and r["top"] < 450}
    rows = {
        "Chubut": "Chubut",
        "Santa Cruz": "Cruz",
        "Buenos Aires": "Aires",
        "Río Negro": "Negro",
        "Tierra del Fuego": "Fuego",
        "Corrientes": "Corrientes",
        "Neuquén": "Neuquén",
    }
    for province, word in rows.items():
        x1 = next(x for t, x in bars.items() if abs(t - labels[word]) < 6)
        measured = (x1 - zero) / (top - zero) * 14_000
        assert data["provincias"][province] == pytest.approx(measured, abs=60), province
