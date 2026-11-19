"""Download FLA monthly reports that are not yet in `data/raw`.

`fetch_new(raw_dir, pages)` reads each listing page, downloads every linked PDF
under /images/pdf/estadisticas/ that is not already on disk, and records each
file's source URL in `raw_dir/fuentes.json`. Existing files are never touched:
raw PDFs are evidence. Returns the names of the files it downloaded.

Downloads go through the system `curl`, not urllib: the python.org build of
Python on macOS ships without a certificate bundle and fails every HTTPS call.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

BASE = "https://www.flasite.com"
LISTING_PAGES = [
    f"{BASE}/index.php/es/publicaciones/estadistica-mensual/mensuales-2026",
]
# Annual (June) issues go to their own folder: they share numbers with monthly ones.
ANNUAL_PAGES = [f"{BASE}/index.php/es/publicaciones/estadistica-anual-2018"]
_USER_AGENT = "Mozilla/5.0 (compatible; lana-argentina-local/0.1)"


def fetch_new(raw_dir: Path, pages: list[str] = LISTING_PAGES) -> list[str]:
    raw_dir.mkdir(parents=True, exist_ok=True)
    sources = load_sources(raw_dir)
    downloaded = []
    for page in pages:
        html = _get(page).decode("utf-8", errors="replace")
        for href in sorted(set(re.findall(r'href="(/images/pdf/estadisticas/[^"]+\.pdf)"', html))):
            url = BASE + href
            name = Path(href).name
            sources.setdefault(name, url)
            target = raw_dir / name
            if target.exists():
                continue
            target.write_bytes(_get(url))
            downloaded.append(name)
    (raw_dir / "fuentes.json").write_text(json.dumps(sources, indent=2, sort_keys=True) + "\n")
    return downloaded


def load_sources(raw_dir: Path) -> dict[str, str]:
    path = raw_dir / "fuentes.json"
    return json.loads(path.read_text()) if path.exists() else {}


def _get(url: str) -> bytes:
    result = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--fail",
            "--location",
            "--max-time",
            "60",
            "--user-agent",
            _USER_AGENT,
            url,
        ],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed for {url}: {result.stderr.decode().strip()}")
    return result.stdout
