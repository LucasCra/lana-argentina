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
  price, which is the US customs value, plus freight per shirt. The
  made-in-Argentina scenarios swap only that rate: the US one for Argentine
  goods, or the EU's Mercosur rate in its first year and once it reaches zero.
  They keep the factory price (the model has no Argentine factory costs), the
  freight and the US shelf price, and charge the EU rate on the factory price
  although the EU's customs value includes freight.
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
    params = [*data["parametros"].items()]
    params += [(f"algodon.{k}", p) for k, p in data["algodon"]["parametros"].items()]
    for key, p in params:
        if p["tipo"] not in TYPES:
            raise ReportError(f"{key}: tipo desconocido {p['tipo']!r}")
        if p["tipo"] != "supuesto" and not (p.get("fuente") and p.get("url")):
            raise ReportError(f"{key}: le falta fuente o url")
        if "min" in p and not p["min"] <= p["valor"] <= p["max"]:
            raise ReportError(
                f"{key}: el valor {p['valor']} está fuera de [{p['min']}, {p['max']}]"
            )
    for c in data["comparables"]:
        if not c.get("url") or not isinstance(c.get("releido"), bool):
            raise ReportError(f"{c['empresa']}: le falta url o releido")
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
    us_argentina = base["nmf"] + base["argentina"]
    # The EU cuts its rate in equal yearly steps, the first on entry into force:
    # year 0 already pays one step less than the base rate, and the last step is zero.
    eu = P["arancel_ue"]
    eu_first = eu["valor"] * (1 - 1 / eu["etapas"])
    eu_free_from = eu["anio_0"] + eu["etapas"] - 1
    scenarios = [
        (
            "base",
            "base",
            "Caso base",
            f"Peinada argentina de {fla['cerrada']['temporada']}",
            central,
        ),
        (
            "peinada_actual",
            "peinada",
            f"Peinada {actual['temporada']}",
            f"Precio FLA de {actual['temporada']} hasta {actual['hasta']}",
            run(peinada=actual["usd_kg"]),
        ),
        (
            "peinada_fina",
            "peinada",
            "Peinada fina de 18,5 µ",
            "Peinada australiana del listado de Vercelli",
            run(peinada=base["peinada_fina"]),
        ),
        (
            "fabrica_bajo",
            "fabrica",
            "Fábrica barata",
            "Tela al precio del aviso más barato",
            run(fabrica="bajo"),
        ),
        (
            "fabrica_alto",
            "fabrica",
            "Fábrica cara",
            "Remera terminada al precio más alto pedido",
            run(fabrica="alto"),
        ),
        (
            "peso_min",
            "masa",
            f"Remera de {_es(P['peso_prenda_g']['min'])} g",
            "El peso más bajo publicado",
            run(peso=P["peso_prenda_g"]["min"]),
        ),
        (
            "peso_max",
            "masa",
            f"Remera de {_es(P['peso_prenda_g']['max'])} g",
            "El peso más alto publicado",
            run(peso=P["peso_prenda_g"]["max"]),
        ),
        (
            "mermas_min",
            "masa",
            "Mermas mínimas",
            "Hilado, tejido y corte en su mínimo",
            run(**{k: P[name]["min"] for k, name in losses.items()}),
        ),
        (
            "mermas_max",
            "masa",
            "Mermas máximas",
            "Hilado, tejido y corte en su máximo",
            run(**{k: P[name]["max"] for k, name in losses.items()}),
        ),
        (
            "sin_301",
            "arancel",
            "Sin el recargo a Vietnam",
            "Sólo el arancel general, si se anula la Sección 301",
            run(arancel=base["nmf"]),
        ),
        (
            "hecha_china",
            "arancel",
            "Hecha en China",
            f"Arancel de {_es(100 * (base['nmf'] + base['china']))} %, "
            "como la partida que otra tienda lista hecha en China",
            run(arancel=base["nmf"] + base["china"]),
        ),
        (
            "hecha_argentina",
            "arancel",
            "Argentina a EE. UU.",
            f"Hecha en la Argentina; sólo cambia el arancel: {_es(100 * us_argentina)} %, "
            "el general más la Sección 301 a la Argentina",
            run(arancel=us_argentina),
        ),
        (
            "argentina_ue_inicio",
            "arancel",
            f"Argentina a la UE, {eu['anio_0']}",
            f"Hecha en la Argentina; sólo cambia el arancel: {_es(100 * eu_first, 1)} %, "
            "primer año del acuerdo UE–Mercosur",
            run(arancel=eu_first),
        ),
        (
            "argentina_ue_libre",
            "arancel",
            f"Argentina a la UE, {eu_free_from}",
            "Hecha en la Argentina; sólo cambia el arancel: libre al terminar la desgravación",
            run(arancel=0.0),
        ),
        *[
            (
                f"oferta_{i}",
                "venta",
                f"Vendida a {_es(price, 2)}",
                "Precio de oferta de la misma ficha",
                run(precio=price),
            )
            for i, price in enumerate(P["precios_oferta_usd"]["valor"])
        ],
    ]
    summaries = [_summary(*s) for s in scenarios]
    return {
        "producto": assumptions["producto"],
        "peinada": {**fla, "fina": {"usd_kg": base["peinada_fina"], "cotizaciones": quotes}},
        "precio_usd": base["precio"],
        "arancel": {
            "nmf": base["nmf"],
            "s301": base["s301"],
            "china": base["china"],
            "argentina": base["argentina"],
            "ue": {"inicio": eu_first, "anio_0": eu["anio_0"], "libre_desde": eu_free_from},
            "total": base["arancel"],
        },
        "tienda": {"tienda": base["tienda"], "marca": base["marca"]},
        **central,
        "fabrica": {k: _ladder({**base, "fabrica": k})["fob_usd"] for k in FACTORY},
        "escenarios": summaries,
        "rangos": _ranges(summaries, base["precio"]),
        "parametros": P,
        "comparables": assumptions["comparables"],
        "algodon": _cotton(assumptions),
    }


LB_PER_KG = 2.20462262


def _cotton(assumptions: dict[str, Any]) -> dict[str, Any]:
    """The same ladder for a premium cotton tee, from lint at the Cotlook A Index.

    The ladder keeps the wool tee's stage ids: its first stage ("peinada") is the
    lint the spinner buys, and the fibre share is cotton's. Lint is priced
    delivered to Asian ports, the same for every spinner, so nothing is passed
    through at a price difference. Knitting and cutting losses, freight, the
    workshop margin and the shop shares are the wool tee's; the rest is in
    the "algodon" block of data/cadena.json.
    """
    W = {k: p["valor"] for k, p in assumptions["parametros"].items()}
    cotton = assumptions["algodon"]
    v = {k: p["valor"] for k, p in cotton["parametros"].items()}
    lint = v["indice_a"] / 100 * LB_PER_KG
    shop = W["tienda_canada_goose"]
    base = {
        "precio": v["precio_tienda_usd"],
        "peso": v["peso_prenda_g"],
        "lana": v["algodon_frac"],
        "m_hilado": v["merma_hilado"],
        "m_tejido": W["merma_tejido"],
        "m_corte": W["merma_corte"],
        "peinada": lint,
        "peinada_fina": lint,
        "hilado_fino": v["hilado_usd_kg"],
        "materiales": v["materiales_usd"],
        "confeccion": v["confeccion_usd"],
        "embalaje": v["embalaje_usd"],
        "tela_catalogo": v["tela_catalogo_usd_kg"],
        "fob_alto": v["fob_alto_usd"],
        "flete": W["flete_usd"],
        "arancel": v["arancel_nmf"] + v["arancel_301"],
        "g_hilado": v["margen_hilado"],
        "g_tela": v["margen_tela"],
        "g_confeccion": W["margen_confeccion"],
        "tienda": shop["dtc_margen_bruto"] - shop["dtc_margen_operativo"],
        "marca": shop["gastos_corporativos_mcad"] / shop["ingresos_totales_mcad"],
        "fabrica": "central",
    }
    # As for the wool tee: the cost sheet's materials over this tee's fabric.
    base["tela_hoja"] = base["materiales"] / (_masses(base)["tela_g"] / 1000)
    central = _ladder(base)
    variants = {k: _ladder({**base, "fabrica": k}) for k in FACTORY}
    return {
        "producto": cotton["producto"],
        "fibra": {"usd_kg": lint, "centavos_lb": v["indice_a"]},
        "precio_usd": base["precio"],
        "arancel": {
            "nmf": v["arancel_nmf"],
            "s301": v["arancel_301"],
            "total": base["arancel"],
            # A tee that qualifies under the US–Peru agreement pays only the surcharge.
            "ahorro_tlc_usd": central["fob_usd"] * v["arancel_nmf"],
        },
        **central,
        "fabrica": {k: ladder["fob_usd"] for k, ladder in variants.items()},
        # Brand and shop keep what the factory does not: their share moves with its price.
        "marca_tienda_usd": {
            k: ladder["etapas"][-1]["agrega_usd"] for k, ladder in variants.items()
        },
        "parametros": cotton["parametros"],
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
        "china": v["arancel_china"],
        "argentina": v["arancel_301_argentina"],
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


def _ranges(summaries: list[dict[str, Any]], price: float) -> dict[str, dict[str, float]]:
    """How far the headline figures move across the scenarios, at full price.

    The wool's dollars move only with grams (weight and losses); its share also
    with the season's price. The fine-tops case is not Argentine wool, so it is
    left out of the wool share but kept for brand and shop.
    """
    full = [s for s in summaries if s["precio_usd"] == price]

    def span(xs: list[float]) -> dict[str, float]:
        return {"min": min(xs), "max": max(xs)}

    grams = [s["peinada_usd"] for s in summaries if s["grupo"] in ("base", "masa")]
    return {
        "lana_masa_usd": span(grams),
        "lana_pct": span([s["peinada_usd"] / price for s in full if s["id"] != "peinada_fina"]),
        "marca_tienda_pct": span([s["marca_tienda_usd"] / price for s in full]),
        "ganancia_marca_usd": span([s["ganancia_marca_usd"] for s in full]),
    }


def _summary(id_: str, group: str, name: str, what: str, ladder: dict[str, Any]) -> dict[str, Any]:
    s = {x["id"]: x for x in ladder["etapas"]}
    price = s["tienda"]["vende_usd"]
    factory = sum(s[k]["agrega_usd"] for k in ("hilado", "tela", "confeccion"))
    profit = next(x["usd"] for x in s["tienda"]["partes"] if x["id"] == "ganancia")
    return {
        "id": id_,
        "grupo": group,
        "nombre": name,
        "cambio": what,
        "precio_usd": price,
        "peinada_g": ladder["masas"]["peinada_g"],
        "peinada_usd": s["peinada"]["vende_usd"],
        "fabrica_usd": factory,
        **{f"{k}_usd": s[k]["agrega_usd"] for k in ("hilado", "tela", "confeccion")},
        "fob_usd": ladder["fob_usd"],
        "importacion_usd": s["importacion"]["agrega_usd"],
        "marca_tienda_usd": s["tienda"]["agrega_usd"],
        "ganancia_marca_usd": profit,
    }
