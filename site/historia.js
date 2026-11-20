// Dibuja la página histórica a partir de window.HISTORIA (generado por build.py).
// La aritmética de fondo está en pipeline/history.py; aquí sólo hay agregados de
// presentación. Los ayudantes de formato y tema son copia de los de app.js.
(() => {
  "use strict";

  const H = window.HISTORIA;
  const seasons = H.temporadas;
  const cats = seasons.map((s) => s.temporada);
  const OLD = seasons.filter((s) => s.base === "efectiva").map((s) => s.temporada);
  const clean = seasons.filter((s) => s.base === "limpia");
  const last = seasons[seasons.length - 1];
  const first = seasons[0];

  // Orden fijo de slots categóricos: el color sigue al producto, nunca al ranking.
  const PRODUCTS = ["sucia", "peinada", "blousse", "lavada", "subproductos"];
  const PNAME = {
    sucia: "Sucia",
    peinada: "Peinada (tops)",
    blousse: "Blousse (noils)",
    lavada: "Lavada",
    subproductos: "Subproductos",
  };
  const PSLOT = { sucia: "s1", peinada: "s2", blousse: "s3", lavada: "s4", subproductos: "s5" };
  const PRICE_PRODUCTS = ["peinada", "sucia", "lavada"];
  const SEASON_MONTHS = ["jul", "ago", "sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun"];
  // Clases de la serie de producción: cuatro hasta 2004/05, tres desde 2005/06.
  const PCLASSES = ["fina", "cruza_fina", "mediana", "gruesa"];
  const PCNAME = { fina: "Fina", cruza_fina: "Cruza fina (hasta 2004/05)", mediana: "Mediana", gruesa: "Gruesa" };
  const PCSLOT = { fina: 1, cruza_fina: 2, mediana: 3, gruesa: 4 };

  // ------------------------------------------------------------ formato

  const nf = {};
  const num = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    nf[d] ??= new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  const tons = (v) => `${num(v)} t`;
  const usdM = (v) => `USD ${num(v / 1e6, 1)} M`;
  const perKg = (v) => (v == null ? "–" : `${num(v, 2)} USD/kg`);
  const pct = (v, d = 0) => `${num(v * 100, d)}%`;
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

  // ------------------------------------------------------------ tema

  let C = {};
  function readTokens() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(`--${n}`).trim();
    C = {
      page: v("page"), surface: v("surface"), ink: v("ink"), ink2: v("ink-2"), muted: v("muted"),
      grid: v("grid"), axis: v("axis"), border: v("border"), past: v("past"), empty: v("empty"),
      s1: v("s1"), s2: v("s2"), s3: v("s3"), s4: v("s4"), s5: v("s5"),
      seq: [v("seq-1"), v("seq-2"), v("seq-3"), v("seq-4"), v("seq-5")],
      ord1: v("ord-1"), ord2: v("ord-2"), ord3: v("ord-3"),
    };
  }
  const pColor = (p) => C[PSLOT[p]];
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
  function stacked(keys, rows, get) {
    const top = rows.map((r) => [...keys].reverse().find((k) => get(r, k)));
    return keys.map((k) =>
      rows.map((r, i) => {
        const v = get(r, k);
        if (!v) return null;
        return top[i] === k ? { value: v, itemStyle: { borderRadius: [4, 4, 0, 0] } } : { value: v };
      }),
    );
  }
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
  // Sombrea las temporadas en peso efectivo (antes del cambio de método de 2005/06).
  const oldEra = (label = "peso efectivo") => ({
    silent: true,
    itemStyle: { color: C.empty, opacity: 0.6 },
    label: { show: true, position: "insideTop", color: C.muted, fontSize: 11, formatter: label },
    data: [[{ xAxis: OLD[0] }, { xAxis: OLD[OLD.length - 1] }]],
  });

  // ------------------------------------------------------------ destinos

  // Los cinco destinos con más toneladas sumando las 28 temporadas; el resto va a "Otros".
  const TOP = (() => {
    const acc = {};
    for (const s of seasons) for (const d of s.destinos) acc[d.pais] = (acc[d.pais] || 0) + d.t;
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p]) => p);
  })();
  const DSLOT = ["s1", "s2", "s3", "s4", "s5"];
  const dColor = (p) => (p === "Otros" ? C.past : C[DSLOT[TOP.indexOf(p)]]);
  const destShare = (s, p) => {
    const t = p === "Otros" ? sum(s.destinos.filter((d) => !TOP.includes(d.pais)).map((d) => d.t)) : s.destinos.find((d) => d.pais === p)?.t || 0;
    return t / s.destinos_total_t;
  };

  // ------------------------------------------------------------ gráficos

  const SPECS = {
    toneladas: {
      title: "Toneladas limpias exportadas, por producto",
      sub: () => `${first.temporada} a ${last.temporada}, temporadas completas`,
      legend: () => PRODUCTS.map((p) => ({ label: PNAME[p], color: pColor(p) })),
      foot: "Hilados y tejidos (menos de 0,3% del total en cualquier temporada) se suman en el total pero no se dibujan. Fuente: informes anuales EL 488 a EL 812.",
      height: "tall",
      option() {
        const data = stacked(PRODUCTS, seasons, (s, p) => s.toneladas[p]);
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const s = seasons[ps[0].dataIndex];
              const rows = PRODUCTS.filter((p) => s.toneladas[p])
                .map((p) => `${swatch(pColor(p))}${PNAME[p]}: <b>${tons(s.toneladas[p])}</b>`)
                .join("<br>");
              return `<b>${s.temporada}</b> · EL ${s.numero}<br>${rows}<br>Total: <b>${tons(s.total_t)}</b> · ${perKg(s.usd_kg)}`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => num(v)),
          series: PRODUCTS.map((p, i) => ({
            name: PNAME[p],
            type: "bar",
            stack: "t",
            barMaxWidth: 28,
            data: data[i],
            itemStyle: { color: pColor(p), borderColor: C.surface, borderWidth: 1 },
            emphasis: { focus: "series" },
          })),
        };
      },
      table: () => ({
        head: ["Temporada", ...PRODUCTS.map((p) => PNAME[p]), "Total t"],
        rows: seasons.map((s) => [s.temporada, ...PRODUCTS.map((p) => num(s.toneladas[p])), num(s.total_t)]),
      }),
    },

    ingresos: {
      title: "Ingreso de divisas",
      sub: () => "Millones de dólares corrientes por temporada",
      foot: "Dólares FOB declarados, sin ajustar por inflación. Antes de 2005/06 el informe los da en miles de dólares.",
      option() {
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const s = seasons[ps[0].dataIndex];
              return `<b>${s.temporada}</b><br>${usdM(s.ingresos_usd)}<br>${tons(s.total_t)} limpias · ${perKg(s.usd_kg)}`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => num(v / 1e6)),
          series: [
            {
              type: "bar",
              barMaxWidth: 22,
              data: seasons.map((s) => s.ingresos_usd),
              itemStyle: { color: C.s1, borderRadius: [4, 4, 0, 0] },
            },
          ],
        };
      },
      table: () => ({
        head: ["Temporada", "USD", "t limpias", "USD/kg"],
        rows: seasons.map((s) => [s.temporada, num(s.ingresos_usd), num(s.total_t), num(s.usd_kg, 2)]),
      }),
    },

    precio: {
      title: "Precio implícito por producto",
      sub: () => "Ingreso de divisas dividido por toneladas limpias, USD/kg corrientes",
      legend: () => [
        ...PRICE_PRODUCTS.map((p) => ({ label: PNAME[p], color: pColor(p), line: true })),
        { label: "Promedio de todos los productos", color: C.ink2, line: true },
      ],
      foot: "Promedio FOB declarado, no una cotización de mercado. Sucia en base limpia en todas las temporadas.",
      option() {
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            valueFormatter: (v) => perKg(v),
          },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v, 0)),
          series: [
            ...PRICE_PRODUCTS.map((p) => lineSeries(PNAME[p], seasons.map((s) => s.usd_kg_producto[p] ?? null), pColor(p))),
            lineSeries(
              "Promedio",
              seasons.map((s) => s.usd_kg),
              C.ink2,
              { lineStyle: { width: 2, color: C.ink2, type: "dashed" }, symbolSize: 4 },
            ),
          ],
        };
      },
      table: () => ({
        head: ["Temporada", ...PRICE_PRODUCTS.map((p) => PNAME[p]), "Promedio"],
        rows: seasons.map((s) => [s.temporada, ...PRICE_PRODUCTS.map((p) => num(s.usd_kg_producto[p], 2)), num(s.usd_kg, 2)]),
      }),
    },

    destinos: {
      title: "Participación de los principales destinos",
      sub: () => `Los cinco destinos con más toneladas en ${seasons.length} temporadas; el resto en “Otros”`,
      legend: () => [...TOP, "Otros"].map((p) => ({ label: p, color: dColor(p) })),
      foot: () =>
        `Zona sombreada (${OLD[0]} a ${OLD[OLD.length - 1]}): participación en peso efectivo, que sobrerrepresenta a los compradores de lana sucia. Desde 2005/06, toneladas limpias.`,
      height: "tall",
      option() {
        const keys = [...TOP, "Otros"];
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const s = seasons[ps[0].dataIndex];
              const rows = s.destinos
                .slice(0, 8)
                .map((d) => `${swatch(dColor(TOP.includes(d.pais) ? d.pais : "Otros"))}${esc(d.pais)}: <b>${pct(d.t / s.destinos_total_t, 1)}</b> · ${tons(d.t)}`)
                .join("<br>");
              return `<b>${s.temporada}</b> · ${s.base === "limpia" ? "toneladas limpias" : "peso efectivo"}<br>${rows}${
                s.destinos.length > 8 ? `<br>… y ${s.destinos.length - 8} destinos más` : ""
              }`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => `${Math.round(v * 100)}%`, { max: 1 }),
          series: keys.map((p, i) => ({
            name: p,
            type: "bar",
            stack: "d",
            barMaxWidth: 28,
            data: seasons.map((s) => destShare(s, p)),
            itemStyle: { color: dColor(p), borderColor: C.surface, borderWidth: 1 },
            emphasis: { focus: "series" },
            ...(i === 0
              ? {
                  markArea: {
                    ...oldEra(),
                    itemStyle: { color: "transparent", borderColor: C.ink2, borderWidth: 1, borderType: "dashed" },
                    label: { show: true, position: "top", color: C.ink2, fontSize: 11, formatter: "peso efectivo" },
                  },
                }
              : {}),
          })),
        };
      },
      table: () => ({
        head: ["Temporada", "Base", ...TOP, "Otros", "Destinos"],
        rows: seasons.map((s) => [
          s.temporada,
          s.base,
          ...[...TOP, "Otros"].map((p) => pct(destShare(s, p), 1)),
          String(s.destinos.length),
        ]),
      }),
    },

    finaPct: {
      title: "Participación de la lana fina",
      sub: () => "Toneladas limpias de lana fina sobre el total exportado",
      foot: "Fina: hasta 24,9 µ antes de 2005/06 (zona sombreada), hasta 24,5 µ desde entonces.",
      option() {
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => pct(v, 1) },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => `${Math.round(v * 100)}%`, { min: 0, max: 1 }),
          series: [
            lineSeries("Fina", seasons.map((s) => s.fina_pct), C.ord2, { markArea: oldEra("fina ≤ 24,9 µ") }),
          ],
        };
      },
      table: () => ({
        head: ["Temporada", "Fina %", "Corte"],
        rows: seasons.map((s) => [s.temporada, pct(s.fina_pct, 1), s.base === "limpia" ? "24,5 µ" : "24,9 µ"]),
      }),
    },

    micron: {
      title: "Micronaje promedio exportado",
      sub: () => `${clean[0].temporada} a ${last.temporada}, todos los productos`,
      foot: "Promedio ponderado por toneladas con el punto medio de cada rango de la tabla de micrones. Antes de 2005/06 el informe no trae esa tabla.",
      option() {
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => `${num(v, 2)} µ` },
          xAxis: axisCat(clean.map((s) => s.temporada), { boundaryGap: false }),
          yAxis: axisVal((v) => num(v, 1), { min: (v) => Math.floor(v.min - 0.5) }),
          series: [lineSeries("Micronaje", clean.map((s) => s.micron_promedio), C.ord3)],
        };
      },
      table: () => ({
        head: ["Temporada", "µ promedio", "Fina t", "Mediana t", "Gruesa t"],
        rows: clean.map((s) => [s.temporada, num(s.micron_promedio, 2), num(s.finura.fina), num(s.finura.mediana), num(s.finura.gruesa)]),
      }),
    },

    produccion: {
      title: "Producción de lana por finura",
      sub: () => `${H.produccion[0].temporada} a ${H.produccion[H.produccion.length - 1].temporada}, toneladas sucias`,
      legend: () => PCLASSES.map((k) => ({ label: PCNAME[k], color: C.seq[PCSLOT[k]] })),
      foot: () =>
        `Serie del informe ${last.archivo.replace(".pdf", "")}, con las revisiones posteriores. Hasta 2004/05 la FLA separa cruza fina y mediana; desde 2005/06 las une en mediana. La última temporada es una primera estimación.`,
      height: "tall",
      option() {
        const rows = H.produccion;
        const data = stacked(PCLASSES, rows, (r, k) => r[k]);
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              const parts = PCLASSES.filter((k) => r[k] != null)
                .map((k) => `${swatch(C.seq[PCSLOT[k]])}${PCNAME[k]}: <b>${tons(r[k])}</b>`)
                .join("<br>");
              return `<b>${r.temporada}</b><br>${parts}<br>Total: <b>${tons(r.total)}</b>`;
            },
          },
          xAxis: axisCat(rows.map((r) => r.temporada)),
          yAxis: axisVal((v) => num(v)),
          series: PCLASSES.map((k, i) => ({
            name: PCNAME[k],
            type: "bar",
            stack: "p",
            barMaxWidth: 20,
            data: data[i],
            itemStyle: { color: C.seq[PCSLOT[k]], borderColor: C.surface, borderWidth: 1 },
            emphasis: { focus: "series" },
          })),
        };
      },
      table: () => ({
        head: ["Zafra", ...PCLASSES.map((k) => PCNAME[k]), "Total"],
        rows: H.produccion.map((r) => [r.temporada, ...PCLASSES.map((k) => num(r[k])), num(r.total)]),
      }),
    },

    revision: {
      title: "Producción: estimación al cierre y serie revisada",
      sub: () => "Toneladas sucias de cada zafra",
      legend: () => [
        { label: "Al cierre de la zafra (balance del informe anual)", color: C.past, line: true },
        { label: "Serie revisada del último informe", color: C.s1, line: true },
      ],
      foot: "La FLA corrige la producción de años anteriores; el balance de cada informe usa la estimación de ese momento.",
      option() {
        const revised = Object.fromEntries(H.produccion.map((r) => [r.temporada, r.total]));
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => tons(v) },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v), { min: 0 }),
          series: [
            lineSeries("Al cierre", seasons.map((s) => s.balance.produccion), C.past),
            lineSeries("Revisada", seasons.map((s) => revised[s.temporada] ?? null), C.s1),
          ],
        };
      },
      table: () => {
        const revised = Object.fromEntries(H.produccion.map((r) => [r.temporada, r.total]));
        return {
          head: ["Zafra", "Al cierre t", "Revisada t", "Diferencia"],
          rows: seasons.map((s) => {
            const r = revised[s.temporada];
            return [s.temporada, num(s.balance.produccion), num(r), r == null ? "–" : num(r - s.balance.produccion)];
          }),
        };
      },
    },

    balance: {
      title: "Exportado, consumo local y remanente",
      sub: () => "Toneladas sucias al cierre de cada zafra",
      legend: () => [
        { label: "Exportado", color: C.s1 },
        { label: "Consumo local", color: C.s4 },
        { label: "Remanente", color: C.ink2, line: true },
      ],
      foot: "Remanente = disponibilidad − consumo local − exportado. Los balances de años consecutivos no encadenan: la FLA reestima el remanente inicial.",
      option() {
        return {
          ...base(),
          tooltip: { ...axisTip(), valueFormatter: (v) => tons(v) },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => num(v)),
          series: [
            {
              name: "Exportado",
              type: "bar",
              stack: "b",
              barMaxWidth: 18,
              data: seasons.map((s) => s.balance.exportado),
              itemStyle: { color: C.s1, borderColor: C.surface, borderWidth: 1 },
            },
            {
              name: "Consumo local",
              type: "bar",
              stack: "b",
              barMaxWidth: 18,
              data: seasons.map((s) => s.balance.consumo_local),
              itemStyle: { color: C.s4, borderColor: C.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] },
            },
            lineSeries("Remanente", seasons.map((s) => s.balance.remanente_total), C.ink2, { symbolSize: 4 }),
          ],
        };
      },
      table: () => ({
        head: ["Zafra", "Remanente previo", "Producción", "Consumo local", "Exportado", "Remanente", "Stock operativo"],
        rows: seasons.map((s) => {
          const b = s.balance;
          return [s.temporada, num(b.saldo_previo), num(b.produccion), num(b.consumo_local), num(b.exportado), num(b.remanente_total), num(b.stock_operativo)];
        }),
      }),
    },

    calor: {
      title: "Toneladas limpias por mes",
      sub: () => `${clean[0].temporada} a ${last.temporada}`,
      foot: "* Junio con ajuste anual de exportadores no socios. Fuente: tabla mensual de cada informe anual.",
      height: "tall",
      option() {
        const data = [];
        let max = 0;
        clean.forEach((s, y) =>
          s.mensual.forEach((m, x) => {
            data.push([x, y, m.t]);
            max = Math.max(max, m.t);
          }),
        );
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
          tooltip: {
            ...base().tooltip,
            formatter: (p) => {
              const s = clean[p.value[1]];
              const m = s.mensual[p.value[0]];
              return `<b>${SEASON_MONTHS[p.value[0]]} · ${s.temporada}</b><br>${tons(m.t)}${m.usd ? ` · ${usdM(m.usd)}` : ""}${
                m.ajuste_anual ? "<br><i>Incluye ajuste anual de no socios</i>" : ""
              }`;
            },
          },
          xAxis: axisCat(SEASON_MONTHS, { position: "top", splitArea: { show: false } }),
          yAxis: axisCat(clean.map((s) => s.temporada + (s.mensual[11].ajuste_anual ? " *" : "")), { inverse: true }),
          visualMap: {
            min: 0,
            max,
            calculable: false,
            orient: "horizontal",
            left: "center",
            bottom: 4,
            itemWidth: 12,
            itemHeight: 200,
            textStyle: { color: C.muted, fontSize: 11 },
            formatter: (v) => num(v),
            inRange: { color: C.seq },
          },
          series: [
            {
              type: "heatmap",
              data,
              itemStyle: { borderColor: C.surface, borderWidth: 2, borderRadius: 3 },
              emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 1 } },
            },
          ],
        };
      },
      table: () => ({
        head: ["Temporada", ...SEASON_MONTHS],
        rows: clean.map((s) => [s.temporada, ...s.mensual.map((m) => num(m.t) + (m.ajuste_anual ? "*" : ""))]),
      }),
    },

    patagonia: {
      title: "Salida por puertos patagónicos",
      sub: () => "Participación de las toneladas limpias embarcadas en puertos de la Patagonia",
      foot: "El resto sale por puertos no patagónicos, casi todo por Buenos Aires. Antes de 2005/06 la tabla de puertos está en peso efectivo y no se usa.",
      height: "short",
      option() {
        return {
          ...base(),
          tooltip: { ...base().tooltip, trigger: "axis", valueFormatter: (v) => pct(v, 1) },
          xAxis: axisCat(clean.map((s) => s.temporada), { boundaryGap: false }),
          yAxis: axisVal((v) => `${Math.round(v * 100)}%`, { min: 0, max: 1 }),
          series: [lineSeries("Patagonia", clean.map((s) => s.patagonia_pct), C.s3)],
        };
      },
      table: () => ({
        head: ["Temporada", "Puertos patagónicos"],
        rows: clean.map((s) => [s.temporada, pct(s.patagonia_pct, 1)]),
      }),
    },
  };

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
    const peak = seasons.reduce((a, b) => (b.total_t > a.total_t ? b : a));
    const peakUsd = seasons.reduce((a, b) => (b.ingresos_usd > a.ingresos_usd ? b : a));
    const prod = H.produccion;
    const p0 = prod[0];
    const pN = prod[prod.length - 1];
    const lead = last.destinos[0];
    const lead0 = first.destinos[0];
    const tile = (label, value, unit, delta, hero = false) =>
      `<div class="tile${hero ? " hero" : ""}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit}</span></div><div class="delta">${delta}</div></div>`;
    document.getElementById("kpis").innerHTML = [
      tile(
        `Exportado en ${last.temporada}`,
        num(last.total_t),
        "t limpias",
        `Máximo de la serie: ${tons(peak.total_t)} en ${peak.temporada}. En ${first.temporada}: ${tons(first.total_t)}.`,
        true,
      ),
      tile(
        `Ingreso de divisas ${last.temporada}`,
        num(last.ingresos_usd / 1e6),
        "M USD",
        `Máximo: ${usdM(peakUsd.ingresos_usd)} en ${peakUsd.temporada}.`,
      ),
      tile(
        `Producción ${pN.temporada}`,
        num(pN.total),
        "t sucias",
        `<span class="down">▼ ${pct(1 - pN.total / p0.total)}</span> desde ${p0.temporada} (${tons(p0.total)}).`,
      ),
      tile(
        `Primer destino ${last.temporada}`,
        esc(lead.pais),
        "",
        `${pct(lead.t / last.destinos_total_t)} de las toneladas. En ${first.temporada}: ${esc(lead0.pais)}, ${pct(lead0.t / first.destinos_total_t)} en peso efectivo.`,
      ),
    ].join("");
    document.getElementById("kpi-note").textContent =
      `${seasons.length} temporadas, de ${first.temporada} a ${last.temporada}, cada una según su informe anual (EL ${first.numero} a EL ${last.numero}).` +
      (last.mensual?.[11]?.ajuste_anual ? ` ${last.temporada} incluye el ajuste anual de no socios de junio.` : "");
  }

  function renderTexts() {
    document.getElementById("sub").textContent =
      `Informes anuales de la Federación Lanera Argentina, ${first.temporada} a ${last.temporada}`;
    const china = seasons.map((s) => ({ s, share: (s.destinos.find((d) => d.pais === "China")?.t || 0) / s.destinos_total_t }));
    const chinaTop = china.reduce((a, b) => (b.share > a.share ? b : a));
    document.getElementById("destinos-lede").textContent =
      `${H.paises.length} países compraron lana argentina en algún año de la serie. ` +
      `China fue el primer destino en ${seasons.filter((s) => s.destinos[0].pais === "China").length} de ${seasons.length} temporadas; ` +
      `su mayor participación fue ${pct(chinaTop.share)} en ${chinaTop.s.temporada}.`;

    const mark = (ok, old) => (ok ? (old ? "○" : "●") : "–");
    const ROWS = [
      ["Toneladas limpias por producto", () => true, () => false],
      ["Ingresos por producto", () => true, () => false],
      ["Destinos", () => true, (s) => s.base === "efectiva"],
      ["Finura (clases)", () => true, (s) => s.base === "efectiva"],
      ["Micrones", (s) => s.micron_promedio != null, () => false],
      ["Tabla mensual", (s) => !!s.mensual, () => false],
      ["Puertos", (s) => s.patagonia_pct != null, () => false],
      ["Balance (totales)", () => true, () => false],
      ["Balance por finura", (s) => s.base === "limpia", () => false],
    ];
    document.getElementById("disponibilidad").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Serie</th>${seasons
      .map((s) => `<th>${s.temporada.replace("/", "/<wbr>")}</th>`)
      .join("")}</tr></thead><tbody>${ROWS.map(
      ([label, has, old]) => `<tr><td>${label}</td>${seasons.map((s) => `<td style="text-align:center">${mark(has(s), old(s))}</td>`).join("")}</tr>`,
    ).join("")}</tbody></table></div>`;

    const avisos = seasons.flatMap((s) => s.avisos.map((a) => [s.temporada, a]));
    document.getElementById("avisos").innerHTML = avisos.length
      ? `<div class="table-wrap"><table><thead><tr><th>Temporada</th><th>Tablas que no coinciden (t)</th></tr></thead><tbody>${avisos
          .map(([t, a]) => `<tr><td>${t}</td><td style="text-align:left;white-space:normal">${esc(a)}</td></tr>`)
          .join("")}</tbody></table></div>`
      : "<p class='note'>Ninguna.</p>";

    document.getElementById("informes").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Informe</th><th>Temporada</th><th>Publicado</th><th>Base</th><th>PDF</th></tr></thead><tbody>${[...seasons]
      .reverse()
      .map(
        (s) =>
          `<tr><td>EL ${s.numero}</td><td>${s.temporada}</td><td>${s.emision ? longDate(s.emision) : "–"}</td><td>${s.base}</td><td><a href="../data/raw/anuales/${encodeURI(
            s.archivo,
          )}">local</a>${s.url ? ` · <a href="${esc(s.url)}" rel="noopener">FLA</a>` : ""}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;

    document.getElementById("foot").textContent =
      `Datos generados el ${longDate(H.generado)} con build.py a partir de los PDF de la FLA. Uso personal.`;
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
