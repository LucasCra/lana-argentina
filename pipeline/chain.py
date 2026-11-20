"""One merino T-shirt, from Argentine tops to the shop shelf.

`derive_chain(monthly, assumptions)` takes `derive.derive` output (for FLA's
tops price) and the parsed data/cadena.json (`load_assumptions`), and returns
one JSON-ready dict for cadena.html. Every number on that page is computed
here; the page only formats.

How the chain is built, per shirt:

- Mass balance. Garment weight -> fabric bought (cutting loss) -> yarn bought
  (knitting and finishing loss) -> wool in that yarn (wool share) -> tops
  bought (spinning loss). The spinner also buys the nylon core, so its cost
  stays inside the spinning stage.
- Raw material. Tops at FLA's export price (USD per clean kg, FOB) for the
  latest complete season. FLA classes most Argentine tops as fine (up to
  24.5 µ) but prints no price by micron; a next-to-skin tee uses finer wool,
  which the fine-tops scenario prices.
- Factory stages. The one published per-garment cost sheet for a merino tee
  (Quince: materials, crafting, packaging) anchors the factory-gate price, so
  the anchor is a fine-wool tee. With Argentine tops every stage from yarn on
  costs less by tops mass x (fine price - Argentine price): processors are
  assumed to pass the fibre through at cost. Yarn is priced from a fine-yarn
  listing, fabric with trims from the cost sheet. The cheapest fabric listing
  gives the low bound of the factory-gate price; asking prices for finished
  tees give the high one.
- Import. US duty (MFN plus Section 301 for Vietnam) on the factory-gate
  price, which is the US customs value, plus freight per shirt.
- Brand and shop. Retail price minus landed cost. Shop and central costs are
  Canada Goose's direct-to-consumer shares of sales; profit is the remainder,
  so the three parts add up to the residual by construction.
- Profit at the factory stages: a listed company's operating margin times the
  stage's sales; costs are value added minus that profit. These are proxies
  for whole companies, not for this product.
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import mean
from typing import Any

from pipeline.parse import ReportError

TYPES = {"fla", "fuente", "inferencia", "supuesto"}
FACTORY = ("bajo", "central", "alto")


def load_assumptions(path: Path) -> dict[str, Any]:
    """Read data/cadena.json and check that every parameter says where it comes from."""
    data = json.loads(path.read_text())
    for key, p in data["parametros"].items():
        if p["tipo"] not in TYPES:
            raise ReportError(f"{key}: tipo desconocido {p['tipo']!r}")
        if p["tipo"] != "supuesto" and not (p.get("fuente") and p.get("url")):
            raise ReportError(f"{key}: le falta fuente o url")
        if "min" in p and not p["min"] <= p["valor"] <= p["max"]:
            raise ReportError(
                f"{key}: el valor {p['valor']} está fuera de [{p['min']}, {p['max']}]"
            )
    return data


def derive_chain(monthly: dict[str, Any], assumptions: dict[str, Any]) -> dict[str, Any]:
    P = assumptions["parametros"]
    quotes = [{**q, "usd_kg": q["eur_kg"] * q["usd_eur"]} for q in P["peinada_fina"]["valor"]]
    fla = _fla_tops(monthly, sorted({q["fecha"][:7] for q in quotes}))
    base = _params(P, fla["cerrada"]["usd_kg"], mean(q["usd_kg"] for q in quotes))
    # Quince prints materials per shirt and no weight: assume its tee weighs like this
    # one, so the sheet becomes a price per kilo of fabric that weight and losses move.
    base["tela_hoja"] = base["materiales"] / (_masses(base)["tela_g"] / 1000)
    central = _ladder(base)

    def run(**change: Any) -> dict[str, Any]:
        return _ladder({**base, **change})

    losses = {"m_hilado": "merma_hilado", "m_tejido": "merma_tejido", "m_corte": "merma_corte"}
    actual = fla["actual"]
    scenarios = [
        ("base", "Caso base", f"Peinada argentina de {fla['cerrada']['temporada']}", central),
        (
            "peinada_actual",
            f"Peinada {actual['temporada']}",
            f"Precio FLA de {actual['temporada']} hasta {actual['hasta']}",
            run(peinada=actual["usd_kg"]),
        ),
        (
            "peinada_fina",
            "Peinada fina de 18,5 µ",
            "Peinada australiana del listado de Vercelli",
            run(peinada=base["peinada_fina"]),
        ),
        (
            "fabrica_bajo",
            "Fábrica barata",
            "Tela al precio del aviso más barato",
            run(fabrica="bajo"),
        ),
        (
            "fabrica_alto",
            "Fábrica cara",
            "Remera terminada al precio más alto pedido",
            run(fabrica="alto"),
        ),
        (
            "peso_min",
            f"Remera de {_es(P['peso_prenda_g']['min'])} g",
            "El peso más bajo publicado",
            run(peso=P["peso_prenda_g"]["min"]),
        ),
        (
            "peso_max",
            f"Remera de {_es(P['peso_prenda_g']['max'])} g",
            "El peso más alto publicado",
            run(peso=P["peso_prenda_g"]["max"]),
        ),
        (
            "mermas_min",
            "Mermas mínimas",
            "Hilado, tejido y corte en su mínimo",
            run(**{k: P[name]["min"] for k, name in losses.items()}),
        ),
        (
            "mermas_max",
            "Mermas máximas",
            "Hilado, tejido y corte en su máximo",
            run(**{k: P[name]["max"] for k, name in losses.items()}),
        ),
        (
            "sin_301",
            "Sin el recargo a Vietnam",
            "Sólo el arancel general, si se anula la Sección 301",
            run(arancel=base["nmf"]),
        ),
        *[
            (
                f"oferta_{i}",
                f"Vendida a {_es(price, 2)}",
                "Precio de oferta de la misma ficha",
                run(precio=price),
            )
            for i, price in enumerate(P["precios_oferta_usd"]["valor"])
        ],
    ]
    return {
        "producto": assumptions["producto"],
        "peinada": {**fla, "fina": {"usd_kg": base["peinada_fina"], "cotizaciones": quotes}},
        "precio_usd": base["precio"],
        "arancel": {"nmf": base["nmf"], "s301": base["s301"], "total": base["arancel"]},
        "tienda": {"tienda": base["tienda"], "marca": base["marca"]},
        **central,
        "fabrica": {k: _ladder({**base, "fabrica": k})["fob_usd"] for k in FACTORY},
        "escenarios": [_summary(id_, name, what, ladder) for id_, name, what, ladder in scenarios],
        "parametros": P,
        "comparables": assumptions["comparables"],
    }


def _fla_tops(monthly: dict[str, Any], quote_months: list[str]) -> dict[str, Any]:
    """FLA's tops price: latest closed season, current season to date, and the quote months."""
    seasons = monthly["temporadas"]
    closed = max((s for s in seasons if s["completa"]), key=lambda s: s["temporada"])
    current = max(seasons, key=lambda s: s["temporada"])
    blocks = [b for b in monthly["bloques"] if set(b["meses"]) <= set(quote_months)]
    covered = sorted({m for b in blocks for m in b["meses"]})
    if covered != quote_months:
        raise ReportError(f"FLA no tiene bloques mensuales para {quote_months}")
    provisional = [
        m["mes"]
        for m in monthly["meses"]
        if m["temporada"] == current["temporada"] and m["provisional"]
    ]

    def price(t: float, usd: float) -> float:
        return usd / (t * 1000)

    return {
        "cerrada": {
            "temporada": closed["temporada"],
            "numero": closed["numero"],
            "t": closed["toneladas"]["peinada"],
            "usd": closed["ingresos"]["peinada"],
            "usd_kg": price(closed["toneladas"]["peinada"], closed["ingresos"]["peinada"]),
            "fina_pct": closed["finura"]["peinada"]["fina"] / closed["finura"]["peinada"]["total"],
        },
        "actual": {
            "temporada": current["temporada"],
            "hasta": current["hasta"],
            "provisionales": provisional,
            "usd_kg": price(current["toneladas"]["peinada"], current["ingresos"]["peinada"]),
        },
        "mismos_meses": {
            "meses": quote_months,
            "usd_kg": price(
                sum(b["toneladas"]["peinada"] for b in blocks),
                sum(b["ingresos"]["peinada"] for b in blocks),
            ),
        },
    }


def _params(P: dict[str, Any], tops: float, fine_tops: float) -> dict[str, Any]:
    v = {k: p["valor"] for k, p in P.items()}
    shop = v["tienda_canada_goose"]
    return {
        "precio": v["precio_tienda_usd"],
        "peso": v["peso_prenda_g"],
        "lana": v["lana_frac"],
        "m_hilado": v["merma_hilado"],
        "m_tejido": v["merma_tejido"],
        "m_corte": v["merma_corte"],
        "peinada": tops,
        "peinada_fina": fine_tops,
        "hilado_fino": v["hilado_fino_usd_kg"],
        "materiales": v["materiales_usd"],
        "confeccion": v["confeccion_usd"],
        "embalaje": v["embalaje_usd"],
        "tela_catalogo": v["tela_catalogo_usd_kg"],
        "fob_alto": v["fob_alto_usd"],
        "flete": v["flete_usd"],
        "nmf": v["arancel_nmf"],
        "s301": v["arancel_301"],
        "arancel": v["arancel_nmf"] + v["arancel_301"],
        "g_hilado": v["margen_hilado"],
        "g_tela": v["margen_tela"],
        "g_confeccion": v["margen_confeccion"],
        "tienda": shop["dtc_margen_bruto"] - shop["dtc_margen_operativo"],
        "marca": shop["gastos_corporativos_mcad"] / shop["ingresos_totales_mcad"],
        "fabrica": "central",
    }


def _ladder(p: dict[str, Any]) -> dict[str, Any]:
    """The shirt's masses and the value of each stage, for one set of parameters."""
    m = _masses(p)
    fabric_g, yarn_g, tops_g = m["tela_g"], m["hilado_g"], m["peinada_g"]
    wool_g = m["lana_hilado_g"]

    tops = tops_g / 1000 * p["peinada"]
    cheaper = tops_g / 1000 * (p["peinada_fina"] - p["peinada"])
    yarn = yarn_g / 1000 * p["hilado_fino"] - cheaper
    workshop = p["confeccion"] + p["embalaje"]
    sheet = {
        "bajo": fabric_g / 1000 * p["tela_catalogo"],
        "central": fabric_g / 1000 * p["tela_hoja"],
        "alto": p["fob_alto"] - workshop,
    }[p["fabrica"]]
    fabric = sheet - cheaper
    fob = fabric + workshop
    duty = fob * p["arancel"]
    landed = fob + duty + p["flete"]
    shop = p["precio"] * p["tienda"]
    brand = p["precio"] * p["marca"]

    stages = [
        _stage("peinada", 0.0, tops, tops_g, [("peinada", tops, "materia")]),
        _factory("hilado", tops, yarn, yarn_g, p["g_hilado"], tops_g - wool_g),
        _factory("tela", yarn, fabric, fabric_g, p["g_tela"], yarn_g - fabric_g),
        _factory("confeccion", fabric, fob, p["peso"], p["g_confeccion"], fabric_g - p["peso"]),
        _stage(
            "importacion",
            fob,
            landed,
            p["peso"],
            [("flete", p["flete"], "costo"), ("arancel", duty, "impuesto")],
        ),
        _stage(
            "tienda",
            landed,
            p["precio"],
            p["peso"],
            [
                ("tienda", shop, "costo"),
                ("marca", brand, "costo"),
                ("ganancia", p["precio"] - landed - shop - brand, "ganancia"),
            ],
        ),
    ]
    for s in stages[1:4]:
        if s["agrega_usd"] < 0:
            raise ReportError(f"la etapa {s['id']} vende por menos de lo que compra")
    return {
        "masas": m,
        "etapas": stages,
        "fob_usd": fob,
        "tela_hoja_usd_kg": sheet / (fabric_g / 1000),
    }


def _masses(p: dict[str, Any]) -> dict[str, float]:
    """Grams at each stage: garment, fabric bought, yarn bought, wool in it, tops bought."""
    fabric_g = p["peso"] / (1 - p["m_corte"])
    yarn_g = fabric_g / (1 - p["m_tejido"])
    wool_g = yarn_g * p["lana"]
    return {
        "prenda_g": p["peso"],
        "lana_prenda_g": p["peso"] * p["lana"],
        "tela_g": fabric_g,
        "lana_tela_g": fabric_g * p["lana"],
        "hilado_g": yarn_g,
        "lana_hilado_g": wool_g,
        "nailon_g": yarn_g - wool_g,
        "peinada_g": wool_g / (1 - p["m_hilado"]),
    }


def _es(x: float, decimals: int = 0) -> str:
    """A number as the page writes it: 1.234,50."""
    return f"{x:,.{decimals}f}".replace(",", " ").replace(".", ",").replace(" ", ".")


def _stage(id_: str, bought: float, sold: float, kg_g: float, parts: list[tuple]) -> dict[str, Any]:
    return {
        "id": id_,
        "compra_usd": bought,
        "vende_usd": sold,
        "agrega_usd": sold - bought,
        "partes": [{"id": k, "usd": usd, "clase": kind} for k, usd, kind in parts],
        "salida_g": kg_g,
        "usd_kg": sold / (kg_g / 1000),
        "multiplicador": sold / bought if bought else None,
    }


def _factory(
    id_: str, bought: float, sold: float, kg_g: float, margin: float, lost_g: float
) -> dict[str, Any]:
    profit = margin * sold
    stage = _stage(
        id_,
        bought,
        sold,
        kg_g,
        [("costos", sold - bought - profit, "costo"), ("ganancia", profit, "ganancia")],
    )
    return {**stage, "margen": margin, "merma_g": lost_g}


def _summary(id_: str, name: str, what: str, ladder: dict[str, Any]) -> dict[str, Any]:
    s = {x["id"]: x for x in ladder["etapas"]}
    price = s["tienda"]["vende_usd"]
    factory = sum(s[k]["agrega_usd"] for k in ("hilado", "tela", "confeccion"))
    profit = next(x["usd"] for x in s["tienda"]["partes"] if x["id"] == "ganancia")
    return {
        "id": id_,
        "nombre": name,
        "cambio": what,
        "precio_usd": price,
        "peinada_g": ladder["masas"]["peinada_g"],
        "peinada_usd": s["peinada"]["vende_usd"],
        "fabrica_usd": factory,
        "fob_usd": ladder["fob_usd"],
        "importacion_usd": s["importacion"]["agrega_usd"],
        "marca_tienda_usd": s["tienda"]["agrega_usd"],
        "ganancia_marca_usd": profit,
    }
