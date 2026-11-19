"""Read one FLA annual report ("Estadísticas Laneras Argentinas", June issue) into a dict.

`parse_annual(path)` is the whole interface. It returns one season's closing
figures, keyed like `parse.parse_report` where the information is the same:

- `numero`, `temporada` ("2008/09"), `emision`, `archivo`, `base`.
- `base` says what the destination and port tables measure. "limpia" (clean
  tons) from 2005/06 on. "efectiva" (shipped weight: greasy wool at its greasy
  weight) up to 2004/05, when FLA changed method; those older issues are read by
  `pipeline.annual_old` and carry fewer tables (see its docstring).
- `productos`: clean tons by product, and `ingresos`: USD by product, both with
  a "total" key. These two exist for every season.
- `destinos`, `finura`, `micrones`, `puertos`, `mensual`, `base_sucia`: the
  tables of the June monthly issue, as `parse.parse_report` reads them.
- `balance`: the season's greasy supply balance as printed, with
  `stock_operativo` (pipeline stock) and `exportable` where the issue prints
  them, and `remanente_total` = availability - local use - exports, which is
  the carryover the next season starts from in every issue after 2003/04.

Every table is checked against its own totals and against the front page.
Any mismatch, unknown country or layout raises `ReportError`.

Implementation decision worth knowing: tables are found with the monthly
parser's row readers. The annual issue adds sheepskin tables up to 2016/17
(headers "Secos", "Curtidos"), which are skipped, and a second balance table
(next season's availability); the season's balance is the one whose exports
equal the greasy-basis export total.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber

from pipeline import parse as P
from pipeline.parse import FINENESS, MONTHS, PRODUCTS, ReportError

FIRST_ISSUE = 488  # EL 488 closes season 1998/99; one annual issue every 12 numbers
FIRST_SEASON = 1998
LAST_SHIPPED_WEIGHT_SEASON = 2004  # 2004/05 is the last season reported in shipped weight

_HEADERS = {"Destino", "Productos", "DesdeHasta", "Puertos", "Mes", "Finura", "Finuras"}
_SKIN_WORDS = ("Secos", "Curtidos", "Pickelados")


def season_label(start_year: int) -> str:
    return f"{start_year}/{str(start_year + 1)[2:]}"


def season_of_issue(number: int) -> int:
    """Start year of the season an annual issue closes, from its number."""
    if (number - FIRST_ISSUE) % 12:
        raise ReportError(f"EL {number} is not a June (annual) issue")
    return FIRST_SEASON + (number - FIRST_ISSUE) // 12


def parse_annual(path: Path) -> dict[str, Any]:
    with pdfplumber.open(path) as pdf:
        text = [page.extract_text() or "" for page in pdf.pages]
        number = _number_on_cover(text, path)
        start = season_of_issue(number)
        if start <= LAST_SHIPPED_WEIGHT_SEASON:
            from pipeline.annual_old import parse_old

            report = parse_old(pdf, text, path, number)
        else:
            report = _parse_clean(pdf, text, path, number)
    report["temporada"] = season_label(start)
    _check_period(text, start, path)
    return report


def _number_on_cover(text: list[str], path: Path) -> int:
    for page in text[:2]:
        m = re.search(r"\bEL\s*(\d{3})\b", page) or re.search(r"^(\d{3})\s", page, re.M)
        if m:
            return int(m[1])
    m = re.search(r"(\d{3})", path.stem)
    if not m:
        raise ReportError(f"{path.name}: report number not found")
    return int(m[1])


def _check_period(text: list[str], start: int, path: Path) -> None:
    """The printed period must be the season the issue number implies."""
    joined = "\n".join(text)
    pattern = (
        rf"(?i)(julio\s*(?:de\s*)?{start}\s*/\s*junio\s*(?:de\s*)?{start + 1}"
        rf"|julio\s*{str(start)[2:]}\s*/\s*junio\s*{str(start + 1)[2:]}"
        rf"|julio/junio\s*{start}/{str(start + 1)[2:]}"
        rf"|07/{start}\s*-\s*06/{start + 1}|\(06/{start + 1}\))"
    )
    if not re.search(pattern, joined):
        raise ReportError(f"{path.name}: period July {start} / June {start + 1} not printed")


def issue_date(cover: str, path: Path) -> str:
    d = re.search(r"(\d{1,2}) de (\w+) del? (\d{4})", cover)
    if not d or d[2].lower() not in MONTHS:
        raise ReportError(f"{path.name}: issue date not found on page 1")
    return date(int(d[3]), MONTHS[d[2].lower()], int(d[1])).isoformat()


# ---------------------------------------------------------------- 2005/06 onward


def _parse_clean(pdf, text: list[str], path: Path, number: int) -> dict[str, Any]:
    report: dict[str, Any] = {
        "archivo": path.name,
        "numero": number,
        "emision": issue_date(text[0], path),
        "base": "limpia",
        "meses": 12,
    }
    balances: list[dict[str, dict[str, float]]] = []

    for page in pdf.pages:
        for table in page.find_tables():
            rows = [P._repair_row([P._clean(c) for c in row]) for row in table.extract()]
            starts = [i for i, row in enumerate(rows) if _kind(row) in _HEADERS]
            for n, at in enumerate(starts):
                end = starts[n + 1] if n + 1 < len(starts) else len(rows)
                header, body = rows[at], rows[at + 1 : end]
                kind = _kind(header)
                if any(w in c for c in header for w in _SKIN_WORDS):
                    continue
                keys = P._header_keys(header)
                if kind == "Destino" and "sucia" in keys:
                    if "destinos" in report:
                        raise ReportError(f"{path.name}: two wool destination tables")
                    report["destinos"], report["ingresos"] = P._destinations(header, body)
                elif kind == "Destino":
                    continue  # per-product tables: not used, and misprinted in some issues
                elif kind == "Productos":
                    body = _labelled(body, [*PRODUCTS, "total", "partici"])
                    report["finura"] = P._products_by_fineness(header, body)
                elif kind == "DesdeHasta":
                    report["micrones"] = P._microns(header, body)
                elif kind == "Puertos":
                    report["puertos"] = P._ports(header, body)
                elif kind == "Mes":
                    report["mensual"] = P._monthly(header, body)
                elif "sucia" in keys:
                    body = _labelled(body, [*FINENESS, "total"])
                    report["base_sucia"] = P._greasy_basis(header, body)
                else:
                    balance = _balance_rows(body)
                    if balance:
                        balances.append(balance)

    missing = {"destinos", "finura", "micrones", "puertos", "mensual", "base_sucia"}
    missing -= report.keys()
    if missing:
        raise ReportError(f"{path.name}: tables not found: {sorted(missing)}")
    report["balance"] = None  # checked below, with this module's column layouts
    report["avisos"] = []
    P._check(report, warn=report["avisos"].append)
    report["balance"] = _season_balance(balances, report["base_sucia"], path)

    total = next(r for r in report["destinos"] if r["pais"] == "__total__")
    report["productos"] = {k: v for k, v in total.items() if k != "pais"}
    _check_cover(text[0], report, path)
    del report["meses"]
    return report


def _kind(row: list[str]) -> str:
    return P._first_line(row[0]).replace(" ", "")


def _labelled(body: list[list[str]], words: list[str]) -> list[list[str]]:
    """Rows whose label starts with one of `words`; drops the next table's title."""
    out = []
    for row in body:
        first = P._strip_accents(row[0]).lower()
        if not first or any(first.startswith(w) for w in words):
            out.append(row)
    return out


def _balance_rows(body: list[list[str]]) -> dict[str, list[float]]:
    """Rows of a balance-like table by fineness, or {} if it is not one.

    One issue (EL 776) prints the balance without row labels; its four rows are
    then fine, medium, coarse and total in that order, which `_season_balance`
    confirms against the greasy-basis table.
    """
    out = {}
    unlabelled = iter([*FINENESS, "__total__"])
    for row in body:
        cells = [c for c in row[1:] if c]
        if not cells:
            continue
        label = row[0].split()[0].lower() if row[0] else next(unlabelled, "")
        key = "__total__" if label == "totales" else label
        if key not in (*FINENESS, "__total__"):
            continue
        try:
            out[key] = [P._number(c, "balance") for c in cells]
        except ReportError:
            return {}  # a table of percentage changes, not tons
    return out if "__total__" in out else {}


# Column layouts of the season balance. Seven-column issues print either the
# exportable carryover (2008/09 on) or the pipeline stock (2007/08) in column 5;
# `_balance_layout` tells them apart by which one makes the row add up.
_START = ["saldo_previo", "produccion", "disponibilidad", "consumo_local"]
_END = ["exportado", "remanente"]
_BALANCE_LAYOUTS = [
    [*_START, *_END],
    [*_START, "exportable", *_END],
    [*_START, "stock_operativo", *_END],
    [*_START, "stock_operativo", "exportable", *_END],
]


def _balance_layout(total: list[float]) -> list[str] | None:
    for layout in _BALANCE_LAYOUTS:
        if len(layout) != len(total):
            continue
        r = dict(zip(layout, total, strict=True))
        left = r["disponibilidad"] - r["consumo_local"] - r.get("stock_operativo", 0.0)
        if abs(left - r.get("exportable", r["exportado"] + r["remanente"])) <= 30:
            return layout
    return None


def _season_balance(candidates, greasy, path: Path) -> dict[str, dict[str, float]]:
    exported = greasy["__total__"]["total"]
    for table in candidates:
        layout = _balance_layout(table["__total__"])
        if layout is None:
            continue
        if abs(table["__total__"][layout.index("exportado")] - exported) > 20:
            continue
        out = {}
        for key, values in table.items():
            if len(values) != len(layout):
                # A blank cell (e.g. no carryover for one fineness): only totals are reliable.
                continue
            out[key] = dict(zip(layout, values, strict=True))
        check_balance(out, path.name)
        for key in FINENESS:
            if key in out and key in greasy:
                P._close(out[key]["exportado"], greasy[key]["total"], 20, f"{path.name} {key}")
        return out
    raise ReportError(f"{path.name}: no balance table whose exports match {exported:.0f} t")


def check_balance(balance: dict[str, dict[str, float]], name: str) -> None:
    """Check each row's arithmetic and add `remanente_total`. Whole tons: 1 t per term."""
    for key, row in balance.items():
        P._close(
            row["saldo_previo"] + row["produccion"], row["disponibilidad"], 20, f"{name} {key}"
        )
        rest = row["disponibilidad"] - row["consumo_local"] - row["exportado"]
        P._close(rest - row.get("stock_operativo", 0.0), row["remanente"], 30, f"{name} {key}")
        row["remanente_total"] = round(rest, 1)


def _check_cover(cover: str, report: dict[str, Any], path: Path) -> None:
    """Front-page clean tons and income must match the tables when printed."""
    flat = re.sub(r"\s+", " ", cover)
    tons = re.search(r"Limpia:? ([\d.]+,\d+) toneladas", flat) or re.search(
        r"base limpia:? ([\d.]+,\d+) toneladas", flat, re.I
    )
    if tons:
        P._close(P._number(tons[1], "cover"), report["productos"]["total"], 20, f"{path.name} tapa")
    usd = re.search(r"Ingreso de divisas (?:u\$s )?([\d.]+(?:,\d+)?)", flat)
    # Some covers round income to the thousand dollars.
    if usd and abs(P._number(usd[1], "cover") - report["ingresos"]["total"]) > 1000:
        raise ReportError(f"{path.name}: cover income {usd[1]} != {report['ingresos']['total']}")


# ---------------------------------------------------------------- production history


def production_history(path: Path) -> list[dict[str, Any]]:
    """The "Producción de lana, últimas N zafras" table (greasy tons by fineness).

    Up to 2004/05 FLA splits fine, fine crossbred, medium crossbred and coarse;
    from 2005/06 fine, medium and coarse. Printed shares are ignored. Each row
    must add up to its printed total within one ton per class.
    """
    with pdfplumber.open(path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages[:4])
    rows = []
    for m in re.finditer(r"^(\d{4})/(\d{4}) ([\d.,% ]+)$", text, re.M):
        tokens = m[3].split()
        tons = [int(t.replace(".", "")) for t in tokens if "%" not in t]
        classes = ["fina", "cruza_fina", "mediana", "gruesa"] if len(tons) == 5 else [*FINENESS]
        if len(tons) not in (4, 5):
            raise ReportError(f"{path.name}: production row {m[0]!r}")
        *parts, total = tons
        if abs(sum(parts) - total) > len(parts):
            raise ReportError(f"{path.name}: production {m[1]} adds to {sum(parts)} not {total}")
        by_class = dict(zip(classes, parts, strict=True))
        rows.append({"temporada": season_label(int(m[1])), "total": total, **by_class})
    if not rows:
        raise ReportError(f"{path.name}: production history not found")
    return rows
