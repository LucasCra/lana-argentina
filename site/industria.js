// Dibuja la página de industria a partir de window.INDUSTRIA y window.HISTORIA
// (generados por build.py). La aritmética de fondo está en pipeline/industry.py y
// pipeline/comtrade.py; aquí sólo hay agregados de presentación. Los ayudantes de
// formato, tema y tarjetas son copia de los de historia.js.
(() => {
  "use strict";

  const H = window.HISTORIA;
  const I = window.INDUSTRIA;
  const seasons = H.temporadas;
  const cats = seasons.map((s) => s.temporada);
  const last = seasons[seasons.length - 1];
  const first = seasons[0];
  const OLD = seasons.filter((s) => s.base === "efectiva").map((s) => s.temporada);
  const T = I.comercio;
  const years = T.anios;
  const yCats = years.map((y) => String(y.anio));
  const lastY = years[years.length - 1];
  const firstY = years[0];
  const consumo = I.consumo;
  const lastC = consumo[consumo.length - 1];
  const manuf = I.manufacturas;

  // Etapas de la FLA en el orden de la cadena; hilados y tejidos van juntos.
  const STAGES = ["sucia", "lavada", "peinada", "blousse", "subproductos", "manuf"];
  const SNAME = {
    sucia: "Sucia",
    lavada: "Lavada",
    peinada: "Peinada (tops)",
    blousse: "Blousse (noils)",
    subproductos: "Subproductos",
    manuf: "Hilados y tejidos",
  };
  // Mismos colores por producto que historia.js; hilados y tejidos en tinta.
  const SSLOT = { sucia: "s1", peinada: "s2", blousse: "s3", lavada: "s4", subproductos: "s5", manuf: "ink" };
  const PROCESSED = ["lavada", "peinada", "blousse", "subproductos", "manuf"];
  const stageT = (s, k) => (k === "manuf" ? (s.toneladas.hilados || 0) + (s.toneladas.tejidos || 0) : s.toneladas[k] || 0);
  const stageUsd = (s, k) => (k === "manuf" ? (s.ingresos.hilados || 0) + (s.ingresos.tejidos || 0) : s.ingresos[k] || 0);

  // Manufacturas de Comtrade.
  const MAN = T.manufacturas;
  const MNAME = { hilados: "Hilados", telas: "Telas", prendas: "Prendas", hogar: "Mantas, alfombras y fieltro" };
  const MSLOT = { hilados: "s1", telas: "s3", prendas: "s2", hogar: "s4" };
  const FINE = ["fina", "mediana", "gruesa"];
  const FNAME = { fina: "Fina", mediana: "Mediana", gruesa: "Gruesa" };
  const FSLOT = { fina: "ord1", mediana: "ord2", gruesa: "ord3" };

  // ------------------------------------------------------------ formato

  const nf = {};
  const num = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    nf[d] ??= new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  const tons = (v) => `${num(v)} t`;
  const usdM = (v, d = 1) => `USD ${num(v / 1e6, d)} M`;
  const perKg = (v) => (v == null ? "–" : `${num(v, 2)} USD/kg`);
  const pct = (v, d = 0) => (v == null ? "–" : `${num(v * 100, d)}%`);
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const manTotal = (flow) => sum(MAN.map((m) => flow[m].usd));
  const mirrorManUsd = (y) => (y.espejo ? y.espejo.hilados.usd + y.espejo.telas.usd : null);

  // ------------------------------------------------------------ tema

  let C = {};
  function readTokens() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(`--${n}`).trim();
    C = {
      page: v("page"), surface: v("surface"), ink: v("ink"), ink2: v("ink-2"), muted: v("muted"),
      grid: v("grid"), axis: v("axis"), border: v("border"), past: v("past"), empty: v("empty"),
      s1: v("s1"), s2: v("s2"), s3: v("s3"), s4: v("s4"), s5: v("s5"),
      ord1: v("ord-1"), ord2: v("ord-2"), ord3: v("ord-3"),
    };
  }
  const sColor = (k) => C[SSLOT[k]];
  const mColor = (k) => C[MSLOT[k]];
  const fColor = (k) => C[FSLOT[k]];
  const swatch = (c) =>
    `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin:0 6px 2px 0;vertical-align:middle"></i>`;

  function base() {
    return {
      animationDuration: 400,
      textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: C.ink2 },
      grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        backgroundColor: C.surface,
        borderColor: C.axis,
        borderWidth: 1,
        textStyle: { color: C.ink, fontSize: 12 },
        extraCssText: "border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);",
        confine: true,
      },
    };
  }
  const axisCat = (data, extra = {}) => ({
    type: "category",
    data,
    axisLine: { lineStyle: { color: C.axis } },
    axisTick: { show: false },
    axisLabel: { color: C.muted, fontSize: 11 },
    ...extra,
  });
  const axisVal = (fmt, extra = {}) => ({
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: C.muted, fontSize: 11, formatter: fmt },
    splitLine: { lineStyle: { color: C.grid, type: "solid", width: 1 } },
    ...extra,
  });
  const axisTip = () => ({
    ...base().tooltip,
    trigger: "axis",
    axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
  });
  // Barras apiladas: sólo el último segmento presente de cada barra lleva la punta redondeada.
  function stacked(keys, rows, get, radius = [4, 4, 0, 0]) {
    const top = rows.map((r) => [...keys].reverse().find((k) => get(r, k)));
    return keys.map((k) =>
      rows.map((r, i) => {
        const v = get(r, k);
        if (!v) return null;
        return top[i] === k ? { value: v, itemStyle: { borderRadius: radius } } : { value: v };
      }),
    );
  }
  const barSeries = (name, data, color, extra = {}) => ({
    name,
    type: "bar",
    stack: "t",
    barMaxWidth: 28,
    data,
    itemStyle: { color, borderColor: C.surface, borderWidth: 1 },
    emphasis: { focus: "series" },
    ...extra,
  });
  const lineSeries = (name, data, color, extra = {}) => ({
    name,
    type: "line",
    data,
    symbol: "circle",
    symbolSize: 6,
    showSymbol: true,
    connectNulls: false,
    lineStyle: { width: 2, color, cap: "round", join: "round" },
    itemStyle: { color, borderColor: C.surface, borderWidth: 1.5 },
    emphasis: { focus: "series" },
    ...extra,
  });

  // ------------------------------------------------------------ gráficos

  const SPECS = {
    etapasPct: {
      title: "En qué etapa sale la lana exportada",
      sub: () => `Participación en las toneladas limpias exportadas, ${first.temporada} a ${last.temporada}`,
      legend: () => STAGES.map((k) => ({ label: SNAME[k], color: sColor(k) })),
      foot: "Hilados y tejidos no llegan al 0,3% en ninguna temporada: casi no se ven. Fuente: informes anuales EL 488 a EL 812.",
      height: "tall",
      option() {
        const share = (s, k) => stageT(s, k) / s.total_t;
        const data = stacked(STAGES, seasons, share);
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const s = seasons[ps[0].dataIndex];
              const rows = STAGES.filter((k) => stageT(s, k))
                .map((k) => `${swatch(sColor(k))}${SNAME[k]}: <b>${pct(share(s, k), 1)}</b> · ${tons(stageT(s, k))}`)
                .join("<br>");
              return `<b>${s.temporada}</b><br>${rows}<br>Total: <b>${tons(s.total_t)}</b>`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => `${Math.round(v * 100)}%`, { min: 0, max: 1 }),
          series: STAGES.map((k, i) => barSeries(SNAME[k], data[i], sColor(k))),
        };
      },
      table: () => ({
        head: ["Temporada", ...STAGES.map((k) => SNAME[k]), "Total t"],
        rows: seasons.map((s) => [s.temporada, ...STAGES.map((k) => pct(stageT(s, k) / s.total_t, 1)), num(s.total_t)]),
      }),
    },

    procesada: {
      title: "Lana que sale lavada o más procesada",
      sub: () => "Todo lo que no es lana sucia, en toneladas limpias y en dólares",
      legend: () => [
        { label: "Toneladas", color: C.s2, line: true },
        { label: "Dólares", color: C.s1, line: true },
      ],
      foot: "Lavada, peinada, blousse, subproductos, hilados y tejidos. Es lo que la FLA llama “productos procesados”.",
      option() {
        const tShare = seasons.map((s) => sum(PROCESSED.map((k) => stageT(s, k))) / s.total_t);
        const uShare = seasons.map((s) => sum(PROCESSED.map((k) => stageUsd(s, k))) / s.ingresos_usd);
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => pct(v, 1) },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => `${Math.round(v * 100)}%`, { min: 0, max: 1 }),
          series: [lineSeries("Toneladas", tShare, C.s2), lineSeries("Dólares", uShare, C.s1)],
        };
      },
      table: () => ({
        head: ["Temporada", "% toneladas", "% dólares"],
        rows: seasons.map((s) => [
          s.temporada,
          pct(sum(PROCESSED.map((k) => stageT(s, k))) / s.total_t, 1),
          pct(sum(PROCESSED.map((k) => stageUsd(s, k))) / s.ingresos_usd, 1),
        ]),
      }),
    },

    manufFla: {
      title: "Hilados y tejidos exportados",
      sub: () => "Miles de dólares por temporada, según la FLA",
      legend: () => [
        { label: "Hilados", color: C.s1 },
        { label: "Tejidos", color: C.s3 },
      ],
      foot: "Entre 2003/04 y 2009/10 los informes no tienen columna de hilados y tejidos: sin dato, no cero. Desde 2015/16 figuran en 0.",
      option() {
        const missing = manuf.filter((m) => m.hilados.t == null).map((m) => m.temporada);
        const get = (m, p) => (m[p].usd == null ? null : m[p].usd / 1e3);
        const data = stacked(["hilados", "tejidos"], manuf, get);
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const m = manuf[ps[0].dataIndex];
              if (m.hilados.t == null) return `<b>${m.temporada}</b><br>Sin columna en el informe`;
              const row = (p, n) => `${n}: <b>${tons(m[p].t)}</b>${m[p].usd != null ? ` · ${usdM(m[p].usd, 2)}` : ""}`;
              return `<b>${m.temporada}</b><br>${row("hilados", "Hilados")}<br>${row("tejidos", "Tejidos")}`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => num(v)),
          series: [
            barSeries("Hilados", data[0], C.s1, {
              markArea: missing.length
                ? {
                    silent: true,
                    itemStyle: { color: C.empty, opacity: 0.6 },
                    label: { show: true, position: "insideTop", color: C.muted, fontSize: 11, formatter: "sin dato" },
                    data: [[{ xAxis: missing[0] }, { xAxis: missing[missing.length - 1] }]],
                  }
                : undefined,
            }),
            barSeries("Tejidos", data[1], C.s3),
          ],
        };
      },
      table: () => ({
        head: ["Temporada", "Hilados t", "Hilados USD", "Tejidos t", "Tejidos USD"],
        rows: manuf.map((m) => [m.temporada, num(m.hilados.t, 1), num(m.hilados.usd), num(m.tejidos.t, 1), num(m.tejidos.usd)]),
      }),
    },

    consumo: {
      title: "Consumo industrial interno",
      sub: () => "Toneladas base sucia por temporada y su peso en la producción estimada del mismo balance",
      legend: () => [
        { label: "Cifra informada", color: C.s1 },
        { label: "Cifra redonda (múltiplo de 500 t)", color: C.past },
        { label: "% de la producción", color: C.s2, line: true },
      ],
      foot: "Fuente: balance de cada informe anual de la FLA (“consumo local”). Las cifras redondas son estimaciones; no dibujan una tendencia.",
      option() {
        return {
          ...base(),
          grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const c = consumo[ps[0].dataIndex];
              return `<b>${c.temporada}</b><br>Consumo: <b>${tons(c.consumo_local)}</b>${c.redondo ? " (cifra redonda)" : ""}<br>Producción: ${tons(c.produccion)}<br>Consumo / producción: <b>${pct(c.consumo_pct, 1)}</b>`;
            },
          },
          xAxis: axisCat(consumo.map((c) => c.temporada)),
          yAxis: [
            axisVal((v) => num(v)),
            axisVal((v) => `${Math.round(v * 100)}%`, { min: 0, splitLine: { show: false } }),
          ],
          series: [
            {
              name: "Consumo",
              type: "bar",
              barMaxWidth: 28,
              data: consumo.map((c) => ({
                value: c.consumo_local,
                itemStyle: { color: c.redondo ? C.past : C.s1, borderRadius: [4, 4, 0, 0] },
              })),
            },
            lineSeries("% de la producción", consumo.map((c) => c.consumo_pct), C.s2, { yAxisIndex: 1 }),
          ],
        };
      },
      table: () => ({
        head: ["Temporada", "Consumo t", "Producción t", "% producción", "Cifra"],
        rows: consumo.map((c) => [c.temporada, num(c.consumo_local), num(c.produccion), pct(c.consumo_pct, 1), c.redondo ? "redonda" : "informada"]),
      }),
    },

    consumoFinura: {
      title: "Qué lana usa la industria local",
      sub: () => "Consumo interno por finura, toneladas base sucia, desde 2005/06",
      legend: () => FINE.map((f) => ({ label: FNAME[f], color: fColor(f) })),
      foot: "Fina: hasta 24,5 µ. Hasta 2018/19 el reparto también es redondo (por ejemplo 1.000 / 900 / 100 t).",
      option() {
        const rows = consumo.filter((c) => c.finura);
        const data = stacked(FINE, rows, (c, f) => c.finura[f]);
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const c = rows[ps[0].dataIndex];
              const lines = FINE.map((f) => `${swatch(fColor(f))}${FNAME[f]}: <b>${tons(c.finura[f])}</b> · ${pct(c.finura[f] / c.consumo_local)}`).join("<br>");
              return `<b>${c.temporada}</b>${c.redondo ? " · cifra redonda" : ""}<br>${lines}`;
            },
          },
          xAxis: axisCat(rows.map((c) => c.temporada)),
          yAxis: axisVal((v) => num(v)),
          series: FINE.map((f, i) => barSeries(FNAME[f], data[i], fColor(f))),
        };
      },
      table: () => ({
        head: ["Temporada", ...FINE.map((f) => FNAME[f]), "Total"],
        rows: consumo.filter((c) => c.finura).map((c) => [c.temporada, ...FINE.map((f) => num(c.finura[f])), num(c.consumo_local)]),
      }),
    },

    escalera: {
      title: "Dólares por kilo, de la oveja a la prenda",
      sub: () => `FLA ${last.temporada} (exportado, FOB, base limpia) y Comtrade ${lastY.anio} (CIF, peso neto)`,
      legend: () => [
        { label: "Exportado por Argentina (FLA)", color: C.s1 },
        { label: "Hilado argentino según compradores", color: C.s3 },
        { label: "Importado por Argentina", color: C.past },
      ],
      foot: "Cada barra mezcla finuras y productos distintos: sirve para ver el orden de magnitud, no el valor agregado exacto de cada paso.",
      height: "tall",
      option() {
        const rows = ladder();
        return {
          ...base(),
          grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
          tooltip: { ...axisTip(), formatter: (ps) => `${esc(rows[ps[0].dataIndex].label)}<br><b>${perKg(ps[0].value)}</b>` },
          xAxis: axisVal((v) => num(v), { axisLabel: { show: false } }),
          yAxis: axisCat(rows.map((r) => r.label), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: [
            {
              type: "bar",
              barMaxWidth: 22,
              data: rows.map((r) => ({ value: r.v, itemStyle: { color: r.color, borderRadius: [0, 4, 4, 0] } })),
              label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (p) => num(p.value, 1) },
            },
          ],
        };
      },
      table: () => ({ head: ["Etapa", "USD/kg", "Fuente"], rows: ladder().map((r) => [r.label, num(r.v, 2), r.src]) }),
    },

    prima: {
      title: "Lo que paga el peinado",
      sub: () => "Precio de la peinada sobre el de la sucia, por kilo limpio exportado",
      legend: () => [
        { label: "Peinada", color: C.s2, line: true },
        { label: "Sucia", color: C.s1, line: true },
      ],
      foot: "Dólares FOB corrientes por kilo limpio, de los informes anuales. La diferencia paga lavado, peinado y la merma de fibra corta (blousse). Hasta 2004/05 los kilos limpios salen del “equivalente teórico base limpia” de la FLA.",
      option() {
        const p = seasons.map((s) => s.usd_kg_producto.peinada ?? null);
        const g = seasons.map((s) => s.usd_kg_producto.sucia ?? null);
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            formatter: (ps) => {
              const i = ps[0].dataIndex;
              return `<b>${cats[i]}</b><br>Peinada: <b>${perKg(p[i])}</b><br>Sucia: <b>${perKg(g[i])}</b><br>Prima: <b>${p[i] && g[i] ? pct(p[i] / g[i] - 1) : "–"}</b>`;
            },
          },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v)),
          series: [
            lineSeries("Peinada", p, C.s2, {
              markArea: {
                silent: true,
                itemStyle: { color: C.empty, opacity: 0.6 },
                label: { show: true, position: "insideTop", color: C.muted, fontSize: 11, formatter: "método anterior" },
                data: [[{ xAxis: OLD[0] }, { xAxis: OLD[OLD.length - 1] }]],
              },
            }),
            lineSeries("Sucia", g, C.s1),
          ],
        };
      },
      table: () => ({
        head: ["Temporada", "Peinada USD/kg", "Sucia USD/kg", "Prima"],
        rows: seasons.map((s) => {
          const p = s.usd_kg_producto.peinada;
          const g = s.usd_kg_producto.sucia;
          return [s.temporada, num(p, 2), num(g, 2), p && g ? pct(p / g - 1) : "–"];
        }),
      }),
    },

    importaciones: {
      title: "Importaciones de manufacturas de lana",
      sub: () => `Millones de dólares CIF por año, ${firstY.anio} a ${lastY.anio}`,
      legend: () => MAN.map((m) => ({ label: MNAME[m], color: mColor(m) })),
      foot: "Fuente: UN Comtrade, datos que informa Argentina. Dólares corrientes.",
      option() {
        const data = stacked(MAN, years, (y, m) => y.importaciones[m].usd / 1e6);
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const y = years[ps[0].dataIndex];
              const rows = MAN.map((m) => `${swatch(mColor(m))}${MNAME[m]}: <b>${usdM(y.importaciones[m].usd, 2)}</b> · ${tons(y.importaciones[m].kg / 1e3)}`).join("<br>");
              return `<b>${y.anio}</b> · ${y.revision_hs}<br>${rows}<br>Total: <b>${usdM(manTotal(y.importaciones), 2)}</b>`;
            },
          },
          xAxis: axisCat(yCats),
          yAxis: axisVal((v) => num(v)),
          series: MAN.map((m, i) => barSeries(MNAME[m], data[i], mColor(m))),
        };
      },
      table: () => ({
        head: ["Año", ...MAN.map((m) => `${MNAME[m]} USD M`), "Total USD M"],
        rows: years.map((y) => [y.anio, ...MAN.map((m) => num(y.importaciones[m].usd / 1e6, 2)), num(manTotal(y.importaciones) / 1e6, 2)]),
      }),
    },

    exportaciones: {
      title: "Exportaciones de manufacturas de lana",
      sub: () => "Millones de dólares por año: lo que declara Argentina y lo que declaran los compradores",
      legend: () => [
        ...MAN.map((m) => ({ label: `${MNAME[m]} (Argentina, FOB)`, color: mColor(m) })),
        { label: "Hilados y telas según compradores (CIF)", color: C.ink, line: true },
      ],
      foot: "Los compradores sólo se consultan para hilados y telas (capítulo 51), no para prendas.",
      option() {
        const data = stacked(MAN, years, (y, m) => y.exportaciones[m].usd / 1e6);
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const y = years[ps[0].dataIndex];
              const rows = MAN.map((m) => `${swatch(mColor(m))}${MNAME[m]}: <b>${usdM(y.exportaciones[m].usd, 2)}</b>`).join("<br>");
              const mirror = y.espejo ? `<br>Compradores, hilados y telas: <b>${usdM(mirrorManUsd(y), 2)}</b> · ${tons((y.espejo.hilados.kg + y.espejo.telas.kg) / 1e3)}` : "";
              return `<b>${y.anio}</b><br>${rows}${mirror}`;
            },
          },
          xAxis: axisCat(yCats),
          yAxis: axisVal((v) => num(v, 1)),
          series: [
            ...MAN.map((m, i) => barSeries(MNAME[m], data[i], mColor(m))),
            lineSeries("Compradores", years.map((y) => (y.espejo ? mirrorManUsd(y) / 1e6 : null)), C.ink, { symbolSize: 5 }),
          ],
        };
      },
      table: () => ({
        head: ["Año", ...MAN.map((m) => `${MNAME[m]} USD M`), "Compradores hilados+telas USD M"],
        rows: years.map((y) => [y.anio, ...MAN.map((m) => num(y.exportaciones[m].usd / 1e6, 2)), y.espejo ? num(mirrorManUsd(y) / 1e6, 2) : "–"]),
      }),
    },

    importacionesT: {
      title: "Importaciones en toneladas",
      sub: () => "Peso neto de las manufacturas de lana importadas",
      legend: () => MAN.map((m) => ({ label: MNAME[m], color: mColor(m) })),
      foot: "Peso del producto, no de la lana que contiene. Una prenda puede mezclar lana con otras fibras.",
      option() {
        const data = stacked(MAN, years, (y, m) => y.importaciones[m].kg / 1e3);
        return {
          ...base(),
          tooltip: { ...axisTip(), valueFormatter: (v) => (v == null ? "–" : tons(v)) },
          xAxis: axisCat(yCats),
          yAxis: axisVal((v) => num(v)),
          series: MAN.map((m, i) => barSeries(MNAME[m], data[i], mColor(m))),
        };
      },
      table: () => ({
        head: ["Año", ...MAN.map((m) => `${MNAME[m]} t`)],
        rows: years.map((y) => [y.anio, ...MAN.map((m) => num(y.importaciones[m].kg / 1e3, 1))]),
      }),
    },

    origenes: {
      title: "De dónde vienen",
      sub: () => (T.origenes ? `Importaciones de manufacturas de lana por país de origen, ${T.origenes.anio}, dólares CIF` : ""),
      legend: () => MAN.map((m) => ({ label: MNAME[m], color: mColor(m) })),
      foot: () => (T.origenes ? `“Otros” suma ${T.origenes.otros.paises} países. Fuente: UN Comtrade, datos que informa Argentina.` : "Sin datos por país."),
      height: "tall",
      option() {
        const rows = originRows();
        const data = stacked(MAN, rows, (r, m) => r.usd[m] / 1e6, [0, 4, 4, 0]);
        const total = sum(rows.map((r) => sum(MAN.map((m) => r.usd[m]))));
        return {
          ...base(),
          grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              const t = sum(MAN.map((m) => r.usd[m]));
              const lines = MAN.filter((m) => r.usd[m]).map((m) => `${swatch(mColor(m))}${MNAME[m]}: <b>${usdM(r.usd[m], 2)}</b>`).join("<br>");
              return `<b>${esc(r.pais)}</b> · ${pct(t / total)} del total<br>${lines}`;
            },
          },
          xAxis: axisVal((v) => num(v, 1)),
          yAxis: axisCat(rows.map((r) => r.pais), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: MAN.map((m, i) => barSeries(MNAME[m], data[i], mColor(m), { barMaxWidth: 20 })),
        };
      },
      table: () => ({
        head: ["País", ...MAN.map((m) => `${MNAME[m]} USD`), "Total USD"],
        rows: originRows().map((r) => [r.pais, ...MAN.map((m) => num(r.usd[m])), num(sum(MAN.map((m) => r.usd[m])))]),
      }),
    },

    control: {
      title: "Lana peinada exportada: tres fuentes",
      sub: () => "Toneladas por año calendario",
      legend: () => [
        { label: "FLA (suma de meses, base limpia)", color: C.s2, line: true },
        { label: "Compradores (Comtrade espejo)", color: C.ink, line: true },
        { label: "Argentina (Comtrade)", color: C.s1, line: true },
      ],
      foot: "La FLA da meses desde julio de 2005, así que su serie por año calendario empieza en 2006. El espejo de la posición 5105 incluye peinados de pelo fino.",
      option() {
        const fla = Object.fromEntries(I.calendario.map((c) => [c.anio, c.peinada_t]));
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => (v == null ? "–" : tons(v)) },
          xAxis: axisCat(yCats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v), { min: 0 }),
          series: [
            lineSeries("FLA", years.map((y) => fla[y.anio] ?? null), C.s2),
            lineSeries("Compradores", years.map((y) => (y.espejo ? y.espejo.peinada.kg / 1e3 : null)), C.ink),
            lineSeries("Argentina", years.map((y) => y.exportaciones.peinada.kg / 1e3), C.s1),
          ],
        };
      },
      table: () => {
        const fla = Object.fromEntries(I.calendario.map((c) => [c.anio, c.peinada_t]));
        return {
          head: ["Año", "FLA t", "Compradores t", "Argentina t", "Argentina / compradores"],
          rows: years.map((y) => [
            y.anio,
            num(fla[y.anio]),
            y.espejo ? num(y.espejo.peinada.kg / 1e3) : "–",
            num(y.exportaciones.peinada.kg / 1e3),
            y.espejo ? pct(y.exportaciones.peinada.kg / y.espejo.peinada.kg) : "–",
          ]),
        };
      },
    },
  };

  function ladder() {
    const fla = last.usd_kg_producto;
    const imp = lastY.importaciones;
    const rows = [
      ["Sucia", fla.sucia, C.s1, `FLA ${last.temporada}`],
      ["Lavada", fla.lavada, C.s1, `FLA ${last.temporada}`],
      ["Peinada", fla.peinada, C.s1, `FLA ${last.temporada}`],
      ["Blousse", fla.blousse, C.s1, `FLA ${last.temporada}`],
      ["Hilado (compradores)", lastY.espejo?.hilados.usd_kg, C.s3, `Comtrade espejo ${lastY.anio}`],
      ["Hilado importado", imp.hilados.usd_kg, C.past, `Comtrade ${lastY.anio}`],
      ["Tela importada", imp.telas.usd_kg, C.past, `Comtrade ${lastY.anio}`],
      ["Prenda importada", imp.prendas.usd_kg, C.past, `Comtrade ${lastY.anio}`],
      ["Manta o alfombra imp.", imp.hogar.usd_kg, C.past, `Comtrade ${lastY.anio}`],
    ];
    return rows.filter((r) => r[1] != null).map(([label, v, color, src]) => ({ label, v, color, src }));
  }

  function originRows() {
    if (!T.origenes) return [];
    const fill = (usd) => Object.fromEntries(MAN.map((m) => [m, usd[m] || 0]));
    return [
      ...T.origenes.paises.map((p) => ({ pais: p.pais, usd: fill(p.usd) })),
      { pais: "Otros", usd: fill(T.origenes.otros.usd) },
    ];
  }

  // ------------------------------------------------------------ tarjetas

  const instances = {};

  function buildCard(el, id) {
    const spec = SPECS[id];
    el.innerHTML = `
      <div class="card-head">
        <div><p class="card-title">${spec.title}</p><p class="card-sub"></p></div>
        <button class="btn" type="button" aria-expanded="false">Ver tabla</button>
      </div>
      <div class="chart ${spec.height || ""}" role="img" aria-label="${esc(spec.title)}"></div>
      <div class="legend"></div>
      <div class="table-wrap" hidden></div>
      <p class="card-foot"></p>`;
    const btn = el.querySelector(".btn");
    const wrap = el.querySelector(".table-wrap");
    btn.addEventListener("click", () => {
      const open = wrap.hidden;
      wrap.hidden = !open;
      btn.textContent = open ? "Ocultar tabla" : "Ver tabla";
      btn.setAttribute("aria-expanded", String(open));
      if (open) renderTable(id);
    });
  }

  function renderTable(id) {
    const el = document.querySelector(`[data-chart="${id}"] .table-wrap`);
    if (el.hidden) return;
    const t = SPECS[id].table();
    el.innerHTML = `<table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  }

  function render(id) {
    const card = document.querySelector(`[data-chart="${id}"]`);
    const spec = SPECS[id];
    card.querySelector(".card-sub").textContent = spec.sub ? spec.sub() : "";
    const foot = typeof spec.foot === "function" ? spec.foot() : spec.foot || "";
    const footEl = card.querySelector(".card-foot");
    footEl.textContent = foot;
    footEl.hidden = !foot;
    const legend = spec.legend ? spec.legend() : [];
    card.querySelector(".legend").innerHTML = legend
      .map((l) => `<span><i class="${l.line ? "line" : ""}" style="background:${l.color}"></i>${esc(l.label)}</span>`)
      .join("");
    const node = card.querySelector(".chart");
    instances[id] ??= echarts.init(node, null, { renderer: "canvas" });
    const option = spec.option();
    // Con "reducir movimiento" el gráfico aparece sin animación.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) option.animation = false;
    instances[id].setOption(option, true);
    renderTable(id);
  }

  // ------------------------------------------------------------ textos

  function renderKpis() {
    const measured = consumo.filter((c) => !c.redondo && c.temporada >= "2019/20");
    const maxC = measured.reduce((a, b) => (b.consumo_pct > a.consumo_pct ? b : a));
    const lastYarn = [...manuf].reverse().find((m) => m.hilados.t);
    const manLast = stageUsd(last, "manuf");
    const impLast = manTotal(lastY.importaciones);
    const impFirst = manTotal(firstY.importaciones);
    const lead = T.origenes ? originRows().slice(0, -1)[0] : null;
    const leadShare = lead ? sum(MAN.map((m) => lead.usd[m])) / sum(Object.values(T.origenes.mundo)) : null;
    const p = last.usd_kg_producto.peinada;
    const g = last.usd_kg_producto.sucia;
    const tile = (label, value, unit, delta, hero = false) =>
      `<div class="tile${hero ? " hero" : ""}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit}</span></div><div class="delta">${delta}</div></div>`;
    document.getElementById("kpis").innerHTML = [
      tile(
        `Consumo industrial interno ${lastC.temporada}`,
        num(lastC.consumo_local),
        "t sucias",
        `${pct(lastC.consumo_pct, 1)} de la producción estimada (${tons(lastC.produccion)}). Máximo desde 2019/20: ${pct(maxC.consumo_pct)} en ${maxC.temporada}.`,
        true,
      ),
      tile(
        `Exportado como hilado o tejido ${last.temporada}, según la FLA`,
        num(manLast / 1e6, 1),
        "M USD",
        `Última temporada con hilados: ${lastYarn.temporada} (${tons(lastYarn.hilados.t)}). ` +
          (mirrorManUsd(lastY) != null ? `Los compradores declaran ${usdM(mirrorManUsd(lastY))} de hilados y telas argentinos en ${lastY.anio}. ` : "") +
          `Como peinada: ${usdM(last.ingresos.peinada, 0)}.`,
      ),
      tile(
        `Importado en manufacturas de lana ${lastY.anio}`,
        num(impLast / 1e6, 1),
        "M USD",
        `${pct(lastY.importaciones.prendas.usd / impLast)} son prendas${lead ? `; ${esc(lead.pais)}, ${pct(leadShare)}` : ""}. En ${firstY.anio}: ${usdM(impFirst)}.`,
      ),
      tile(
        `Prima del peinado ${last.temporada}`,
        p && g ? `+${num((p / g - 1) * 100)}` : "–",
        "%",
        `Peinada ${perKg(p)} contra sucia ${perKg(g)}, por kilo limpio exportado.`,
      ),
    ].join("");
    document.getElementById("kpi-note").textContent =
      `FLA: ${seasons.length} temporadas, ${first.temporada} a ${last.temporada}. UN Comtrade: ${years.length} años, ${firstY.anio} a ${lastY.anio}.`;
  }

  function renderTexts() {
    document.getElementById("sub").textContent =
      `Informes anuales de la FLA (${first.temporada}–${last.temporada}), UN Comtrade (${firstY.anio}–${lastY.anio}) y fuentes del sector`;

    const measured = consumo.filter((c) => !c.redondo && c.temporada >= "2019/20");
    const lo = measured.reduce((a, b) => (b.consumo_pct < a.consumo_pct ? b : a));
    const hi = measured.reduce((a, b) => (b.consumo_pct > a.consumo_pct ? b : a));
    const fineLast = lastC.finura ? lastC.finura.fina : null;
    document.getElementById("consumo-lede").textContent =
      `La FLA estima en cada balance cuánta lana usa la industria del país para el mercado interno. ` +
      `En ${lastC.temporada}: ${tons(lastC.consumo_local)} base sucia, ${pct(lastC.consumo_pct, 1)} de la producción. ` +
      `Desde 2019/20, cuando dejan de ser cifras redondas, va de ${pct(lo.consumo_pct)} (${lo.temporada}) a ${pct(hi.consumo_pct)} (${hi.temporada}). ` +
      (fineLast != null ? `Casi toda es lana mediana o gruesa: la fina fue ${tons(fineLast)} en ${lastC.temporada}.` : "");

    const dirtyShare = (s) => stageT(s, "sucia") / s.total_t;
    const prevMax = seasons.slice(0, -1).reduce((a, b) => (dirtyShare(b) > dirtyShare(a) ? b : a));
    const june = last.mensual?.[11];
    const prevJune = seasons[seasons.length - 2].mensual?.[11];
    document.getElementById("etapas-lede").textContent =
      `En ${last.temporada} salió como lana sucia el ${pct(dirtyShare(last))} de las toneladas limpias; ` +
      `el máximo anterior de la serie fue ${pct(dirtyShare(prevMax))} en ${prevMax.temporada}.` +
      (june?.ajuste_anual
        ? ` Esa temporada incluye en junio el ajuste anual de exportadores no socios de la FLA: ${tons(june.t)} ese mes${prevJune ? `, contra ${tons(prevJune.t)} en junio del año anterior` : ""}.`
        : "");

    renderControlNote();

    const deficit = years.filter((y) => manTotal(y.importaciones) > manTotal(y.exportaciones)).length;
    const mirrorLast = mirrorManUsd(lastY);
    document.getElementById("comercio-lede").textContent =
      `Argentina importó más manufacturas de lana de las que exportó en ${deficit} de ${years.length} años. ` +
      `En ${lastY.anio} importó ${usdM(manTotal(lastY.importaciones))} y declaró exportaciones por ${usdM(manTotal(lastY.exportaciones), 2)}; ` +
      `los países compradores registran ${mirrorLast != null ? usdM(mirrorLast) : "–"} de hilados y telas de origen argentino. ` +
      `Para comparar: la lana peinada exportada en ${last.temporada} fue ${usdM(last.ingresos.peinada, 0)}.`;

    const link = (name) => `<a href="../data/raw/comercio/${encodeURI(name)}">${esc(name)}</a>`;
    document.getElementById("archivos").innerHTML =
      `<p class="note">FLA: los ${seasons.length} informes anuales listados en <a href="historia.html#fuentes">la página histórica</a>. ` +
      `UN Comtrade: API pública <code>${esc(T.api)}</code>, un archivo por año y consulta.</p>` +
      `<div class="table-wrap"><table><thead><tr><th>Año</th><th>Versión HS</th><th>Argentina</th><th>Compradores</th><th>Países que informan</th></tr></thead><tbody>${[...years]
        .reverse()
        .map(
          (y) =>
            `<tr><td>${y.anio}</td><td>${esc(y.revision_hs)}</td><td>${link(`comtrade-${y.anio}.json`)}</td><td>${y.espejo ? link(`espejo-${y.anio}.json`) : "–"}</td><td>${y.espejo ? y.espejo.paises_informantes : "–"}</td></tr>`,
        )
        .join("")}</tbody></table></div>` +
      (T.origenes ? `<p class="note">Orígenes ${T.origenes.anio}: ${link(`origenes-${T.origenes.anio}.json`)}.</p>` : "");

    document.getElementById("foot").textContent =
      `Datos generados el ${longDate(I.generado)} con build.py a partir de los PDF de la FLA y los archivos de UN Comtrade. Uso personal.`;
  }

  // Hasta qué año la lana peinada que Argentina informa a Comtrade coincide con la FLA.
  function renderControlNote() {
    const fla = Object.fromEntries(I.calendario.map((c) => [c.anio, c.peinada_t]));
    const rows = years.filter((y) => fla[y.anio]).map((y) => ({ y, r: y.exportaciones.peinada.kg / 1e3 / fla[y.anio] }));
    const firstOff = rows.findIndex((x) => Math.abs(x.r - 1) > 0.05);
    const lastRow = rows[rows.length - 1];
    const ok = firstOff === -1 ? rows : rows.slice(0, firstOff);
    const mirrorLast = lastRow.y.espejo ? lastRow.y.espejo.peinada.kg / 1e3 / fla[lastRow.y.anio] : null;
    document.getElementById("metodo-control").innerHTML =
      `<strong>Por qué la lana sin industrializar sale de la FLA.</strong> ` +
      (ok.length
        ? `Entre ${ok[0].y.anio} y ${ok[ok.length - 1].y.anio} la lana peinada que Argentina informa a Comtrade coincide con la de la FLA (diferencia de 5% o menos por año). `
        : "") +
      (firstOff === -1
        ? "Desde entonces sigue coincidiendo."
        : `Desde ${rows[firstOff].y.anio} Argentina informa menos: en ${lastRow.y.anio}, el ${pct(lastRow.r)} de lo que suma la FLA, ` +
          `y los países compradores declaran haber recibido el ${pct(mirrorLast)}. `) +
      "Por eso para lana sucia, lavada y peinada el sitio usa la FLA, y Comtrade sólo para hilados, telas y prendas.";
  }

  function renderAll() {
    readTokens();
    renderKpis();
    for (const id of Object.keys(SPECS)) render(id);
  }

  // ------------------------------------------------------------ arranque

  document.querySelectorAll("[data-chart]").forEach((el) => buildCard(el, el.dataset.chart));
  renderTexts();
  renderAll();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  let pending;
  window.addEventListener("resize", () => {
    clearTimeout(pending);
    pending = setTimeout(() => Object.values(instances).forEach((i) => i.resize()), 120);
  });
})();
