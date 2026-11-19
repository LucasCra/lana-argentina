"""Read an FLA annual report from before the 2005/06 change of method (EL 488-560).

Called by `annual.parse_annual`, which owns identity and the season check.
These issues measure a different thing from later ones, so only what can be
put next to them is read:

- `productos`: clean tons by product, from the "equivalente teórico base
  limpia" table, the only clean-basis table these issues print.
- `finura_antigua`: the same clean tons by the five fineness classes used
  then (fina up to 24.9 µ, cruza fina, mediana, criolla, gruesa), not the
  three used from 2005/06 (fina up to 24.5 µ, mediana, gruesa).
- `ingresos`: USD by product, printed in thousands of dollars.
- `destinos`: tons by country and product in shipped weight ("peso
  efectivo"): greasy wool at its greasy weight, everything else clean. Not
  comparable with later clean-basis destinations; `base` is "efectiva".
- `balance`: the season's totals row only (fineness rows have blank cells).

Products: EL 488-536 print eleven columns, folded into the later seven as
`FOLD` says (slipe into greasy, carbonised into scoured, finished goods into
fabrics, waste and miscellaneous into by-products). EL 548-560 print five.
Numbers use either decimal comma or decimal point; printed totals decide.

Monthly and port tables are not read: they are in shipped weight, and one of
each (EL 500 monthly, EL 524 ports) is a scanned image with no text.
"""

from __future__ import annotations

import re
from typing import Any

from pipeline import parse as P
from pipeline.annual import _balance_layout, check_balance
from pipeline.parse import COUNTRIES, PRODUCTS, ReportError

ELEVEN = [
    "sucia",
    "pelado",
    "lavada",
    "carbonizada",
    "peinada",
    "hilados",
    "tejidos",
    "terminados",
    "blousse",
    "desperdicios",
    "varios",
]
FIVE = ["sucia", "lavada", "peinada", "blousse", "subproductos"]
FOLD = {
    "pelado": "sucia",
    "carbonizada": "lavada",
    "terminados": "tejidos",
    "desperdicios": "subproductos",
    "varios": "subproductos",
}
OLD_FINENESS = ["fina", "cruza_fina", "mediana", "criolla", "gruesa"]

# Names as printed in these issues that differ from `COUNTRIES` once accents are dropped.
_ALIASES = {"REP CHECA": "República Checa", "PAKISTAN": "Paquistán", "HOLANDA": "Países Bajos"}


def parse_old(pdf, text: list[str], path, number: int) -> dict[str, Any]:
    name = path.name
    report: dict[str, Any] = {
        "archivo": name,
        "numero": number,
        "emision": None,  # these covers print only the month
        "base": "efectiva",
        "avisos": [],
    }
    joined = "\n".join(text)
    report["productos"], report["finura_antigua"], columns = _clean_equivalent(joined, name)
    report["ingresos"] = _income(joined, columns, name)
    report["destinos"] = _destinations(pdf, columns, name)
    report["balance"] = {"__total__": _balance_total(joined, name)}
    check_balance(report["balance"], name)

    shipped = next(r for r in report["destinos"] if r["pais"] == "__total__")
    for product in PRODUCTS:
        if product == "sucia" or not (shipped.get(product) or report["productos"].get(product)):
            continue
        # Shipped weight is clean weight for every product but greasy wool.
        try:
            P._close(shipped.get(product, 0), report["productos"].get(product, 0), 2, name)
        except ReportError as error:
            report["avisos"].append(f"{error} ({product}: destinos vs base limpia)")
    return report


# ---------------------------------------------------------------- numbers


def _num(token: str, kind: str) -> float | None:
    """'-' is blank. Decimal comma, or decimal point with one or two decimals."""
    if token in ("-", "—"):
        return None
    if "," in token:
        return P._number(token, kind)
    if re.fullmatch(r"-?\d+(\.\d{1,2})?", token):
        return float(token)
    raise ReportError(f"not a number: {token!r} in {kind} table")


def _is_number(token: str) -> bool:
    return bool(re.fullmatch(r"-?[\d.,]+%?|-|—", token))


def _fold(values: list[float | None], columns: list[str]) -> dict[str, float]:
    out: dict[str, float] = {}
    for column, value in zip(columns, values, strict=True):
        if value is None:
            continue
        key = FOLD.get(column, column)
        out[key] = round(out.get(key, 0.0) + value, 1)
    return out


# ---------------------------------------------------------------- tables


def _clean_equivalent(text: str, name: str):
    """Clean tons by fineness and product. Returns (by product, by fineness, columns)."""
    m = re.search(r"(?i)equivalente te[oó]rico base limpia", text)
    end = re.search(r"(?i)equivalente te[oó]rico base sucia", text[m.end() :]) if m else None
    if not m or not end:
        raise ReportError(f"{name}: clean-basis equivalent table not found")
    lines = text[m.end() : m.end() + end.start()].splitlines()

    rows: dict[str, list[float]] = {}
    total: list[float] | None = None
    for line in lines:
        tokens = line.split()
        label = " ".join(t for t in tokens if not _is_number(t)).lower()
        numbers = [t for t in tokens if _is_number(t) and "%" not in t]
        if len(numbers) < 6:
            continue
        key = _fineness(label)
        values = [_num(t, "base limpia") or 0.0 for t in numbers]
        if key:
            rows[key] = values
        elif label in ("", "totals", "totales totals") and rows:
            total = values
    if total is None or not rows:
        raise ReportError(f"{name}: clean-basis equivalent rows not found")

    columns = ELEVEN if len(total) >= len(ELEVEN) + 1 else FIVE
    width = len(columns) + 1
    for key in rows:
        rows[key] = rows[key][:width]
    total = total[:width]
    # `_close` allows 0.05 t per addend (values rounded to 0.1 t); EL 488-536 round to 1 t.
    per = 10 if all(v == int(v) for v in total) else 1
    for key, values in rows.items():
        P._close(sum(values[:-1]), values[-1], per * len(columns), f"{name} base limpia {key}")
    for i in range(width):
        label = f"{name} base limpia col {i}"
        P._close(sum(v[i] for v in rows.values()), total[i], per * len(rows), label)

    by_product = _fold(total[:-1], columns)
    by_product["total"] = total[-1]
    by_fineness = {key: values[-1] for key, values in rows.items()}
    by_fineness["total"] = total[-1]
    return by_product, by_fineness, columns


def _fineness(label: str) -> str | None:
    label = label.replace("c fina", "cruza fina")
    for key in ("cruza fina", "fina", "mediana", "criolla", "gruesa"):
        if label.startswith(key):
            return key.replace(" ", "_")
    return None


def _income(text: str, columns: list[str], name: str) -> dict[str, float]:
    m = re.search(r"^(?:u\$s \.000|ThousandDollarTotals U\$S) (.+)$", text, re.M)
    if not m:
        raise ReportError(f"{name}: income row not found")
    tokens = m[1].split()[: len(columns) + 1]
    values = [_num(t, "ingresos") for t in tokens]
    out = {k: v * 1000 for k, v in _fold(values[:-1], columns).items()}
    out["total"] = (values[-1] or 0.0) * 1000
    # Each value is rounded to the thousand dollars: allow 500 USD per addend.
    parts = sum(v for k, v in out.items() if k != "total")
    P._close(parts, out["total"], 10_000 * len(columns), f"{name} ingresos")
    return out


def _destinations(pdf, columns: list[str], name: str) -> list[dict[str, Any]]:
    """Tons by country and product (shipped weight), with the totals row last.

    EL 488-536 print "-" in blank cells, so each row is read in order. EL
    548-560 print nothing there, so numbers go to the column whose cell in the
    totals row (which has one in every column) is nearest horizontally.
    """
    for page in pdf.pages:
        lines = _lines(page.extract_words())
        totals_at = next(
            (i for i, ws in enumerate(lines) if _text(ws).startswith(("Tons Tons", "TonsTotals"))),
            None,
        )
        if totals_at is None:
            continue
        header_at = max(
            i
            for i, ws in enumerate(lines[:totals_at])
            if _text(ws).startswith(("Countries", "DESTINOS"))
        )
        width = len(columns) + 1  # products and total; a share column may follow
        anchors = [_center(w) for w in lines[totals_at] if _is_number(w["text"])][:width]
        rows = []
        for words in [*lines[header_at + 1 : totals_at], lines[totals_at]]:
            label = " ".join(w["text"] for w in words if not _is_number(w["text"]))
            numbers = [w for w in words if _is_number(w["text"])]
            if not numbers:
                continue  # a wrapped label or a heading line
            if columns is ELEVEN:
                cells = [_num(w["text"], "destinos") for w in numbers[:width]]
            else:
                cells = [None] * width
                for w in numbers:
                    i = min(range(width), key=lambda j: abs(anchors[j] - _center(w)))
                    if cells[i] is None:
                        cells[i] = _num(w["text"], "destinos")
                    elif i != width - 1:  # the share column lands on the total's anchor
                        raise ReportError(f"{name}: two numbers in one cell on row {label!r}")
            country = "__total__" if words is lines[totals_at] else _country(label, name)
            rows.append({"pais": country, **_fold(cells[:-1], columns), "total": cells[-1]})
        _check_table(rows, columns, name)
        return rows
    raise ReportError(f"{name}: destination table not found")


def _check_table(rows: list[dict[str, Any]], columns: list[str], name: str) -> None:
    """Rows and columns add up to their totals; EL 488-536 round to whole tons."""
    per = 10 if columns is ELEVEN else 1  # `_close` allows 0.05 per addend
    total = rows[-1]
    for r in rows[:-1]:
        parts = [r[k] for k in PRODUCTS if k in r]
        P._close(sum(parts), r["total"], per * len(columns), f"{name} destinos {r['pais']}")
    for k in [*PRODUCTS, "total"]:
        parts = [r[k] for r in rows[:-1] if k in r]
        P._close(sum(parts), total.get(k, 0.0), per * len(parts), f"{name} destinos {k}")


def _lines(words: list[dict]) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (round(w["top"]), w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) < 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: w["x0"]) for line in lines]


def _text(words: list[dict]) -> str:
    return " ".join(w["text"] for w in words)


def _center(word: dict) -> float:
    return (word["x0"] + word["x1"]) / 2


def _country(label: str, name: str) -> str:
    plain = P._strip_accents(label).upper().strip()
    if plain in _ALIASES:
        return _ALIASES[plain]
    for country in COUNTRIES:
        if P._strip_accents(country).upper() == plain:
            return country
    raise ReportError(f"{name}: unknown country {label!r}: add it to COUNTRIES")


def _balance_total(text: str, name: str) -> dict[str, float]:
    heading = (
        r"(?i)balance final lanas|final (?:wool )?balance sheet (?:for wool|- season)"
        r"|balance de lana "
    )
    m = re.search(heading, text)
    if not m:
        raise ReportError(f"{name}: wool balance not found")
    total = re.search(r"^(?:TOTALES|Totales) Totals ((?:-?[\d.,]+ ?)+)$", text[m.end() :], re.M)
    if not total:
        raise ReportError(f"{name}: wool balance totals row not found")
    values = [_num(t, "balance") or 0.0 for t in total[1].split()]
    layout = _balance_layout(values)
    if layout is None:
        raise ReportError(f"{name}: balance totals {values} match no known layout")
    return dict(zip(layout, values, strict=True))
