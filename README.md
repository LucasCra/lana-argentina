# Lana argentina

Sitio local con las estadísticas mensuales de exportación de la
[Federación Lanera Argentina](https://www.flasite.com/index.php/es/publicaciones/estadistica-mensual/mensuales-2026)
(informes EL 807 a EL 816: temporada 2025/26 completa y 2026/27 hasta octubre).

## Ver el sitio

Abrí `site/index.html` en el navegador. No necesita servidor ni internet.

## Actualizar con un informe nuevo

```bash
uv run --frozen python build.py --fetch
```

`--fetch` lee la página de la FLA, baja los PDF que falten a `data/raw/` y anota su URL en
`data/raw/fuentes.json`. Sin `--fetch`, sólo vuelve a leer los PDF que ya están. Para otro año,
agregá su página a `LISTING_PAGES` en `pipeline/fetch.py`.

El build se detiene si un PDF no cuadra con sus propios totales o trae un país o un formato
desconocido; el mensaje dice qué tabla falló. Un país nuevo se agrega en `COUNTRIES`
(`pipeline/parse.py`) y, para que tenga línea en el mapa, en `CENTROIDS` (`site/app.js`).

## Estructura

- `data/raw/` — los PDF tal como los publica la FLA. No se editan.
- `pipeline/parse.py` — un PDF → un diccionario con todas sus tablas, validadas contra sus totales.
- `pipeline/derive.py` — los informes → las series del sitio (meses, revisiones, bloques entre informes, temporadas).
- `build.py` — corre todo y escribe `data/processed/informes.json` y `site/data.js`.
- `site/` — `index.html`, `app.js` (gráficos con ECharts, incluido en `site/vendor/`), `styles.css`.

## Verificación

```bash
uv run --frozen pytest -q
```

```bash
uv run --frozen ruff check .
```
