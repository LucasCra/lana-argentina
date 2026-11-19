# Lana argentina

Sitio local con las estadísticas mensuales de exportación de la
[Federación Lanera Argentina](https://www.flasite.com/index.php/es/publicaciones/estadistica-mensual/mensuales-2026)
(informes EL 807 a EL 816: temporada 2025/26 completa y 2026/27 hasta octubre), y una página
histórica (`site/historia.html`) con los
[informes anuales](https://www.flasite.com/index.php/es/publicaciones/estadistica-anual-2018)
EL 488 a EL 812: temporadas 1998/99 a 2025/26.

## Ver el sitio

Abrí `site/index.html` en el navegador. No necesita servidor ni internet.

## Actualizar con un informe nuevo

```bash
uv run --frozen python build.py --fetch
```

`--fetch` lee las páginas de la FLA, baja los PDF mensuales que falten a `data/raw/` y los anuales a
`data/raw/anuales/`, y anota su URL en el `fuentes.json` de cada carpeta. Sin `--fetch`, sólo vuelve a leer los PDF que ya están. Para otro año,
agregá su página a `LISTING_PAGES` en `pipeline/fetch.py`.

El build se detiene si un PDF no cuadra con sus propios totales o trae un país o un formato
desconocido; el mensaje dice qué tabla falló. Un país nuevo se agrega en `COUNTRIES`
(`pipeline/parse.py`) y, para que tenga línea en el mapa, en `CENTROIDS` (`site/app.js`).

## Estructura

- `data/raw/` — los PDF mensuales tal como los publica la FLA; `data/raw/anuales/`, los anuales. No se editan.
- `pipeline/parse.py` — un PDF mensual → un diccionario con todas sus tablas, validadas contra sus totales.
- `pipeline/derive.py` — los informes mensuales → las series de `index.html` (meses, revisiones, bloques entre informes, temporadas).
- `pipeline/annual.py` — un PDF anual → una temporada cerrada. Desde 2005/06 usa los lectores de tablas de `parse.py`;
  hasta 2004/05 (otro método, destinos en peso efectivo) delega en `pipeline/annual_old.py`.
- `pipeline/history.py` — las temporadas → las series de `historia.html`.
- `build.py` — corre todo y escribe `data/processed/` (para revisar), `site/data.js` y `site/historia-data.js`.
- `site/` — `index.html` y `app.js` (temporada actual), `historia.html` y `historia.js` (1998/99 en adelante),
  `styles.css`; gráficos con ECharts, incluido en `site/vendor/`.

Los informes anuales no traen todos la misma información: la página histórica tiene una tabla de qué
serie hay para cada temporada, y lista las diferencias entre tablas de un mismo informe que el build
encuentra (vienen así en el PDF; no detienen el build).

## Verificación

```bash
uv run --frozen pytest -q
```

`tests/test_annual.py` lee los 28 PDF anuales (unos 25 s); `-m "not slow"` lo saltea.

```bash
uv run --frozen ruff check .
```
