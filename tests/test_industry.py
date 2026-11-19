"""Checks for the industry page's series: Comtrade files in data/raw/comercio and
the FLA-derived consumption and calendar-year tables.
"""

from pathlib import Path

import pytest

from pipeline.comtrade import MANUFACTURES, _mirror, _year, derive_trade
from pipeline.industry import derive_industry
from pipeline.parse import ReportError

TRADE = Path(__file__).parent.parent / "data" / "raw" / "comercio"


@pytest.fixture(scope="module")
def trade():
    return derive_trade(TRADE)


def test_trade_years_are_consecutive_with_one_hs_revision(trade):
    years = [y["anio"] for y in trade["anios"]]
    assert years[0] == 2000 and years == list(range(2000, years[-1] + 1))
    assert {y["revision_hs"] for y in trade["anios"]} >= {"H1", "H2", "H3", "H4", "H5", "H6"}


def test_known_trade_values(trade):
    by_year = {y["anio"]: y for y in trade["anios"]}
    assert by_year[2025]["importaciones"]["prendas"]["usd"] == pytest.approx(5_813_860.85)
    assert by_year[2024]["exportaciones"]["peinada"]["kg"] == pytest.approx(6_866_045.2)
    assert by_year[2024]["espejo"]["peinada"]["kg"] == pytest.approx(9_948_646.676, rel=1e-6)
    assert by_year[2025]["exportaciones"]["hilados"]["usd"] == 0.0  # no rows: zero, not missing


def test_origins_add_up_to_the_world_total(trade):
    o = trade["origenes"]
    for stage in MANUFACTURES:
        named = sum(p["usd"].get(stage, 0.0) for p in o["paises"])
        assert named + o["otros"]["usd"].get(stage, 0.0) == pytest.approx(o["mundo"][stage])


def _row(code, flow="X", usd=10.0, kg=2.0, partner=0, reporter=32):
    return {
        "classificationCode": "H6",
        "flowCode": flow,
        "cmdCode": code,
        "partnerCode": partner,
        "reporterCode": reporter,
        "primaryValue": usd,
        "netWgt": kg,
    }


def test_unit_value_ignores_rows_without_weight():
    year = _year(2030, [_row("5106"), _row("5107", usd=30.0, kg=None)], "test")
    yarn = year["exportaciones"]["hilados"]
    assert (yarn["usd"], yarn["kg"], yarn["usd_kg"]) == (40.0, 2.0, 5.0)
    assert year["importaciones"]["telas"] == {"usd": 0.0, "kg": 0.0, "usd_kg": None}


def test_unexpected_rows_fail_loudly():
    with pytest.raises(ReportError):
        _year(2030, [_row("5106"), _row("5106")], "duplicate")
    with pytest.raises(ReportError):
        _year(2030, [_row("5106", partner=156)], "partner")


def test_mirror_skips_country_groups():
    rows = [_row("5105", "M", 100.0, 10.0, 32, 276), _row("5105", "M", 900.0, 90.0, 32, 97)]
    mirror = _mirror(rows, "test")
    assert (mirror["peinada"]["usd"], mirror["paises_informantes"]) == (100.0, 1)


def _season(label, used, by_class=None, months=None, products=None):
    balance = {"__total__": {"consumo_local": used, "produccion": 40_000.0}}
    for fineness, value in (by_class or {}).items():
        balance[fineness] = {"consumo_local": value}
    return {
        "temporada": label,
        "balance": balance,
        "productos": products or {},
        "ingresos": {},
        "mensual": months,
    }


def test_consumption_flags_round_figures_and_keeps_missing_columns_apart():
    seasons = [
        _season("2008/09", 2000.0, {"fina": 700.0, "mediana": 800.0, "gruesa": 500.0}),
        _season("2003/04", 4100.0, products={"total": 1.0}),
        _season("2016/17", 2292.42, products={"hilados": 0.0, "tejidos": 0.0}),
    ]
    out = derive_industry(seasons, {})
    assert [c["temporada"] for c in out["consumo"]] == ["2003/04", "2008/09", "2016/17"]
    assert [c["redondo"] for c in out["consumo"]] == [False, True, False]
    assert out["consumo"][0]["finura"] is None
    assert out["consumo"][1]["consumo_pct"] == pytest.approx(0.05)
    assert out["manufacturas"][0]["hilados"]["t"] is None
    assert out["manufacturas"][2]["hilados"]["t"] == 0.0


def test_calendar_year_needs_all_twelve_months():
    def months(start):
        return [
            {"mes": f"{start + (m > 6)}-{(m + 5) % 12 + 1:02d}", "peinada": 1.0, "total": 2.0}
            for m in range(1, 13)
        ]

    seasons = [
        _season("2010/11", 0.0, months=months(2010)),
        _season("2011/12", 0.0, months=months(2011)),
    ]
    calendar = derive_industry(seasons, {})["calendario"]
    assert calendar == [{"anio": 2011, "peinada_t": 12.0, "total_t": 24.0}]
