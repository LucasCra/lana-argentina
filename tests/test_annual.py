"""Checks against the real FLA annual PDFs in data/raw/anuales.

The layouts change three times in 28 years: EL 488-536 print eleven product
columns with "-" for blanks, EL 548-560 five columns with nothing in blanks,
both in shipped weight; from EL 572 the tables are clean basis. EL 596 prints
a pipeline-stock balance, EL 776 a balance without row labels.
"""

from pathlib import Path

import pytest

from pipeline.annual import parse_annual, production_history
from pipeline.history import derive_history
from pipeline.parse import parse_report

RAW = Path(__file__).parent.parent / "data" / "raw"
FILES = sorted((RAW / "anuales").glob("*.pdf"))

pytestmark = pytest.mark.slow  # parses 28 PDFs, about 20 s


@pytest.fixture(scope="module")
def seasons():
    return {s["temporada"]: s for s in map(parse_annual, FILES)}


def test_every_season_from_1998_99_parses(seasons):
    assert len(seasons) == 28
    assert min(seasons) == "1998/99" and max(seasons) == "2025/26"
    history = derive_history(list(seasons.values()), [], {})
    assert [s["base"] for s in history["temporadas"]].count("efectiva") == 7


def test_annual_el_812_matches_the_monthly_rectificativa(seasons):
    annual = seasons["2025/26"]
    monthly = parse_report(RAW / "EL812Rectificativa.pdf")
    total = next(d for d in monthly["destinos"] if d["pais"] == "__total__")
    assert annual["productos"]["total"] == pytest.approx(total["total"])
    assert annual["ingresos"]["total"] == pytest.approx(monthly["ingresos"]["total"])
    assert annual["balance"]["__total__"]["produccion"] == 31_038


def test_old_clean_totals_match_the_table_el_548_reprints(seasons):
    # "Comparativo siete zafras previas", EL 548 page 10, whole tons.
    reprinted = {"1998/99": 27626, "1999/00": 38227, "2000/01": 34399, "2001/02": 38299}
    for season, tons in reprinted.items():
        assert seasons[season]["productos"]["total"] == pytest.approx(tons, abs=1)


def test_old_layouts(seasons):
    s = seasons["2003/04"]  # five columns, decimal point, blanks print nothing
    china = next(d for d in s["destinos"] if d["pais"] == "China")
    assert (china["sucia"], china["blousse"], china["total"]) == (461.6, 1021.2, 8685.2)
    assert "subproductos" not in china
    assert s["ingresos"]["total"] == pytest.approx(164_961_300)
    assert seasons["1998/99"]["finura_antigua"]["cruza_fina"] == 11467


def test_balance_layouts(seasons):
    assert seasons["2007/08"]["balance"]["__total__"]["stock_operativo"] == 19_500
    assert seasons["2008/09"]["balance"]["__total__"]["exportable"] == 82_611
    assert seasons["2022/23"]["balance"]["mediana"]["exportado"] == 5_932  # unlabelled rows
    # Printed carryover after a pipeline stock, and the comparable one.
    total = seasons["2003/04"]["balance"]["__total__"]
    assert (total["remanente"], total["remanente_total"]) == (17_784, 46_608.6)


def test_production_history():
    rows = production_history(RAW / "anuales" / "EL812.pdf")
    assert len(rows) == 50
    assert rows[0] == {
        "temporada": "1976/77",
        "total": 164000,
        "fina": 54000,
        "cruza_fina": 75200,
        "mediana": 10300,
        "gruesa": 24500,
    }
    assert set(rows[-1]) == {"temporada", "total", "fina", "mediana", "gruesa"}
