# Lana argentina

Sitio local con las estadísticas mensuales de exportación de la
[Federación Lanera Argentina](https://www.flasite.com/index.php/es/publicaciones/estadistica-mensual/mensuales-2026)
(informes EL 807 a EL 816: temporada 2025/26 completa y 2026/27 hasta octubre), y una página
histórica (`site/historia.html`) con los
[informes anuales](https://www.flasite.com/index.php/es/publicaciones/estadistica-anual-2018)
EL 488 a EL 812: temporadas 1998/99 a 2025/26. La página `site/industria.html` responde qué se fabrica
en el país con esa lana: etapa en que se exporta, consumo industrial interno, precio por kilo en cada
etapa, comercio de hilados, telas y prendas de lana (UN Comtrade, 2000 en adelante) y quién industrializa.
La página `site/cadena.html` sigue una remera de merino (Smartwool, 95 dólares) desde la peinada argentina, al
precio de exportación de la FLA, hasta la tienda: cuánto agrega cada etapa y cuánto de eso es costo y ganancia.

## Ver el sitio

Abrí `site/index.html` en el navegador. No necesita servidor ni internet.

## Actualizar con un informe nuevo

```bash
uv run --frozen python build.py --fetch
```

`--fetch` lee las páginas de la FLA, baja los PDF mensuales que falten a `data/raw/` y los anuales a
`data/raw/anuales/`, baja de la API pública de UN Comtrade los años que falten a `data/raw/comercio/`
(unos dos minutos: la API admite una consulta por segundo), y anota su URL en el `fuentes.json` de cada
carpeta. Un año de Comtrade ya bajado no se vuelve a pedir; para refrescarlo, borrá su archivo. Sin `--fetch`, sólo vuelve a leer los PDF que ya están. Para otro año,
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
- `pipeline/comtrade.py` — baja y suma el comercio de lana por etapa: lo que informa Argentina
  (`comtrade-AAAA.json`), lo que los demás países dicen importar de Argentina (`espejo-AAAA.json`) y los
  orígenes de las importaciones del último año (`origenes-AAAA.json`).
- `pipeline/industry.py` — consumo interno, hilados y tejidos de la FLA y lana peinada por año calendario
  → `industria.html`, junto con lo de `comtrade.py`.
- `data/cadena.json` — los supuestos de la remera (precio, peso, mermas, precios de cada etapa, aranceles,
  márgenes de referencia), cada uno con su fuente, su tipo (fuente, inferencia o supuesto) y si se releyó en el
  original. Se edita a mano; el build se detiene si a un parámetro le falta la fuente o sale de su rango.
- `pipeline/chain.py` — el precio FLA de la peinada y `data/cadena.json` → la cadena de `cadena.html`: gramos
  por etapa, valor de cada etapa, costos y ganancia, y los escenarios.
- `build.py` — corre todo y escribe `data/processed/` (para revisar), `site/data.js`, `site/historia-data.js`,
  `site/industria-data.js` y `site/cadena-data.js`.
- `site/` — `index.html` y `app.js` (temporada actual), `historia.html` y `historia.js` (1998/99 en adelante),
  `industria.html` y `industria.js` (lee también `historia-data.js`), `cadena.html` y `cadena.js`, `styles.css`;
  gráficos con ECharts, incluido en `site/vendor/`.

Para lana sucia, lavada y peinada la página de industria usa la FLA, no Comtrade: desde 2018 lo que
Argentina informa a Comtrade queda por debajo de la FLA y de lo que declaran los compradores (la página
lo muestra en un gráfico de control).

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
