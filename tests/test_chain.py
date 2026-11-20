"""Checks for the T-shirt value chain: data/cadena.json and pipeline/chain.py.

The FLA side is a small hand-made `derive` output, so these tests do not read PDFs.
"""

import copy
import json
from pathlib import Path

import pytest

from pipeline.chain import derive_chain, load_assumptions
from pipeline.parse import ReportError

ASSUMPTIONS = Path(__file__).parent.parent / "data" / "cadena.json"


def _monthly():
    def season(name, complete, tons, usd, until):
        return {
            "temporada": name,
            "numero": 900,
            "completa": complete,
            "hasta": until,
            "toneladas": {"peinada": tons},
            "ingresos": {"peinada": usd},
            "finura": {"peinada": {"fina": tons * 0.7, "total": tons}},
        }

    return {
        "temporadas": [
            season("2025/26", True, 10_000.0, 100_000_000.0, "2026-06"),  # 10 USD/kg
            season("2026/27", False, 1_000.0, 12_000_000.0, "2026-08"),  # 12 USD/kg
        ],
        "bloques": [
            {"meses": ["2026-05"], "toneladas": {"peinada": 1.0}, "ingresos": {"peinada": 1.0}},
            {
                "meses": ["2026-06"],
                "toneladas": {"peinada": 100.0},
                "ingresos": {"peinada": 1_100_000.0},
            },
            {
                "meses": ["2026-07"],
                "toneladas": {"peinada": 100.0},
                "ingresos": {"peinada": 1_300_000.0},
            },
        ],
        "meses": [
            {"mes": "2026-07", "temporada": "2026/27", "provisional": False},
            {"mes": "2026-08", "temporada": "2026/27", "provisional": True},
        ],
    }


@pytest.fixture(scope="module")
def assumptions():
    return load_assumptions(ASSUMPTIONS)


@pytest.fixture(scope="module")
def chain(assumptions):
    return derive_chain(_monthly(), assumptions)


def _stages(ladder):
    return {s["id"]: s for s in ladder["etapas"]}


def test_tops_price_is_fla_dollars_over_clean_kilos(chain):
    tops = chain["peinada"]
    assert tops["cerrada"]["usd_kg"] == pytest.approx(10.0)
    assert tops["actual"]["usd_kg"] == pytest.approx(12.0)
    assert tops["cerrada"]["fina_pct"] == pytest.approx(0.7)
    assert tops["actual"]["provisionales"] == ["2026-08"]
    assert tops["mismos_meses"] == {"meses": ["2026-06", "2026-07"], "usd_kg": pytest.approx(12.0)}
    first = _stages(chain)["peinada"]
    assert first["vende_usd"] == pytest.approx(chain["masas"]["peinada_g"] / 1000 * 10.0)


def test_mass_balance(chain, assumptions):
    P = {k: p["valor"] for k, p in assumptions["parametros"].items()}
    m = chain["masas"]
    assert m["tela_g"] * (1 - P["merma_corte"]) == pytest.approx(P["peso_prenda_g"])
    assert m["hilado_g"] * (1 - P["merma_tejido"]) == pytest.approx(m["tela_g"])
    assert m["lana_hilado_g"] + m["nailon_g"] == pytest.approx(m["hilado_g"])
    assert m["peinada_g"] * (1 - P["merma_hilado"]) == pytest.approx(m["lana_hilado_g"])
    assert 100 < m["peinada_g"] < 300  # a tee takes some 150 g of tops, not a kilo


def test_each_stage_buys_what_the_previous_one_sold(chain):
    stages = chain["etapas"]
    assert [s["id"] for s in stages] == [
        "peinada",
        "hilado",
        "tela",
        "confeccion",
        "importacion",
        "tienda",
    ]
    for before, after in zip(stages, stages[1:], strict=False):
        assert after["compra_usd"] == pytest.approx(before["vende_usd"])
    for s in stages:
        assert sum(p["usd"] for p in s["partes"]) == pytest.approx(s["agrega_usd"])


def test_value_added_sums_to_the_shop_price(chain):
    assert sum(s["agrega_usd"] for s in chain["etapas"]) == pytest.approx(chain["precio_usd"])
    for s in chain["escenarios"]:
        parts = s["peinada_usd"] + s["fabrica_usd"] + s["importacion_usd"] + s["marca_tienda_usd"]
        assert parts == pytest.approx(s["precio_usd"])


def test_duty_is_on_the_factory_gate_price(chain):
    s = _stages(chain)
    duty = next(p["usd"] for p in s["importacion"]["partes"] if p["id"] == "arancel")
    assert duty == pytest.approx(s["confeccion"]["vende_usd"] * 0.285)


def test_fine_tops_reproduce_the_cost_sheet(chain, assumptions):
    """With fine tops the factory gate is Quince's materials + crafting + packaging."""
    P = {k: p["valor"] for k, p in assumptions["parametros"].items()}
    fine = next(s for s in chain["escenarios"] if s["id"] == "peinada_fina")
    assert fine["fob_usd"] == pytest.approx(
        P["materiales_usd"] + P["confeccion_usd"] + P["embalaje_usd"]
    )
    base = next(s for s in chain["escenarios"] if s["id"] == "base")
    cheaper = chain["masas"]["peinada_g"] / 1000 * (chain["peinada"]["fina"]["usd_kg"] - 10.0)
    assert fine["fob_usd"] - base["fob_usd"] == pytest.approx(cheaper)
    # Processors pass the fibre through at cost: the tops price changes no factory margin.
    assert fine["fabrica_usd"] == pytest.approx(base["fabrica_usd"])


def test_factory_range_brackets_the_central_case(chain):
    f = chain["fabrica"]
    assert f["bajo"] < f["central"] < f["alto"]


def test_heavier_shirt_costs_more_at_the_factory(chain):
    by_id = {s["id"]: s for s in chain["escenarios"]}
    assert by_id["peso_min"]["fob_usd"] < by_id["base"]["fob_usd"] < by_id["peso_max"]["fob_usd"]


def test_cheaper_sale_comes_out_of_the_brand_profit(chain):
    by_id = {s["id"]: s for s in chain["escenarios"]}
    base, sale = by_id["base"], by_id["oferta_0"]
    lost = base["precio_usd"] - sale["precio_usd"]
    assert sale["fob_usd"] == pytest.approx(base["fob_usd"])
    # Shop and central costs are shares of the price, so they shrink with it.
    shares = chain["tienda"]["tienda"] + chain["tienda"]["marca"]
    assert base["ganancia_marca_usd"] - sale["ganancia_marca_usd"] == pytest.approx(
        lost * (1 - shares)
    )


def test_quote_months_must_be_in_fla(assumptions):
    monthly = _monthly()
    monthly["bloques"] = monthly["bloques"][:2]
    with pytest.raises(ReportError, match="bloques"):
        derive_chain(monthly, assumptions)


def test_every_assumption_names_its_source(tmp_path):
    data = json.loads(ASSUMPTIONS.read_text())
    bad = copy.deepcopy(data)
    del bad["parametros"]["merma_corte"]["url"]
    path = tmp_path / "cadena.json"
    path.write_text(json.dumps(bad))
    with pytest.raises(ReportError, match="merma_corte"):
        load_assumptions(path)
    bad = copy.deepcopy(data)
    bad["parametros"]["peso_prenda_g"]["valor"] = 500
    path.write_text(json.dumps(bad))
    with pytest.raises(ReportError, match="fuera"):
        load_assumptions(path)


def test_ranges_bracket_the_base_case(chain):
    by_id = {s["id"]: s for s in chain["escenarios"]}
    base = by_id["base"]
    r = chain["rangos"]
    assert r["lana_masa_usd"]["min"] == pytest.approx(by_id["peso_min"]["peinada_usd"])
    assert r["lana_masa_usd"]["min"] <= base["peinada_usd"] <= r["lana_masa_usd"]["max"]
    profit = r["ganancia_marca_usd"]
    assert profit["min"] <= base["ganancia_marca_usd"] <= profit["max"]
    # Sale-price rows are left out: they would drag the brand's profit below zero.
    assert r["ganancia_marca_usd"]["min"] > 0
    # Fine tops are not Argentine wool: they must not set the top of the wool share.
    assert r["lana_pct"]["max"] < by_id["peinada_fina"]["peinada_usd"] / base["precio_usd"]


def test_made_in_china_pays_both_china_surcharges(chain):
    by_id = {s["id"]: s for s in chain["escenarios"]}
    china, base = by_id["hecha_china"], by_id["base"]
    assert china["fob_usd"] == pytest.approx(base["fob_usd"])
    duty = china["importacion_usd"] - chain["parametros"]["flete_usd"]["valor"]
    assert duty == pytest.approx(china["fob_usd"] * (0.16 + 0.075 + 0.125))


def test_every_comparable_says_whether_it_was_reread(tmp_path):
    data = json.loads(ASSUMPTIONS.read_text())
    del data["comparables"][0]["releido"]
    path = tmp_path / "cadena.json"
    path.write_text(json.dumps(data))
    with pytest.raises(ReportError, match="releido"):
        load_assumptions(path)
