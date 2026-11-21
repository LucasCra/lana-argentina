# Kit · chart excerpts

Two charts of the reference site that are not obvious to rebuild from a description, copied without changes from `site/app.js` at commit `0440132`. They are **wool example code**: the data keys are the reference site's Spanish ones (`destinos` destinations, `pais` country, `total` tons, `meses` months, `etiqueta` label, `usd_kg` dollars per kilo). Read them for the technique and write your own with your data keys. Both use the helpers of [page.js.md](page.js.md).

## World map with flow lines

One entry of `SPECS`. A `geo` component draws the map; a `map` series shades each country on the sequential ramp through a `visualMap`; a `lines` series draws one curve from the place to each destination, its width following the volume, with a dot travelling along it. The place itself is highlighted through `geo.regions`.

It leans on three lookups. `D.paises_mapa` comes from the pipeline: each country name as the source prints it → the country's name in the map file. `mapNameToEs` is its inverse, built in the page script. `CENTROIDS` is a table in the page script: country → `[longitude, latitude]`.

```js
    mapa: {
      seasonal: true,
      title: "A dónde va la lana",
      sub: () => `Toneladas limpias por país de destino, ${seasonLabel(S())}. El grosor de cada línea sigue al volumen.`,
      height: "map",
      foot: "Taiwán, si aparece, se dibuja dentro de China porque el mapa no tiene su contorno.",
      option() {
        const s = S();
        const byMap = {};
        for (const d of s.destinos) {
          const m = D.paises_mapa[d.pais];
          byMap[m] = (byMap[m] || 0) + d.total;
        }
        const max = Math.max(...Object.values(byMap));
        const ranked = [...s.destinos].sort((a, b) => b.total - a.total);
        const lines = ranked
          .filter((d) => CENTROIDS[d.pais])
          .map((d) => ({
            coords: [CENTROIDS.Argentina, CENTROIDS[d.pais]],
            value: d.total,
            name: d.pais,
            lineStyle: { width: 0.6 + 5 * Math.sqrt(d.total / ranked[0].total) },
          }));
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "item",
            formatter: (p) => {
              const names = p.seriesType === "lines" ? [p.name] : mapNameToEs[p.name] || [];
              const ds = s.destinos.filter((d) => names.includes(d.pais));
              if (!ds.length) return p.seriesType === "map" ? `${esc(p.name)}<br><span style="color:${C.muted}">sin exportaciones</span>` : "";
              return ds.map((d) => destinoTip(d, s)).join("<hr>");
            },
          },
          visualMap: {
            type: "continuous",
            min: 0,
            max,
            seriesIndex: 0,
            inRange: { color: C.seq },
            calculable: false,
            orient: "horizontal",
            left: 8,
            bottom: 8,
            itemWidth: 10,
            itemHeight: 140,
            text: [`${num(max)} t`, "0"],
            textStyle: { color: C.muted, fontSize: 11 },
          },
          geo: {
            map: "world",
            roam: false,
            zoom: 1.15,
            center: [10, 15],
            itemStyle: { areaColor: C.empty, borderColor: C.surface, borderWidth: 0.6 },
            emphasis: { itemStyle: { areaColor: C.seq[3] }, label: { show: false } },
            regions: [{ name: "Argentina", itemStyle: { areaColor: C.s2 }, label: { show: false } }],
            silent: false,
          },
          series: [
            {
              type: "map",
              geoIndex: 0,
              data: Object.entries(byMap).map(([name, value]) => ({ name, value })),
            },
            {
              type: "lines",
              coordinateSystem: "geo",
              effect: { show: true, period: 5, trailLength: 0, symbol: "circle", symbolSize: 3, color: C.s2 },
              lineStyle: { color: C.s2, opacity: 0.55, curveness: 0.25 },
              data: lines,
            },
          ],
        };
      },
      table: () => destinosTable(),
    },
```

The inverse lookup and the tooltip helper it uses:

```js
  const mapNameToEs = {};
  for (const [es, map] of Object.entries(D.paises_mapa)) (mapNameToEs[map] ??= []).push(es);

  function destinoTip(d, s) {
    const rows = PRODUCTS.filter((p) => d[p])
      .map((p) => `${swatch(pColor(p))}${PNAME[p]}: ${tons(d[p])}${s.ingresos ? "" : ""}`)
      .join("<br>");
    return `<b>${esc(d.pais)}</b><br>${tons(d.total)} · ${pct(d.total / s.total_t)} del total<br>${rows}`;
  }
```

## Sparkline inside a tile

The tile's markup holds an empty `<div class="spark" id="spark"></div>` under its figure; the stylesheet gives it 48 pixels of height. After writing the tiles, the page script draws a bare line with no axes and marks the last point. It is created once and kept in `instances`, so the resize handler reaches it too.

```js
    const spark = (instances.spark ??= echarts.init(document.getElementById("spark")));
    spark.setOption(
      {
        animation: false,
        grid: { left: 2, right: 6, top: 6, bottom: 2 },
        xAxis: { type: "category", show: false, data: months.map((m) => m.etiqueta) },
        yAxis: { type: "value", show: false, scale: true },
        tooltip: { ...base().tooltip, trigger: "axis", formatter: (p) => `${months[p[0].dataIndex].etiqueta}: ${perKg(p[0].value)}` },
        series: [
          {
            type: "line",
            data: months.map((m) => m.usd_kg),
            symbol: "none",
            lineStyle: { width: 2, color: C.past },
            markPoint: {
              symbol: "circle",
              symbolSize: 8,
              itemStyle: { color: C.s1, borderColor: C.surface, borderWidth: 2 },
              label: { show: false },
              data: [{ coord: [months.length - 1, months[months.length - 1].usd_kg] }],
            },
          },
        ],
      },
      true,
    );
```
