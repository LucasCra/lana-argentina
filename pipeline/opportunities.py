"""Where Argentine wool leaves the chain, and what each later stage would add.

`derive_opportunities(monthly, history, chain)` takes `derive.derive` output,
`history.derive_history` output and `chain.derive_chain` output and returns one
JSON-ready dict for oportunidades.html. That page also loads historia-data.js,
industria-data.js and cadena-data.js for the series those pages already hold;
this module adds only the arithmetic that joins them.

- `finura`: per season of the monthly reports, clean tons by micron band and
  product, and the share of each band's fibre that leaves uncombed (greasy or
  scoured, over greasy + scoured + tops; noils and by-products are left out
  because they only exist where someone combed). FLA prints tons by micron but
  no price by micron, so a band is the only way to compare stages for the same
  wool. Bands are unions of FLA's own rows; the build stops if a row straddles
  a band or the rows do not add up to the season's tons of a product.
- `brecha`: per monthly season, tops minus greasy USD per clean kilo. It pays
  scouring, combing and the noils lost on the way, and it mixes fineness: it
  is the sales a kilo gains by being combed here, not a combing margin. A
  season whose June carries FLA's annual adjustment for non-member exporters
  (a year of mostly cheap greasy wool booked in one month) also gets
  `sin_ajuste`: the same gap from the report blocks without that month. The
  combing opportunity uses it when present, since the adjustment's wool is
  not like the rest.
- `tramos`: the tee of cadena.html per kilo of the tops it uses: what each stage
  adds, how much of that is profit, and the share of the retail price that
  stays in a country the tee leaves at that stage. Duty and freight are marked
  `exogeno`: they are policy and logistics, outside this page's question.
- `oportunidades`: one row per stage the industry does not do at scale today,
  from combing more of its own wool to selling the garment. The volume base is
  the tee-grade band (up to TEE_MICRON) of the latest complete season and of the
  current one to date; value per kilo comes from `brecha` for combing and from
  `tramos` for the rest, so `techo_usd` is a ceiling: every kilo of that band
  taking that one step, at the tee's prices.
- `liquidacion`: greasy exports over production in the latest closed season.
  Above 1 the season sold stock, so its tonnages overstate a normal year.
"""

from __future__ import annotations

from typing import Any

from pipeline.parse import ReportError

# A next-to-skin merino tee: Icebreaker declares 18.9 µ for its own, and the
# chain page prices fine tops at 18.5 µ. FLA's row "18.50 18.90" closes the band.
TEE_MICRON = 18.9
BANDS = [
    ("superfina", None, 18.9),
    ("fina_1", 19.0, 19.9),
    ("fina_2", 20.0, 21.9),
    ("fina_3", 22.0, 24.5),
    ("mediana", 24.6, 29.9),
    ("gruesa", 30.0, None),
]
PRODUCTS = ["sucia", "lavada", "peinada", "blousse", "subproductos"]
UNCOMBED = ("sucia", "lavada")
FIBRE = ("sucia", "lavada", "peinada")
TONS_TOLERANCE = 1.0  # FLA's micron rows are rounded to 0.1 t each
EXOGENOUS = {"importacion"}
# Stages of the chain page's margin table that speak to each opportunity.
COMPARABLES = {
    "peinar": ("Peinado",),
    "hilar": ("Hilado",),
    "tejer": ("Tela", "Tela y prenda"),
    "confeccionar": ("Confección",),
    "vender": ("Marca", "Marca y tienda", "Tienda"),
}
# Opportunity -> the tee stage whose value added it takes (combing uses `brecha`).
STAGE = {"hilar": "hilado", "tejer": "tela", "confeccionar": "confeccion", "vender": "tienda"}
# A season's report blocks without, and only with, its annual-adjustment month.
Split = tuple[list[dict[str, Any]], list[dict[str, Any]]]


def derive_opportunities(
    monthly: dict[str, Any], history: dict[str, Any], chain: dict[str, Any]
) -> dict[str, Any]:
    seasons = sorted(monthly["temporadas"], key=lambda s: s["temporada"])
    splits = {s["temporada"]: _split_adjustment(s["temporada"], monthly) for s in seasons}
    finura = [_fineness(s, splits[s["temporada"]]) for s in seasons]
    brecha = [_gap(s, splits[s["temporada"]]) for s in seasons]
    tramos = _stages(chain)
    closed = max((s for s in finura if s["completa"]), key=lambda s: s["temporada"])
    current = finura[-1]
    bases = [closed] if current is closed else [closed, current]
    gaps = {g["temporada"]: g for g in brecha}
    by_stage = {t["id"]: t for t in tramos}
    rows = []
    for key in ("peinar", *STAGE):
        per_season = []
        for s in bases:
            tee = _band_tons(s, TEE_MICRON)
            if key == "peinar":
                gap = gaps[s["temporada"]]
                tons = sum(tee[p] for p in UNCOMBED)
                per_kg, profit_kg = (gap["sin_ajuste"] or gap)["usd_kg"], None
            else:
                stage = by_stage[STAGE[key]]
                tons, per_kg, profit_kg = tee["peinada"], stage["agrega_kg"], stage["ganancia_kg"]
            per_season.append(
                {
                    "temporada": s["temporada"],
                    "completa": s["completa"],
                    "t": tons,
                    "usd_kg": per_kg,
                    "ganancia_kg": profit_kg,
                    "techo_usd": tons * 1000 * per_kg,
                }
            )
        rows.append(
            {
                "id": key,
                "bases": per_season,
                "comparables": [c for c in chain["comparables"] if c["etapa"] in COMPARABLES[key]],
            }
        )
    last = max(history["temporadas"], key=lambda s: s["temporada"])
    balance = last["balance"]
    return {
        "micron_remera": TEE_MICRON,
        "finura": finura,
        "brecha": brecha,
        "tramos": tramos,
        "oportunidades": rows,
        "liquidacion": {
            "temporada": last["temporada"],
            "produccion": balance["produccion"],
            "exportado": balance["exportado"],
            "exportado_sobre_produccion": balance["exportado"] / balance["produccion"],
            "remanente_previo": balance["saldo_previo"],
            "remanente": balance["remanente_total"],
        },
    }


def _fineness(season: dict[str, Any], split: Split | None) -> dict[str, Any]:
    rows = [r for r in season["micrones"] if any(r.get(p) for p in PRODUCTS)]
    adjustment = split[1] if split else None
    bands = []
    used = 0
    for key, low, high in BANDS:
        inside = [r for r in rows if _within(r, low, high)]
        used += len(inside)
        tons = {p: sum(r.get(p) or 0.0 for r in inside) for p in PRODUCTS}
        fibre = sum(tons[p] for p in FIBRE)
        bands.append(
            {
                "id": key,
                "desde": low,
                "hasta": high,
                "t": tons,
                "sin_peinar_pct": sum(tons[p] for p in UNCOMBED) / fibre if fibre else None,
                # Tons of all products the adjustment month added to the band; FLA's
                # blocks print microns without the split by product.
                "ajuste_t": None
                if adjustment is None
                else sum(b["micrones"].get(r["rango"], 0.0) for b in adjustment for r in inside),
            }
        )
    if used != len(rows):
        raise ReportError(f"{season['temporada']}: a micron row straddles the page's bands")
    for p in PRODUCTS:
        total = sum(b["t"][p] for b in bands)
        if abs(total - season["toneladas"][p]) > TONS_TOLERANCE:
            raise ReportError(
                f"{season['temporada']}: micron rows of {p} add to {total:.1f} t,"
                f" the season to {season['toneladas'][p]:.1f} t"
            )
    return {
        "temporada": season["temporada"],
        "completa": season["completa"],
        "desde": season["desde"],
        "hasta": season["hasta"],
        "bandas": bands,
    }


def _within(row: dict[str, Any], low: float | None, high: float | None) -> bool:
    above = low is None or (row["desde"] is not None and row["desde"] >= low)
    below = high is None or (row["hasta"] is not None and row["hasta"] <= high)
    return above and below


def _band_tons(season: dict[str, Any], up_to: float) -> dict[str, float]:
    """Tons per product in the bands that end at or below `up_to` microns."""
    inside = [b for b in season["bandas"] if b["hasta"] is not None and b["hasta"] <= up_to]
    if not inside or inside[-1]["hasta"] != up_to:
        raise ReportError(f"no band closes at {up_to} µ")
    return {p: sum(b["t"][p] for b in inside) for p in PRODUCTS}


def _gap(season: dict[str, Any], split: Split | None) -> dict[str, Any]:
    price = season["usd_kg_producto"]
    return {
        "temporada": season["temporada"],
        "completa": season["completa"],
        **_gap_from(price["sucia"], price["peinada"]),
        "sin_ajuste": _gap_without_adjustment(*split) if split else None,
    }


def _gap_from(greasy: float, tops: float) -> dict[str, float]:
    return {"sucia": greasy, "peinada": tops, "usd_kg": tops - greasy, "prima": tops / greasy - 1}


def _split_adjustment(name: str, monthly: dict[str, Any]) -> Split | None:
    """The season's report blocks without and with its annual-adjustment month.

    None when the season has no adjustment. Blocks are differences between consecutive
    cumulative reports, so the kept blocks add up to the last report before the
    adjustment; a block that mixes the adjustment month with others cannot be split
    and stops the build.
    """
    adjusted = {m["mes"] for m in monthly["meses"] if m["temporada"] == name and m["ajuste_anual"]}
    if not adjusted:
        return None
    blocks = [b for b in monthly["bloques"] if b["temporada"] == name]
    mixed = [b for b in blocks if adjusted & set(b["meses"]) and not set(b["meses"]) <= adjusted]
    if mixed:
        raise ReportError(f"{name}: the adjustment month shares a report block with other months")
    kept = [b for b in blocks if not adjusted & set(b["meses"])]
    return kept, [b for b in blocks if b not in kept]


def _gap_without_adjustment(
    kept: list[dict[str, Any]], adjustment: list[dict[str, Any]]
) -> dict[str, Any]:
    tons = {p: sum(b["toneladas"].get(p, 0.0) for b in kept) for p in ("sucia", "peinada")}
    usd = {p: sum(b["ingresos"].get(p, 0.0) for b in kept) for p in ("sucia", "peinada")}
    return {
        **_gap_from(usd["sucia"] / tons["sucia"] / 1000, usd["peinada"] / tons["peinada"] / 1000),
        "meses_fuera": sorted(m for b in adjustment for m in b["meses"]),
    }


def _stages(chain: dict[str, Any]) -> list[dict[str, Any]]:
    tops_kg = chain["masas"]["peinada_g"] / 1000
    price = chain["precio_usd"]
    out = []
    for stage in chain["etapas"]:
        profit = sum(p["usd"] for p in stage["partes"] if p["clase"] == "ganancia")
        out.append(
            {
                "id": stage["id"],
                "agrega_usd": stage["agrega_usd"],
                "agrega_kg": stage["agrega_usd"] / tops_kg,
                "ganancia_usd": profit,
                "ganancia_kg": profit / tops_kg,
                "vende_usd": stage["vende_usd"],
                "queda_pct": stage["vende_usd"] / price,
                "exogeno": stage["id"] in EXOGENOUS,
            }
        )
    if abs(out[-1]["vende_usd"] - price) > 1e-6:
        raise ReportError("the tee's last stage does not sell at the retail price")
    return out
