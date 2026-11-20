"""Checks for pipeline/opportunities.py on small hand-made inputs (no PDFs)."""

import copy

import pytest

from pipeline.opportunities import TEE_MICRON, derive_opportunities
from pipeline.parse import ReportError


def _row(low, high, **tons):
    return {"desde": low, "hasta": high, **tons}


def _season(name, complete, scale=1.0):
    rows = [
        _row(None, 16.4),  # empty row: FLA prints it with no tons
        _row(16.5, 18.4, sucia=10 * scale, peinada=20 * scale, blousse=5 * scale),
        _row(18.5, 18.9, sucia=30 * scale, lavada=10 * scale, peinada=20 * scale),
        _row(19.0, 19.9, sucia=40 * scale, peinada=60 * scale),
        _row(20.0, 21.9, peinada=100 * scale),
        _row(30.0, 30.9, sucia=200 * scale, subproductos=7 * scale),
        _row(32.6, None, lavada=3 * scale),
    ]
    tons = {p: sum(r.get(p, 0.0) for r in rows) for p in ("sucia", "lavada", "peinada")}
    tons |= {"blousse": 5 * scale, "subproductos": 7 * scale}
    return {
        "temporada": name,
        "completa": complete,
        "desde": f"{name[:4]}-07",
        "hasta": f"{int(name[:4]) + 1}-06" if complete else f"{name[:4]}-10",
        "micrones": rows,
        "toneladas": tons,
        "usd_kg_producto": {"sucia": 6.0, "peinada": 10.0},
    }


def _monthly():
    return {"temporadas": [_season("2026/27", False, 0.5), _season("2025/26", True)]}


def _history():
    balance = {
        "saldo_previo": 50_000.0,
        "produccion": 30_000.0,
        "exportado": 45_000.0,
        "remanente": 33_000.0,
        "remanente_total": 33_100.0,
    }
    return {"temporadas": [{"temporada": "2025/26", "balance": balance}]}


def _chain():
    def stage(sid, sells, adds, parts):
        return {"id": sid, "vende_usd": sells, "agrega_usd": adds, "partes": parts}

    return {
        "precio_usd": 100.0,
        "masas": {"peinada_g": 200.0},
        "etapas": [
            stage("peinada", 2.0, 2.0, [{"id": "peinada", "usd": 2.0, "clase": "materia"}]),
            stage(
                "hilado",
                4.0,
                2.0,
                [{"usd": 1.5, "clase": "costo"}, {"usd": 0.5, "clase": "ganancia"}],
            ),
            stage(
                "tela",
                10.0,
                6.0,
                [{"usd": 5.0, "clase": "costo"}, {"usd": 1.0, "clase": "ganancia"}],
            ),
            stage(
                "confeccion",
                14.0,
                4.0,
                [{"usd": 3.0, "clase": "costo"}, {"usd": 1.0, "clase": "ganancia"}],
            ),
            stage("importacion", 20.0, 6.0, [{"usd": 6.0, "clase": "impuesto"}]),
            stage(
                "tienda",
                100.0,
                80.0,
                [{"usd": 70.0, "clase": "costo"}, {"usd": 10.0, "clase": "ganancia"}],
            ),
        ],
        "comparables": [
            {"etapa": "Peinado", "empresa": "A"},
            {"etapa": "Tela y prenda", "empresa": "B"},
            {"etapa": "Marca", "empresa": "C"},
        ],
    }


def test_bands_and_uncombed_share():
    out = derive_opportunities(_monthly(), _history(), _chain())
    closed = next(s for s in out["finura"] if s["temporada"] == "2025/26")
    bands = {b["id"]: b for b in closed["bandas"]}
    assert bands["superfina"]["t"] == {
        "sucia": 40.0,
        "lavada": 10.0,
        "peinada": 40.0,
        "blousse": 5.0,
        "subproductos": 0.0,
    }
    # Noils stay out of the share: (40 + 10) / (40 + 10 + 40).
    assert bands["superfina"]["sin_peinar_pct"] == pytest.approx(50 / 90)
    assert bands["fina_3"]["sin_peinar_pct"] is None  # nothing in the band: no share, not zero
    assert bands["gruesa"]["t"]["lavada"] == 3.0  # the open-ended last row lands in the last band
    assert [s["temporada"] for s in out["finura"]] == ["2025/26", "2026/27"]


def test_combing_uses_the_price_gap_and_later_stages_the_tee():
    out = derive_opportunities(_monthly(), _history(), _chain())
    rows = {r["id"]: r for r in out["oportunidades"]}
    assert list(rows) == ["peinar", "hilar", "tejer", "confeccionar", "vender"]
    comb = rows["peinar"]["bases"][0]
    assert (comb["temporada"], comb["t"], comb["usd_kg"]) == ("2025/26", 50.0, 4.0)
    assert comb["techo_usd"] == pytest.approx(50 * 1000 * 4.0)
    spin = rows["hilar"]["bases"][0]
    # Tee-grade tops (40 t) times what spinning adds per kilo of tops: 2 USD / 0.2 kg.
    assert (spin["t"], spin["usd_kg"], spin["ganancia_kg"]) == (40.0, 10.0, 2.5)
    assert rows["hilar"]["bases"][1]["t"] == 20.0  # current season to date, half the tons
    assert [c["empresa"] for c in rows["tejer"]["comparables"]] == ["B"]
    assert out["micron_remera"] == TEE_MICRON


def test_stage_shares_and_exogenous_flag():
    out = derive_opportunities(_monthly(), _history(), _chain())
    stages = {t["id"]: t for t in out["tramos"]}
    assert stages["confeccion"]["queda_pct"] == pytest.approx(0.14)
    assert stages["tienda"]["queda_pct"] == 1.0
    assert stages["importacion"]["exogeno"] and not stages["tela"]["exogeno"]
    assert out["liquidacion"]["exportado_sobre_produccion"] == pytest.approx(1.5)


def test_rows_that_do_not_add_up_stop_the_build():
    monthly = _monthly()
    monthly["temporadas"][1]["toneladas"]["peinada"] += 5.0
    with pytest.raises(ReportError, match="micron rows of peinada"):
        derive_opportunities(monthly, _history(), _chain())


def test_a_row_across_a_band_edge_stops_the_build():
    monthly = copy.deepcopy(_monthly())
    monthly["temporadas"][1]["micrones"].append(_row(18.5, 19.4, sucia=1.0))
    monthly["temporadas"][1]["toneladas"]["sucia"] += 1.0
    with pytest.raises(ReportError, match="straddles"):
        derive_opportunities(monthly, _history(), _chain())
