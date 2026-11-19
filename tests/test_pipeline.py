"""Checks against the real FLA PDFs in data/raw, including their awkward layouts.

EL 807 duplicates the label column, EL 810 slips a digit across a cell
boundary, EL 812 prints the balance in whole tons with stray spaces, EL 813 has
no balance, and EL 816 packs two tables into one box.
"""

from pathlib import Path

import pytest

from pipeline.derive import derive
from pipeline.parse import ReportError, _country, _number, parse_report

RAW = Path(__file__).parent.parent / "data" / "raw"
FILES = sorted(RAW.glob("*.pdf"))


@pytest.fixture(scope="module")
def reports():
    return {r["numero"]: r for r in map(parse_report, FILES)}


def test_every_report_parses_and_has_one_issue_per_month(reports):
    assert sorted(reports) == list(range(807, 817))
    assert [reports[n]["hasta"] for n in (811, 812, 813)] == ["2026-05", "2026-06", "2026-07"]


def test_slipped_digit_is_repaired(reports):
    july = reports[810]["mensual"][0]
    assert (july["lavada"], july["peinada"]) == (63.1, 552.4)


def test_known_values(reports):
    r = reports[816]
    assert r["ingresos"]["total"] == pytest.approx(69_880_894.6)
    assert r["base_sucia"]["__total__"]["total"] == pytest.approx(12_527.3)
    assert r["balance"]["fina"]["remanente"] == pytest.approx(26_127.4)
    assert reports[812]["balance"]["__total__"]["produccion"] == 31_038
    assert reports[813]["balance"] is None


def test_blank_is_not_zero(reports):
    turkey = next(d for d in reports[816]["destinos"] if d["pais"] == "Turquía")
    assert "sucia" not in turkey
    assert [m["mes"] for m in reports[816]["mensual"]][-1] == "2026-10"


def test_number_formats():
    assert _number("26.504.270,4", "x") == 26_504_270.4
    assert _number("1 9.972", "balance") == 19_972
    assert _number("22.94 µ", "micron") == 2294  # why micron averages are not read
    with pytest.raises(ReportError):
        _number("39,%", "x")


def test_unknown_country_fails_loudly():
    assert _country("República Checa Czech Republic") == "República Checa"
    with pytest.raises(ReportError):
        _country("Atlántida Atlantis")


def test_patagonian_flag_comes_from_the_pdf(reports):
    ports = {p["puerto"]: p.get("patagonico") for p in reports[816]["puertos"]}
    assert ports["Puerto Madryn"] is True
    assert ports["Buenos Aires"] is False


def test_rectified_reissue_replaces_earlier_file(reports):
    original = dict(reports[810], emision="2026-05-01", rectificativa=False, archivo="old.pdf")
    data = derive([*reports.values(), original], {})
    assert [r["archivo"] for r in data["reemplazados"]] == ["old.pdf"]
    assert len(data["informes"]) == 10


def test_recent_months_are_provisional(reports):
    data = derive(list(reports.values()), {})
    flagged = [m["mes"] for m in data["meses"] if m["provisional"]]
    assert flagged == ["2026-09", "2026-10"]  # closed season 2025/26 is never provisional


def test_derived_series(reports):
    data = derive(list(reports.values()), {})
    months = {m["mes"]: m for m in data["meses"]}
    assert len(months) == 16
    assert months["2026-07"]["total_t"] == pytest.approx(2019.4)  # revised, not EL 813's 1586.7
    assert months["2026-06"]["ajuste_anual"]
    # Blocks of one season add up to that season's latest season-to-date total.
    for season in data["temporadas"]:
        blocks = [b for b in data["bloques"] if b["temporada"] == season["temporada"]]
        # Block tons are summed from rounded cells, so allow half a ton against the print.
        assert sum(b["total_t"] for b in blocks) == pytest.approx(season["total_t"], abs=0.5)
        assert sum(b["ingresos_usd"] for b in blocks) == pytest.approx(season["ingresos_usd"])
