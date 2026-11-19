"""Read one FLA "Estadísticas Laneras Argentinas" monthly PDF into a plain dict.

`parse_report(path)` is the whole interface. It returns the report's identity
(number, issue date, season and months covered) and every numeric table, keyed
by Spanish canonical names (products: sucia, lavada, peinada, blousse,
subproductos, hilados, tejidos; fineness: fina, mediana, gruesa).

Guarantees:
- Blank cells are absent keys, never zero. Months the report has not reached
  yet (the `0,0` rows at the end of the monthly table) are dropped.
- Share rows, "Participación" columns and the printed micron averages are not
  read: they contain errors at source, and every share is recomputed downstream.
- Every table is checked against its own printed totals before returning.
  Any mismatch, unknown country, port or table layout raises `ReportError`.

All figures are season-to-date cumulative (the season runs July to June),
except the monthly table. Tons are clean basis except `base_sucia` and
`balance`, which are greasy basis.

Implementation decision worth knowing: tables are located by the first word of
their header row and columns by header name, because the PDF layout moves
between issues (spacer columns, a duplicated label column, one garbled header).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber

PRODUCTS = ["sucia", "lavada", "peinada", "blousse", "subproductos", "hilados", "tejidos"]
FINENESS = ["fina", "mediana", "gruesa"]
BALANCE_COLUMNS = [
    "saldo_previo",
    "produccion",
    "disponibilidad",
    "consumo_local",
    "exportado",
    "remanente",
]

MONTHS = {
    m: i + 1
    for i, m in enumerate(
        [
            "enero",
            "febrero",
            "marzo",
            "abril",
            "mayo",
            "junio",
            "julio",
            "agosto",
            "septiembre",
            "octubre",
            "noviembre",
            "diciembre",
        ]
    )
}

# Spanish name as printed -> name in the ECharts world map. Taken from the
# country list on page 1 of every report, plus countries seen in the tables.
COUNTRIES = {
    "Alemania": "Germany",
    "Andorra": "Andorra",
    "Angola": "Angola",
    "Arabia Saudita": "Saudi Arabia",
    "Australia": "Australia",
    "Austria": "Austria",
    "Bangladesh": "Bangladesh",
    "Bélgica": "Belgium",
    "Bolivia": "Bolivia",
    "Brasil": "Brazil",
    "Bulgaria": "Bulgaria",
    "Canadá": "Canada",
    "Chile": "Chile",
    "China": "China",
    "Chipre": "Cyprus",
    "Colombia": "Colombia",
    "Corea del Sur": "Korea",
    "Croacia": "Croatia",
    "Dinamarca": "Denmark",
    "Ecuador": "Ecuador",
    "Egipto": "Egypt",
    "Emiratos Árabes Unidos": "United Arab Emirates",
    "Eslovaquia": "Slovakia",
    "España": "Spain",
    "Estados Unidos": "United States",
    "Finlandia": "Finland",
    "Francia": "France",
    "Grecia": "Greece",
    "Guatemala": "Guatemala",
    "Hungría": "Hungary",
    "India": "India",
    "Indonesia": "Indonesia",
    "Irán": "Iran",
    "Israel": "Israel",
    "Italia": "Italy",
    "Japón": "Japan",
    "Kuwait": "Kuwait",
    "Letonia": "Latvia",
    "Líbano": "Lebanon",
    "Lituania": "Lithuania",
    "Malasia": "Malaysia",
    "Malta": "Malta",
    "Marruecos": "Morocco",
    "México": "Mexico",
    "Nueva Zelanda": "New Zealand",
    "Países Bajos": "Netherlands",
    "Paquistán": "Pakistan",
    "Paraguay": "Paraguay",
    "Perú": "Peru",
    "Polonia": "Poland",
    "Portugal": "Portugal",
    "Puerto Rico": "Puerto Rico",
    "Reino Unido": "United Kingdom",
    "República Checa": "Czech Rep.",
    "Rumania": "Romania",
    "Rusia": "Russia",
    "Singapur": "Singapore",
    "Sudáfrica": "South Africa",
    "Suecia": "Sweden",
    "Suiza": "Switzerland",
    "Tailandia": "Thailand",
    "Taiwán": "China",  # the bundled world map has no separate Taiwan shape
    "Turquía": "Turkey",
    "Ucrania": "Ukraine",
    "Uruguay": "Uruguay",
    "Venezuela": "Venezuela",
}

HEADER_KEYS = {
    "sucia": "sucia",
    "lavada": "lavada",
    "peinada": "peinada",
    "blousse": "blousse",
    "subproductos": "subproductos",
    "subproducto": "subproductos",
    "hilados": "hilados",
    "tejidos": "tejidos",
    "totales": "total",
    "total": "total",
    "particip.": "share",
    "participación": "share",
    "ingresos (u$s)": "ingresos",
    "fina": "fina",
    "mediana": "mediana",
    "gruesa": "gruesa",
}

PRODUCT_COLUMNS = [*PRODUCTS, "total", "share"]


class ReportError(ValueError):
    """The PDF does not match the expected layout or fails its own totals."""


def parse_report(path: Path) -> dict[str, Any]:
    """Parse one monthly report. Raises ReportError on any inconsistency."""
    with pdfplumber.open(path) as pdf:
        pages = [(page, page.find_tables()) for page in pdf.pages]
        text_p1 = pdf.pages[0].extract_text() or ""
        text_p2 = pdf.pages[1].extract_text() or ""

    report: dict[str, Any] = {"archivo": path.name, **_identity(text_p1, text_p2, path)}
    per_product: dict[str, list[dict[str, Any]]] = {}

    for page, tables in pages:
        for table in tables:
            rows = [_repair_row([_clean(c) for c in row]) for row in table.extract()]
            # One extracted box can hold several printed tables: split at each header.
            starts = _header_indexes(rows)
            for n, at in enumerate(starts):
                end = starts[n + 1] if n + 1 < len(starts) else len(rows)
                above = rows[starts[n - 1] + 1 if n else 0 : at]
                header, body = rows[at], rows[at + 1 : end]
                kind = _first_line(header[0])
                if kind == "Destino" and "sucia" in _header_keys(header):
                    report["destinos"], report["ingresos"] = _destinations(header, body)
                elif kind == "Destino":
                    product = _product_title(above, page, table.bbox)
                    per_product[product] = _fineness_rows(header, body, "pais")
                elif kind == "Productos":
                    report["finura"] = _products_by_fineness(header, body)
                elif kind == "Desde Hasta":
                    report["micrones"] = _microns(header, body)
                elif kind == "Puertos":
                    report["puertos"] = _ports(header, body)
                elif kind == "Mes":
                    report["mensual"] = _monthly(header, body)
                elif "sucia" in _header_keys(header):
                    report["base_sucia"] = _greasy_basis(header, body)
                else:
                    report["balance"] = _balance(body)

    report["por_producto"] = per_product
    # The July issue (first month of a season) prints no supply balance.
    report.setdefault("balance", None)
    missing = {"destinos", "finura", "micrones", "puertos", "mensual", "base_sucia"}
    missing -= report.keys()
    if missing:
        raise ReportError(f"{path.name}: tables not found: {sorted(missing)}")
    _check(report)
    return report


# ---------------------------------------------------------------- identity


def _identity(text_p1: str, text_p2: str, path: Path) -> dict[str, Any]:
    m = re.search(r"EL\s*(\d{3})\s*\((\d{2})/(\d{4})\)", text_p1)
    if not m:
        raise ReportError(f"{path.name}: report number not found on page 1")
    number, month, year = int(m[1]), int(m[2]), int(m[3])

    d = re.search(r"(\d{1,2}) de (\w+) del (\d{4})", text_p1)
    if not d:
        raise ReportError(f"{path.name}: issue date not found on page 1")
    issued = date(int(d[3]), MONTHS[d[2].lower()], int(d[1]))

    p = re.search(r"(\w+) (\d{4}) / (\w+) (\d{4}) \((\d+) mes", text_p2)
    if not p:
        raise ReportError(f"{path.name}: period not found on page 2")
    start = (int(p[2]), MONTHS[p[1].lower()])
    end = (int(p[4]), MONTHS[p[3].lower()])
    months = int(p[5])
    if start[1] != 7 or end != (year, month) or _month_span(start, end) != months:
        raise ReportError(f"{path.name}: inconsistent period {p[0]!r} for EL {number}")

    return {
        "numero": number,
        "emision": issued.isoformat(),
        "temporada": f"{start[0]}/{str(start[0] + 1)[2:]}",
        "desde": f"{start[0]}-{start[1]:02d}",
        "hasta": f"{end[0]}-{end[1]:02d}",
        "meses": months,
        "rectificativa": bool(re.search(r"rec", path.stem, re.IGNORECASE)),
    }


def _month_span(start: tuple[int, int], end: tuple[int, int]) -> int:
    return (end[0] - start[0]) * 12 + end[1] - start[1] + 1


# ---------------------------------------------------------------- tables


def _destinations(header: list[str], body: list[list[str]]):
    columns = _columns(header, PRODUCT_COLUMNS)
    rows, income = [], None
    for row in body:
        label = row[0]
        if label.startswith("Total"):
            totals = _values(row, columns, "tons")
            rows.append({"pais": "__total__", **totals})
        elif label.startswith("Participación"):
            continue
        elif label.startswith("Ingresos"):
            income = _values(row, columns, "tons")
        elif label:
            rows.append({"pais": _country(label), **_values(row, columns, "tons")})
    if income is None:
        raise ReportError("destination table has no income row")
    return rows, income


def _fineness_rows(header: list[str], body: list[list[str]], label_key: str):
    columns = _columns(header, [*FINENESS, "total", "share"])
    rows = []
    for row in body:
        label = row[0]
        if not label or label.startswith("Participación"):
            continue
        name = "__total__" if label.startswith("Total") else _country(label)
        rows.append({label_key: name, **_values(row, columns, "tons")})
    return rows


def _products_by_fineness(header: list[str], body: list[list[str]]):
    columns = _columns(header, [*FINENESS, "total", "share"])
    out = {}
    for row in body:
        label = row[0]
        if not label or label.startswith("Participación"):
            continue
        key = "__total__" if label.startswith("Total") else _product_label(label)
        out[key] = _values(row, columns, "tons")
    return out


def _microns(header: list[str], body: list[list[str]]):
    columns = _columns(header, PRODUCT_COLUMNS)
    rows = []
    for row in body:
        label = row[0]
        if label.startswith("Promedio"):
            continue
        if label.startswith("Total"):
            rows.append({"desde": None, "hasta": None, "rango": "__total__"})
        else:
            lo, hi = _micron_range(label)
            rows.append({"desde": lo, "hasta": hi, "rango": label})
        rows[-1].update(_values(row, columns, "tons"))
    return rows


def _micron_range(label: str) -> tuple[float | None, float | None]:
    m = re.fullmatch(r"(<<<|[\d.]+)\s+([\d.]+|>>>)", label)
    if not m:
        raise ReportError(f"unknown micron range {label!r}")
    lo = None if m[1] == "<<<" else float(m[1])
    hi = None if m[2] == ">>>" else float(m[2])
    return lo, hi


def _ports(header: list[str], body: list[list[str]]):
    columns = _columns(header, PRODUCT_COLUMNS)
    rows = []
    patagonian: bool | None = None  # set by the section header rows inside the table
    for row in body:
        label = row[0]
        if label.startswith("Puertos No Patag"):
            patagonian = False
            continue
        if label.startswith("Puertos Patag"):
            patagonian = True
            continue
        if not label or label.startswith(("Parciales", "Participación")):
            continue
        if label.startswith("Totales"):
            rows.append({"puerto": "__total__", **_values(row, columns, "tons")})
            continue
        if not re.fullmatch(r"[A-Za-zÁÉÍÓÚáéíóúñÑü .]+", label):
            continue  # text from the next table's title bleeding into this one
        if patagonian is None:
            raise ReportError(f"port {label!r} appears before any Patagonian/non-Patagonian header")
        rows.append(
            {
                "puerto": label,
                "patagonico": patagonian,
                **_values(row, columns, "tons"),
            }
        )
    return rows


def _monthly(header: list[str], body: list[list[str]]):
    columns = _columns(header, [*PRODUCTS, "total", "share", "ingresos"])
    rows = []
    for row in body:
        label = row[0]
        if label.startswith("Exportaci"):
            break  # the next table's title, caught inside this table's box
        if not label or label.startswith("Promedios"):
            continue
        m = re.match(r"(\w+) (\d{4})", label)
        if not m or m[1].lower() not in MONTHS:
            raise ReportError(f"unknown month label {label!r}")
        values = _values(row, columns, "tons")
        if not any(values.get(p) for p in PRODUCTS):
            continue  # month not reached yet: printed as 0,0 but means "no data"
        rows.append(
            {
                "mes": f"{m[2]}-{MONTHS[m[1].lower()]:02d}",
                "ajuste_anual": "*" in label,
                **values,
            }
        )
    return rows


def _greasy_basis(header: list[str], body: list[list[str]]):
    columns = _columns(header, [*PRODUCTS, "total"])
    out = {}
    for row in body:
        if not row[0]:
            continue
        key = "__total__" if row[0].startswith("Total") else _fineness_label(row[0])
        out[key] = _values(row, columns, "tons")
    return out


def _balance(body: list[list[str]]):
    out = {}
    for row in body:
        if not row[0]:
            continue
        key = "__total__" if row[0].startswith("Totales") else _fineness_label(row[0])
        cells = [c for c in row[1:] if c]
        if len(cells) != len(BALANCE_COLUMNS):
            raise ReportError(f"balance row {row!r} does not have six numbers")
        out[key] = {k: _number(c, "balance") for k, c in zip(BALANCE_COLUMNS, cells, strict=True)}
    return out


# ---------------------------------------------------------------- cells


def _clean(cell: str | None) -> str:
    return (cell or "").strip()


def _repair_row(row: list[str]) -> list[str]:
    """Undo a column-boundary slip: ['63,', '1 552,4'] was printed as 63,1 | 552,4."""
    for i in range(len(row) - 1):
        nxt = re.fullmatch(r"(\d)\s+(\S.*)", row[i + 1])
        if re.fullmatch(r"[\d.]+,", row[i]) and nxt:
            row[i] += nxt[1]
            row[i + 1] = nxt[2]
    return row


def _first_line(cell: str) -> str:
    return cell.split("\n")[0].strip()


HEADER_WORDS = ("Destino", "Productos", "Desde Hasta", "Puertos", "Mes", "Finura", "Finuras")


def _header_indexes(rows: list[list[str]]) -> list[int]:
    return [i for i, row in enumerate(rows) if _first_line(row[0]) in HEADER_WORDS]


def _header_keys(header: list[str]) -> list[str | None]:
    return [HEADER_KEYS.get(_first_line(c).lower()) for c in header]


def _columns(header: list[str], expected: list[str]) -> dict[str, int]:
    """Map canonical column names to cell indexes in this table's rows.

    By header name when every named header cell is recognised; by position
    among the named cells otherwise (one issue prints a garbled header).
    """
    named = [i for i, c in enumerate(header) if i > 0 and c and c != header[0]]
    keys = [HEADER_KEYS.get(_first_line(header[i]).lower()) for i in named]
    if None in keys:
        if len(named) != len(expected):
            raise ReportError(f"cannot map header {header!r}")
        keys = expected
    mapping = dict(zip(keys, named, strict=True))
    if set(mapping) != set(expected):
        raise ReportError(f"header {header!r} has columns {sorted(mapping)}, expected {expected}")
    return mapping


def _values(row: list[str], columns: dict[str, int], kind: str) -> dict[str, float]:
    out = {}
    for key, index in columns.items():
        if key == "share":
            continue
        cell = row[index] if index < len(row) else ""
        if cell:
            out[key] = _number(cell, kind)
    return out


def _number(cell: str, kind: str) -> float:
    """Spanish number: dot thousands, comma decimal. `kind` names the table."""
    text = cell.replace(" ", "").replace("µ", "")
    if not re.fullmatch(r"[\d.,]+", text):
        raise ReportError(f"not a number: {cell!r} in {kind} table")
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(".", "")
    return float(text)


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _country(label: str) -> str:
    # Cells hold the Spanish then the English name: "República Checa Czech Republic".
    for name in sorted(COUNTRIES, key=len, reverse=True):
        if label == name or label.startswith(name + " "):
            return name
    raise ReportError(f"unknown country {label!r}: add it to COUNTRIES")


def _product_label(label: str) -> str:
    word = _strip_accents(label.split()[0]).lower()
    if word not in PRODUCTS:
        raise ReportError(f"unknown product {label!r}")
    return word


def _fineness_label(label: str) -> str:
    word = label.split()[0].lower()
    if word not in FINENESS:
        raise ReportError(f"unknown fineness {label!r}")
    return word


def _product_title(rows_above: list[list[str]], page, bbox) -> str:
    """Name of the product a per-product table describes, from its title."""
    filled = [row for row in rows_above if any(row)]
    text = " ".join(c for c in filled[-1] if c) if filled else ""
    if not text.strip():
        top = max(0, bbox[1] - 25)
        text = page.crop((bbox[0], top, bbox[2], bbox[1])).extract_text() or ""
    squashed = _strip_accents(text.replace(" ", "").replace("\n", "")).lower()
    for product in PRODUCTS:
        if squashed.startswith(product):
            return product
    raise ReportError(f"cannot tell which product this table is: {text!r}")


# ---------------------------------------------------------------- checks


def _close(a: float, b: float, addends: int, label: str) -> None:
    # Each printed value is rounded to 0.1, so a sum may drift by 0.05 per addend.
    tolerance = 0.05 * addends + 0.051
    if abs(a - b) > tolerance:
        raise ReportError(f"{label}: {a:.2f} != {b:.2f}")


def _check_rows(rows: list[dict], keys: list[str], label: str, name_key: str) -> dict:
    total = next(r for r in rows if r[name_key] == "__total__")
    body = [r for r in rows if r[name_key] != "__total__"]
    for r in body:
        parts = [r[k] for k in keys if k in r]
        _close(sum(parts), r.get("total", 0.0), len(parts), f"{label} row {r[name_key]}")
    for k in [*keys, "total"]:
        parts = [r[k] for r in body if k in r]
        _close(sum(parts), total.get(k, 0.0), len(parts), f"{label} column {k}")
    return total


def _check(report: dict[str, Any]) -> None:
    name = report["archivo"]
    grand = _check_rows(report["destinos"], PRODUCTS, f"{name} destinos", "pais")
    total = grand["total"]

    for product, rows in report["por_producto"].items():
        t = _check_rows(rows, FINENESS, f"{name} {product}", "pais")
        _close(t["total"], grand.get(product, 0.0), 1, f"{name} {product} vs destinos")
    for product in PRODUCTS:
        if grand.get(product) and product not in report["por_producto"]:
            raise ReportError(f"{name}: no per-product table for {product}")

    fin = report["finura"]
    for key, row in fin.items():
        parts = [row[k] for k in FINENESS if k in row]
        _close(sum(parts), row["total"], len(parts), f"{name} finura {key}")
    _close(fin["__total__"]["total"], total, 1, f"{name} finura vs destinos")

    _check_rows(report["micrones"], PRODUCTS, f"{name} micrones", "rango")
    micron_total = next(r for r in report["micrones"] if r["rango"] == "__total__")
    _close(micron_total["total"], total, 1, f"{name} micrones vs destinos")

    _check_rows(report["puertos"], PRODUCTS, f"{name} puertos", "puerto")
    port_total = next(r for r in report["puertos"] if r["puerto"] == "__total__")
    _close(port_total["total"], total, 1, f"{name} puertos vs destinos")

    monthly = report["mensual"]
    if len(monthly) != report["meses"]:
        raise ReportError(f"{name}: {len(monthly)} monthly rows for {report['meses']} months")
    for r in monthly:
        parts = [r[k] for k in PRODUCTS if k in r]
        _close(sum(parts), r["total"], len(parts), f"{name} mensual {r['mes']}")
    _close(sum(r["total"] for r in monthly), total, len(monthly), f"{name} mensual vs destinos")
    income = sum(r["ingresos"] for r in monthly)
    if abs(income - report["ingresos"]["total"]) > 1.0 * len(monthly):
        raise ReportError(f"{name}: monthly income {income} != {report['ingresos']['total']}")
    parts = [report["ingresos"][p] for p in PRODUCTS if p in report["ingresos"]]
    if abs(sum(parts) - report["ingresos"]["total"]) > 1.0 * len(parts):
        raise ReportError(f"{name}: income by product does not add up")

    greasy = report["base_sucia"]
    for key, row in greasy.items():
        parts = [row[k] for k in PRODUCTS if k in row]
        _close(sum(parts), row["total"], len(parts), f"{name} base sucia {key}")

    for key, row in (report["balance"] or {}).items():
        # The EL 812 balance is printed in whole tons, so allow one ton per term.
        _close(row["saldo_previo"] + row["produccion"], row["disponibilidad"], 20, f"{name} {key}")
        _close(
            row["disponibilidad"] - row["consumo_local"] - row["exportado"],
            row["remanente"],
            30,
            f"{name} balance {key}",
        )
        if key in greasy:
            _close(row["exportado"], greasy[key]["total"], 20, f"{name} exportado {key}")
