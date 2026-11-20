// Dibuja la página de oportunidades a partir de window.OPORTUNIDADES, window.HISTORIA,
// window.INDUSTRIA, window.CADENA y window.DATA (generados por build.py). Las cuentas que
// cruzan las páginas están en pipeline/opportunities.py; aquí sólo hay búsquedas, cocientes
// para el texto y agregados de presentación. Los ayudantes de formato, tema y tarjetas son
// copia de los de industria.js.
(() => {
  "use strict";

  const O = window.OPORTUNIDADES;
  const H = window.HISTORIA;
  const I = window.INDUSTRIA;
  const K = window.CADENA;
  const D = window.DATA;

  const seasons = H.temporadas;
  const cats = seasons.map((s) => s.temporada);
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const years = I.comercio.anios;
  const lastY = years[years.length - 1];
  const consumo = I.consumo;
  const lastC = consumo[consumo.length - 1];
  const prevC = consumo[consumo.length - 2];
  const FIN = O.finura;
  const closedF = [...FIN].reverse().find((s) => s.completa);
  const currentF = FIN[FIN.length - 1];
  const hasCurrent = currentF !== closedF;
  const ST = Object.fromEntries(O.tramos.map((t) => [t.id, t]));
  const OP = Object.fromEntries(O.oportunidades.map((o) => [o.id, o]));
  const baseOf = (o, s) => o.bases.find((b) => b.temporada === s.temporada);
  const gapOf = (s) => O.brecha.find((g) => g.temporada === s.temporada);
  // Brecha del paso 0: sin el mes del ajuste anual de no socios cuando la temporada lo trae.
  const combGap = (s) => gapOf(s).sin_ajuste ?? gapOf(s);
  const LQ = O.liquidacion;
  const TEE = O.micron_remera;
  const price = K.precio_usd;
  const topsG = K.masas.peinada_g;
  const tops = K.peinada;
  const fineTee = K.escenarios.find((e) => e.id === "peinada_fina");
  // Parte sin peinar con todas las finuras, en los mismos meses de la temporada en curso y la anterior.
  const sameMonths = (() => {
    const c = D.comparacion;
    const share = (t) => (t.sucia + t.lavada) / (t.sucia + t.lavada + t.peinada);
    return { meses: c.meses, etiqueta: c.actual.etiqueta, antes: share(c.anterior.toneladas), ahora: share(c.actual.toneladas) };
  })();

  // Etapas de la FLA en el orden de la cadena y con los colores de historia.js e industria.js;
  // blousse y subproductos van juntos.
  const FSTAGES = ["sucia", "lavada", "peinada", "resto", "manuf"];
  const FNAME = {
    sucia: "Sucia",
    lavada: "Lavada",
    peinada: "Peinada (tops)",
    resto: "Blousse y subproductos",
    manuf: "Hilados y tejidos",
  };
  const FSLOT = { sucia: "s1", lavada: "s4", peinada: "s2", resto: "s3", manuf: "ink" };
  const fT = (s, k) => {
    const t = s.toneladas;
    if (k === "resto") return (t.blousse || 0) + (t.subproductos || 0);
    if (k === "manuf") return (t.hilados || 0) + (t.tejidos || 0);
    return t[k] || 0;
  };

  // ------------------------------------------------------------ formato

  const nf = {};
  const num = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    nf[d] ??= new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  const tons = (v) => `${num(v)} t`;
  const usd = (v, d = 2) => (v == null ? "–" : `${num(v, d)} USD`);
  const usdM = (v, d = 1) => `${num(v / 1e6, d)} millones de USD`;
  const perKg = (v, d = 2) => (v == null ? "–" : `${num(v, d)} USD/kg`);
  const pct = (v, d = 0) => (v == null ? "–" : `${num(v * 100, d)} %`);
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const link = (url, text) => `<a href="${esc(url)}" rel="noopener">${esc(text)}</a>`;
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const monthName = (ym) =>
    new Date(`${ym}-15T12:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const micron = (v) => `${num(v, 1)} µ`;
  const bandLabel = (b) =>
    b.desde == null ? `Hasta ${micron(b.hasta)}` : b.hasta == null ? `${micron(b.desde)} o más` : `${num(b.desde, 1)} a ${micron(b.hasta)}`;
  const seasonLabel = (s) => (s.completa ? s.temporada : `${s.temporada} hasta ${monthName(s.hasta)}`);

  // Bandas de finura de pipeline/opportunities.py.
  const uncombed = (b) => b.t.sucia + b.t.lavada;
  const fibre = (b) => b.t.sucia + b.t.lavada + b.t.peinada;
  const byproducts = (b) => b.t.blousse + b.t.subproductos;
  const bandTotal = (b) => sum(Object.values(b.t));
  const upTo = (s, mic) => s.bandas.filter((b) => b.hasta != null && b.hasta <= mic);
  const teeBand = (s) => upTo(s, TEE);
  const bandShare = (bs) => sum(bs.map(uncombed)) / sum(bs.map(fibre));

  // Comercio: el último año con hilado declarado por Argentina, y desde cuándo la FLA anota 0.
  const lastYarnYear = [...years].reverse().find((y) => y.exportaciones.hilados.kg > 0)?.anio;
  const flaZeroSince = (() => {
    const rows = I.manufacturas;
    const lastPos = rows.map((m) => (m.hilados.t || 0) + (m.tejidos.t || 0) > 0).lastIndexOf(true);
    return lastPos >= 0 && lastPos < rows.length - 1 ? rows[lastPos + 1].temporada : null;
  })();
  // Balance estimado de la temporada en curso, del último informe mensual que lo trae.
  const nowBalance = (() => {
    const b = hasCurrent ? D.temporadas.find((s) => s.temporada === currentF.temporada)?.balance : null;
    return b?.__total__ && b.fina ? b : null;
  })();
  // Peinada menos sucia por kilo limpio en cada temporada anual, y las cinco anteriores a la última.
  const gapH = (s) => s.usd_kg_producto.peinada - s.usd_kg_producto.sucia;
  const prev5 = seasons.slice(-6, -1);

  const comparablesText = (id) =>
    OP[id].comparables
      .map((c) => {
        const parts = [];
        if (c.bruto != null) parts.push(`${pct(c.bruto, 1)} bruto`);
        if (c.operativo != null) parts.push(`${pct(c.operativo, 1)} operativo`);
        return `${esc(c.empresa)}, ${c.anio}: ${parts.join(", ")}${c.releido ? "" : " (sin releer)"}`;
      })
      .join("; ");
  // Lo que sumarían hilar, tejer y coser la peinada de remera de la última temporada cerrada.
  const factoryCeiling = () => sum(["hilar", "tejer", "confeccionar"].map((id) => baseOf(OP[id], closedF).techo_usd));
  // Margen bruto de referencia de un eslabón sobre el de otro, de la tabla de cadena.html.
  const grossOf = (id) => Math.max(...OP[id].comparables.map((c) => c.bruto ?? 0));

  // Hasta qué año la peinada que Argentina informa a Comtrade coincide con la FLA (como en industria.js).
  const underReportFrom = (() => {
    const fla = Object.fromEntries(I.calendario.map((c) => [c.anio, c.peinada_t]));
    const off = years.find((y) => fla[y.anio] && Math.abs(y.exportaciones.peinada.kg / 1e3 / fla[y.anio] - 1) > 0.05);
    const lastRatio = fla[lastY.anio] ? lastY.exportaciones.peinada.kg / 1e3 / fla[lastY.anio] : null;
    return off ? { anio: off.anio, ultimo: lastRatio } : null;
  })();
  const yarnCaveat = () =>
    underReportFrom
      ? `Ese cero pesa poco: desde ${underReportFrom.anio} Argentina declara a Comtrade menos peinada que la FLA (en ${lastY.anio}, ${pct(underReportFrom.ultimo)}). `
      : "";
  // El ajuste anual de exportadores no socios, mes y toneladas por producto, si la temporada lo trae.
  const adjustment = (season) => D.meses.find((m) => m.temporada === season && m.ajuste_anual) ?? null;
  const adjustedSeasons = seasons.filter((s) => s.mensual?.some((m) => m.ajuste_anual)).map((s) => s.temporada);
  const manufMax = seasons.reduce((a, b) => (fT(b, "manuf") > fT(a, "manuf") ? b : a));

  // Margen bruto de las empresas de referencia de un eslabón, como rango; el detalle está en las tarjetas.
  const grossRange = (id) => {
    const xs = OP[id].comparables.map((c) => c.bruto).filter((v) => v != null);
    if (!xs.length) return "–";
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    return lo === hi ? pct(lo) : `${num(lo * 100)} a ${pct(hi)}`;
  };

  // ------------------------------------------------------------ tema

  let C = {};
  function readTokens() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(`--${n}`).trim();
    C = {
      page: v("page"), surface: v("surface"), ink: v("ink"), ink2: v("ink-2"), muted: v("muted"),
      grid: v("grid"), axis: v("axis"), border: v("border"), past: v("past"), empty: v("empty"),
      s1: v("s1"), s2: v("s2"), s3: v("s3"), s4: v("s4"), s5: v("s5"),
    };
  }
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

  let finSeason = closedF;

  // Etapas de la remera de cadena.html, con nombre de lo que sale de cada una.
  const TNAME = {
    peinada: "Peinada",
    hilado: "Hilado",
    tela: "Tela",
    confeccion: "Remera en fábrica",
    importacion: "Remera en EE. UU.",
    tienda: "Remera en la tienda",
  };
  // Lo que agrega cada paso por kilo de peinada; el peinado sale de la brecha de precios FLA.
  const stepRows = () => {
    const g = combGap(closedF);
    const note = gapOf(closedF).sin_ajuste ? ", sin el ajuste de junio" : "";
    return [
      { label: "Peinar (lavado y peinado)", costos: null, ganancia: null, total: g.usd_kg, src: `FLA ${closedF.temporada}: peinada menos sucia${note}` },
      ...["hilado", "tela", "confeccion"].map((id) => ({
        label: { hilado: "Hilar", tela: "Tejer, teñir y terminar", confeccion: "Cortar y coser" }[id],
        costos: ST[id].agrega_kg - ST[id].ganancia_kg,
        ganancia: ST[id].ganancia_kg,
        total: ST[id].agrega_kg,
        src: "Remera de cadena.html",
      })),
    ];
  };

  const SPECS = {
    panorama: {
      title: "Producción, exportación y uso de la lana en el país",
      sub: () => `Toneladas base sucia por temporada, ${first.temporada} a ${last.temporada}, del balance de cada informe anual`,
      legend: () => [
        { label: "Producción", color: C.s1, line: true },
        { label: "Exportado", color: C.s2, line: true },
        { label: "Remanente al cierre", color: C.s4, line: true },
        { label: "Usado por la industria del país", color: C.s3, line: true },
      ],
      foot: "El remanente es disponibilidad menos consumo y exportación: una estimación de la FLA, no un stock medido. Hasta 2018/19 el consumo del país es casi siempre una cifra redonda.",
      option() {
        const b = (k) => seasons.map((s) => s.balance?.[k] ?? null);
        const series = [
          ["Producción", b("produccion"), C.s1],
          ["Exportado", b("exportado"), C.s2],
          ["Remanente al cierre", b("remanente_total"), C.s4],
          ["Usado por la industria del país", b("consumo_local"), C.s3],
        ];
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            formatter: (ps) =>
              `<b>${cats[ps[0].dataIndex]}</b><br>` +
              ps.map((p) => `${swatch(p.color)}${p.seriesName}: <b>${tons(p.value)}</b>`).join("<br>"),
          },
          xAxis: axisCat(cats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v)),
          series: series.map(([n, d, c]) => lineSeries(n, d, c)),
        };
      },
      table: () => ({
        head: ["Temporada", "Producción t", "Exportado t", "Remanente t", "Industria del país t", "Exportado / producción"],
        rows: seasons.map((s) => [
          s.temporada,
          num(s.balance.produccion),
          num(s.balance.exportado),
          num(s.balance.remanente_total),
          num(s.balance.consumo_local),
          pct(s.balance.exportado / s.balance.produccion),
        ]),
      }),
    },

    frontera: {
      title: "En qué etapa sale la lana",
      sub: () => `Toneladas limpias exportadas por producto, ${first.temporada} a ${last.temporada}`,
      legend: () => FSTAGES.map((k) => ({ label: FNAME[k], color: C[FSLOT[k]] })),
      foot: () =>
        `Informes anuales de la FLA. Hilados y tejidos llegan como máximo a ${tons(fT(manufMax, "manuf"))} (${manufMax.temporada}): casi no se ven. Hasta 2004/05 las toneladas limpias salen del “equivalente teórico base limpia”.`,
      height: "tall",
      option() {
        const data = stacked(FSTAGES, seasons, fT);
        return {
          ...base(),
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const s = seasons[ps[0].dataIndex];
              const rows = FSTAGES.filter((k) => fT(s, k))
                .map((k) => `${swatch(C[FSLOT[k]])}${FNAME[k]}: <b>${tons(fT(s, k))}</b> · ${pct(fT(s, k) / s.total_t)}`)
                .join("<br>");
              return `<b>${s.temporada}</b><br>${rows}<br>Total: <b>${tons(s.total_t)}</b>`;
            },
          },
          xAxis: axisCat(cats),
          yAxis: axisVal((v) => num(v)),
          series: FSTAGES.map((k, i) => barSeries(FNAME[k], data[i], C[FSLOT[k]])),
        };
      },
      table: () => ({
        head: ["Temporada", ...FSTAGES.map((k) => `${FNAME[k]} t`), "Total t"],
        rows: seasons.map((s) => [s.temporada, ...FSTAGES.map((k) => num(fT(s, k))), num(s.total_t)]),
      }),
    },

    finura: {
      title: "Toneladas exportadas por finura y etapa",
      sub: () => `Toneladas limpias, ${seasonLabel(finSeason)}. A la derecha, la parte de cada banda que sale sin peinar`,
      legend: () => [
        { label: "Sin peinar (sucia y lavada)", color: C.s1 },
        { label: "Peinada", color: C.s2 },
        { label: "Blousse y subproductos", color: C.s3 },
      ],
      foot: () =>
        `Tabla de micronaje de los informes mensuales de la FLA, en bandas que juntan sus filas. La parte sin peinar es sucia y lavada sobre sucia, lavada y peinada: blousse y subproductos quedan fuera porque sólo existen donde alguien ya peinó. ` +
        (finSeason.completa ? "" : "Temporada en curso: sin el ajuste anual de exportadores no socios, que llega en junio."),
      option() {
        const bands = finSeason.bandas;
        const labels = bands.map(bandLabel);
        const keys = ["sin", "peinada", "resto"];
        const get = (b, k) => (k === "sin" ? uncombed(b) : k === "peinada" ? b.t.peinada : byproducts(b));
        const data = stacked(keys, bands, get, [0, 4, 4, 0]);
        const names = ["Sin peinar (sucia y lavada)", "Peinada", "Blousse y subproductos"];
        const colors = [C.s1, C.s2, C.s3];
        const series = keys.map((k, i) => barSeries(names[i], data[i], colors[i], { barMaxWidth: 26 }));
        series[series.length - 1].label = {
          show: true,
          position: "right",
          color: C.ink2,
          fontSize: 11,
          formatter: (p) => (bands[p.dataIndex].sin_peinar_pct == null ? "" : `${pct(bands[p.dataIndex].sin_peinar_pct)} sin peinar`),
        };
        return {
          ...base(),
          grid: { left: 8, right: 110, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const b = bands[ps[0].dataIndex];
              return (
                `<b>${bandLabel(b)}</b><br>` +
                ["sucia", "lavada", "peinada", "blousse", "subproductos"]
                  .filter((p) => b.t[p])
                  .map((p) => `${p[0].toUpperCase() + p.slice(1)}: <b>${tons(b.t[p])}</b>`)
                  .join("<br>") +
                `<br>Sale sin peinar: <b>${pct(b.sin_peinar_pct)}</b>`
              );
            },
          },
          xAxis: axisVal((v) => num(v)),
          yAxis: axisCat(labels, { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series,
        };
      },
      table: () => ({
        head: ["Banda", "Sucia t", "Lavada t", "Peinada t", "Blousse t", "Subproductos t", "Sin peinar"],
        rows: finSeason.bandas.map((b) => [
          bandLabel(b),
          num(b.t.sucia),
          num(b.t.lavada),
          num(b.t.peinada),
          num(b.t.blousse),
          num(b.t.subproductos),
          pct(b.sin_peinar_pct),
        ]),
      }),
    },

    queda: {
      title: "Cuánto del precio queda en el país",
      sub: () => `Si la remera de ${usd(price, 0)} sale del país en cada etapa, con todas las anteriores hechas en él`,
      foot: () =>
        `Lo que vale la remera al salir de cada etapa sobre su precio en la tienda, según cadena.html. En gris, el flete y el arancel de EE. UU. (${pct(K.arancel.total, 1)}): quedan fuera de esta página.`,
      height: "short",
      option() {
        const rows = O.tramos;
        return {
          ...base(),
          grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const t = rows[ps[0].dataIndex];
              return `<b>${TNAME[t.id]}</b><br>Vale <b>${usd(t.vende_usd)}</b> por remera<br><b>${pct(t.queda_pct, 1)}</b> del precio en la tienda` + (t.exogeno ? "<br>Flete y arancel: fuera del análisis" : "");
            },
          },
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          xAxis: axisVal((v) => `${Math.round(v * 100)} %`, { min: 0, max: 1 }),
          yAxis: axisCat(rows.map((t) => TNAME[t.id]), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: [
            {
              type: "bar",
              barMaxWidth: 22,
              data: rows.map((t) => ({ value: t.queda_pct, itemStyle: { color: t.exogeno ? C.past : C.s2, borderRadius: [0, 4, 4, 0] } })),
              label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (p) => pct(p.value, 1) },
            },
          ],
        };
      },
      table: () => ({
        head: ["Sale como", "Vale por remera", "Del precio"],
        rows: O.tramos.map((t) => [TNAME[t.id] + (t.exogeno ? " (exógeno)" : ""), usd(t.vende_usd), pct(t.queda_pct, 1)]),
      }),
    },

    agrega: {
      title: "Lo que agrega cada paso, por kilo de peinada",
      sub: () =>
        `Dólares por kilo de peinada que entra a la remera. Fuera de escala: marca y tienda agregan ${perKg(ST.tienda.agrega_kg, 0)}, de los que ${perKg(ST.tienda.ganancia_kg, 0)} son ganancia`,
      legend: () => [
        { label: "Costos (mano de obra, energía, insumos, máquinas)", color: C.s1 },
        { label: "Ganancia", color: C.s3 },
        { label: "Sin desglose", color: C.s4 },
      ],
      foot: () =>
        `Hilar, tejer y coser: la remera de cadena.html dividida por los ${num(topsG)} g de peinada que lleva; la ganancia es el margen operativo de una empresa cotizada de cada etapa. Peinar: la diferencia de precio FLA entre peinada y sucia en ${closedF.temporada}${gapOf(closedF).sin_ajuste ? " sin el mes del ajuste anual de no socios" : ""}, que mezcla finuras y no se puede separar en costo y ganancia.`,
      height: "short",
      option() {
        const rows = stepRows();
        const keys = ["costos", "ganancia", "total"];
        const get = (r, k) => (k === "total" ? (r.costos == null ? r.total : null) : r[k]);
        const data = stacked(keys, rows, get, [0, 4, 4, 0]);
        const series = [
          barSeries("Costos", data[0], C.s1, { barMaxWidth: 24 }),
          barSeries("Ganancia", data[1], C.s3, { barMaxWidth: 24 }),
          barSeries("Sin desglose", data[2], C.s4, { barMaxWidth: 24 }),
        ];
        series[2].label = undefined;
        return {
          ...base(),
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              const split = r.costos == null ? "" : `<br>Costos: <b>${perKg(r.costos)}</b><br>Ganancia: <b>${perKg(r.ganancia)}</b>`;
              return `<b>${r.label}</b><br>Agrega: <b>${perKg(r.total)}</b>${split}<br>${esc(r.src)}`;
            },
          },
          xAxis: axisVal((v) => num(v)),
          yAxis: axisCat(rows.map((r) => r.label), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: [
            ...series,
            {
              // Total a la derecha de cada barra, sin marca propia.
              type: "bar",
              stack: "t",
              data: rows.map(() => 0),
              itemStyle: { color: "transparent" },
              label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (p) => num(rows[p.dataIndex].total, 1) },
              tooltip: { show: false },
            },
          ],
        };
      },
      table: () => ({
        head: ["Paso", "Agrega USD/kg", "Costos USD/kg", "Ganancia USD/kg", "Fuente"],
        rows: [
          ...stepRows().map((r) => [r.label, num(r.total, 2), r.costos == null ? "–" : num(r.costos, 2), r.ganancia == null ? "–" : num(r.ganancia, 2), r.src]),
          ["Marca y tienda", num(ST.tienda.agrega_kg, 2), num(ST.tienda.agrega_kg - ST.tienda.ganancia_kg, 2), num(ST.tienda.ganancia_kg, 2), "Remera de cadena.html"],
        ],
      }),
    },

    hilado: {
      title: "Hilado de lana argentino: lo que declara Argentina y lo que declaran los compradores",
      sub: () => `Toneladas por año, ${years[0].anio} a ${lastY.anio} (UN Comtrade, partidas 5106, 5107 y 5109)`,
      legend: () => [
        { label: "Importado desde Argentina, según los compradores", color: C.s2, line: true },
        { label: "Exportado, según Argentina", color: C.s1, line: true },
      ],
      foot: () =>
        `Los compradores declaran en CIF y peso neto. Desde ${lastYarnYear + 1} Argentina no declara exportaciones de hilado. ${yarnCaveat()}En los archivos de los compradores casi todo es la partida 5107 (hilado de lana peinada, no acondicionado para la venta al por menor) y el comprador principal es Turquía.`,
      height: "short",
      option() {
        const mirror = years.map((y) => (y.espejo ? y.espejo.hilados.kg / 1e3 : null));
        const own = years.map((y) => y.exportaciones.hilados.kg / 1e3);
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            formatter: (ps) => {
              const y = years[ps[0].dataIndex];
              const m = y.espejo?.hilados;
              return (
                `<b>${y.anio}</b><br>${swatch(C.s2)}Compradores: <b>${m ? tons(m.kg / 1e3) : "–"}</b>${m?.usd_kg ? ` a ${perKg(m.usd_kg)}` : ""}` +
                `<br>${swatch(C.s1)}Argentina: <b>${tons(y.exportaciones.hilados.kg / 1e3)}</b>${y.exportaciones.hilados.usd_kg ? ` a ${perKg(y.exportaciones.hilados.usd_kg)}` : ""}`
              );
            },
          },
          xAxis: axisCat(years.map((y) => String(y.anio)), { boundaryGap: false }),
          yAxis: axisVal((v) => num(v)),
          series: [
            lineSeries("Compradores", mirror, C.s2),
            lineSeries("Argentina", own, C.s1),
          ],
        };
      },
      table: () => ({
        head: ["Año", "Compradores t", "Compradores USD/kg", "Argentina t", "Peinada, compradores USD/kg"],
        rows: years.map((y) => [
          y.anio,
          y.espejo ? num(y.espejo.hilados.kg / 1e3, 1) : "–",
          y.espejo?.hilados.usd_kg ? num(y.espejo.hilados.usd_kg, 2) : "–",
          num(y.exportaciones.hilados.kg / 1e3, 1),
          y.espejo?.peinada.usd_kg ? num(y.espejo.peinada.usd_kg, 2) : "–",
        ]),
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
    el.innerHTML = tableHtml(t.head, t.rows);
  }

  const tableHtml = (head, rows, raw = false) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => (raw && typeof c === "object" ? `<td class="${c.cls || ""}">${c.html}</td>` : `<td>${esc(c)}</td>`)).join("")}</tr>`)
      .join("")}</tbody></table>`;

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
    instances[id].setOption(spec.option(), true);
    renderTable(id);
  }

  // ------------------------------------------------------------ textos

  const tile = (label, value, unit, delta, hero = false) =>
    `<div class="tile${hero ? " hero" : ""}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit}</span></div><div class="delta">${delta}</div></div>`;

  function renderKpis() {
    const teeC = teeBand(closedF);
    const esp = lastY.espejo;
    document.getElementById("kpis").innerHTML = [
      tile(
        `De una remera de merino de ${num(price)} USD, queda en el país`,
        num(ST.peinada.vende_usd, 2),
        "USD",
        `${pct(ST.peinada.queda_pct, 1)} del precio, con la peinada al promedio argentino; con peinada fina de 18,5 µ al precio australiano, ${usd(fineTee.peinada_usd)} (${pct(fineTee.peinada_usd / price, 1)}). Si la remera saliera terminada de una fábrica argentina, el modelo de la cadena deja hasta ${usd(ST.confeccion.vende_usd)} (${pct(ST.confeccion.queda_pct, 1)}).`,
        true,
      ),
      tile(
        `Lana de remera (hasta ${micron(TEE)}) que sale sin peinar`,
        num(bandShare(teeC) * 100),
        "%",
        `${tons(sum(teeC.map(uncombed)))} de ${tons(sum(teeC.map(fibre)))} exportadas en ${closedF.temporada} salieron sucias o lavadas.` +
          ` Con todas las finuras y los mismos meses (${sameMonths.etiqueta} contra el año anterior), la parte sin peinar pasó de ${pct(sameMonths.antes)} a ${pct(sameMonths.ahora)}.`,
      ),
      tile(
        `Lana que usa la industria del país, ${lastC.temporada}`,
        num(lastC.consumo_pct * 100, 1),
        "%",
        `${tons(lastC.consumo_local)} base sucia de ${tons(lastC.produccion)} producidas; de lana fina, ${tons(lastC.finura.fina)}.` +
          (nowBalance ? ` La estimación de ${currentF.temporada} vuelve a ${tons(nowBalance.__total__.consumo_local)}, ${tons(nowBalance.fina.consumo_local)} de fina.` : ""),
      ),
      tile(
        `Hilado argentino que declaran los compradores, ${lastY.anio}`,
        num(esp.hilados.kg / 1e3),
        "t",
        `A ${perKg(esp.hilados.usd_kg)}, cerca de los ${perKg(K.parametros.hilado_fino_usd_kg.valor, 0)} del hilado fino de la cadena. Argentina no declara hilado exportado desde ${lastYarnYear + 1}` +
          (underReportFrom
            ? underReportFrom.anio === lastYarnYear + 1
              ? `, el mismo año en que empieza a declarar a Comtrade menos peinada que la FLA: su cero pesa poco.`
              : `, y desde ${underReportFrom.anio} declara a Comtrade menos peinada que la FLA: su cero pesa poco.`
            : "."),
      ),
    ].join("");
  }

  function renderTexts() {
    document.getElementById("sub").textContent =
      `Las tres investigaciones juntas: FLA ${first.temporada}–${currentF.temporada}, UN Comtrade ${years[0].anio}–${lastY.anio} y la cadena de una remera de ${num(price)} dólares`;
    document.querySelectorAll(".tee-micron").forEach((el) => (el.textContent = micron(TEE)));

    // 1. Tamaño
    const p0 = first.balance.produccion;
    const p1 = last.balance.produccion;
    document.getElementById("panorama-lede").textContent =
      `La producción de lana bajó de ${tons(p0)} base sucia en ${first.temporada} a ${tons(p1)} en ${last.temporada}, ${pct(1 - p1 / p0)} menos. ` +
      `Casi toda se exporta: la industria del país usó ${tons(lastC.consumo_local)} en ${lastC.temporada}, ${pct(lastC.consumo_pct, 1)} de lo producido. ` +
      `En ${LQ.temporada} se exportó ${pct(LQ.exportado_sobre_produccion)} de lo producido: el remanente bajó de ${tons(LQ.remanente_previo)} a ${tons(LQ.remanente)}. ` +
      `Esa temporada vendió stock, así que sus toneladas son altas para un año normal; esta página la usa porque es la última cerrada, y muestra al lado la temporada en curso.`;

    // 2. Frontera
    const peakP = seasons.reduce((a, b) => (b.toneladas.peinada > a.toneladas.peinada ? b : a));
    const peakL = seasons.reduce((a, b) => (b.toneladas.lavada > a.toneladas.lavada ? b : a));
    const dirty = (s) => s.toneladas.sucia / s.total_t;
    const combed = (s) => s.toneladas.peinada / s.balance.produccion;
    const sorted = seasons.map(combed).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const cmp = D.comparacion;
    const growth = (k) => cmp.actual.toneladas[k] / cmp.anterior.toneladas[k] - 1;
    const adj = adjustment(last.temporada);
    document.getElementById("frontera-lede").innerHTML =
      `La industria llega hasta el peinado. La peinada exportada bajó de ${tons(peakP.toneladas.peinada)} en ${peakP.temporada} a ${tons(last.toneladas.peinada)} en ${last.temporada}: se peina una parte parecida de una producción menor. ` +
      `Las toneladas limpias de peinada exportada equivalen al ${pct(combed(last))} de la producción base sucia en ${last.temporada}, y al ${pct(median)} en la temporada mediana de las ${seasons.length}. ` +
      `Lo que sí desapareció es la lana lavada, de ${tons(peakL.toneladas.lavada)} (${peakL.temporada}) a ${tons(last.toneladas.lavada)}` +
      (flaZeroSince ? `, y el hilado y el tejido, en 0 desde ${flaZeroSince}. ` : ". ") +
      `La lana sucia fue ${pct(dirty(last))} del volumen de ${last.temporada}, contra ${pct(sum(prev5.map(dirty)) / prev5.length)} en promedio en las cinco temporadas anteriores. Coinciden dos cosas: se exportó más de lo producido (salió stock)` +
      (adj
        ? `, y el informe suma en junio el ajuste anual de exportadores no socios de la FLA, ${tons(adj.toneladas.sucia)} de lana sucia de ${tons(adj.total_t)}: lo que esos exportadores embarcaron en el año, anotado en un mes` +
          (adjustedSeasons.length === 1 ? `. Es la única temporada de la serie con ese ajuste marcado, así que su lana sucia no se compara del todo con las anteriores` : "")
        : "") +
      `. En ${cmp.actual.etiqueta} la sucia creció ${pct(growth("sucia"))} contra los mismos meses del año anterior y la peinada, ${pct(growth("peinada"))}. ` +
      `<strong>Conexión con la industria:</strong> si las plantas que peinaban ${tons(peakP.toneladas.peinada)} siguen en pie, hoy peinan cerca de la mitad (inferencia); una nota de 2021 cita de 30 a 40 % de capacidad ociosa, mención que no se releyó en el original (<a href="industria.html#quien">ver “Quién industrializa”</a>).`;

    // 3. Finura
    const teeC = teeBand(closedF);
    const next = closedF.bandas.find((b) => b.desde === 19);
    const coarse = closedF.bandas[closedF.bandas.length - 1];
    const fine = upTo(closedF, 24.5);
    document.getElementById("finura-lede").innerHTML =
      `La FLA no publica precios por micronaje, pero sí cuántas toneladas de cada producto salen en cada rango de finura. Es la única forma de comparar etapas para la misma lana. ` +
      `En ${closedF.temporada}, de la lana de hasta ${micron(TEE)}, la que lleva una remera para usar sobre la piel, salió sin peinar el <strong>${pct(bandShare(teeC))}</strong> (${tons(sum(teeC.map(uncombed)))}); ` +
      `de ${bandLabel(next).toLowerCase()}, el ${pct(next.sin_peinar_pct)}; de toda la lana fina de la FLA (hasta 24,5 µ), el ${pct(bandShare(fine))}. ` +
      `La lana más fina no se peina más que la mediana: sale sin peinar en una proporción parecida, y la gruesa (${bandLabel(coarse).toLowerCase()}) sale sucia todavía más seguido (${pct(coarse.sin_peinar_pct)})` +
      (coarse.ajuste_t != null ? `, aunque ${pct(coarse.ajuste_t / bandTotal(coarse))} de las toneladas de esa banda entraron con el ajuste anual de no socios de junio` : "") +
      `. Esa temporada vendió stock como lana sucia, así que la parte sin peinar está alta en todas las bandas.` +
      (hasCurrent
        ? ` ${seasonLabel(currentF)} no se compara banda por banda con una temporada cerrada: son ${sameMonths.meses} meses y no trae ajuste. Con todas las finuras y los mismos meses, la parte sin peinar subió de ${pct(sameMonths.antes)} a ${pct(sameMonths.ahora)}.`
        : "");

    // 4. Valor
    const capture = (id) => pct(ST[id].queda_pct, 1);
    const brand = ST.tienda.agrega_usd / price;
    const profitShares = ["hilado", "tela", "confeccion"].map((id) => ST[id].ganancia_usd / ST[id].agrega_usd);
    document.getElementById("valor-lede").innerHTML =
      `La remera de <a href="cadena.html">cadena.html</a> lleva ${num(topsG)} g de peinada: un kilo de peinada termina en ${num(1000 / topsG, 1)} remeras que se venden por ${usd((price * 1000) / topsG, 0)}. ` +
      `Si el país vende la peinada se queda con ${capture("peinada")} del precio; si vendiera el hilado, con ${capture("hilado")}; la tela, ${capture("tela")}; la remera terminada en fábrica, ${capture("confeccion")}. ` +
      `Marca y tienda agregan el ${pct(brand)}. Dentro de la fábrica, el paso grande es la tela (tejer, teñir y terminar): ${usd(ST.tela.agrega_kg, 1)} por kilo de peinada` +
      (ST.tela.agrega_kg > ST.hilado.agrega_kg + ST.confeccion.agrega_kg ? ", más que hilar y coser juntos. " : ". ") +
      `La ganancia es de ${pct(Math.min(...profitShares))} a ${pct(Math.max(...profitShares))} de lo que agrega cada paso de fábrica; el resto son costos: salarios, energía, otros insumos y máquinas. Los que se pagan en el país quedan en él; el nailon, las tinturas o las máquinas que se compran afuera, no.`;

    renderFindings();
    renderSteps();
    renderBuyers();
    renderMap();
    renderQuestions();
    renderMethod();

    document.getElementById("foot").textContent =
      `Datos generados el ${longDate(O.generado)} con build.py a partir de los PDF de la FLA, los archivos de UN Comtrade y data/cadena.json. Uso personal.`;
  }

  // Resumen de hallazgos, arriba de todo; cada cifra sale de los mismos datos que las secciones.
  function renderFindings() {
    const teeC = teeBand(closedF);
    const combed = (s) => s.toneladas.peinada / s.balance.produccion;
    const sorted = seasons.map(combed).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const peakL = seasons.reduce((a, b) => (b.toneladas.lavada > a.toneladas.lavada ? b : a));
    const g = combGap(closedF);
    const comb = OP.peinar.comparables;
    const opMin = Math.min(...comb.map((c) => c.operativo ?? Infinity));
    const grMax = Math.max(...comb.map((c) => c.bruto ?? -Infinity));
    const esp = lastY.espejo;
    const factory = ST.confeccion.vende_usd - ST.peinada.vende_usd;
    const fs = factoryCeiling();
    const items = [
      [
        "El valor está después de la peinada",
        `De una remera de ${num(price)} USD, la lana argentina cobra ${usd(ST.peinada.vende_usd)} (${pct(ST.peinada.queda_pct, 1)}) al precio promedio de la peinada, ${usd(fineTee.peinada_usd)} si fuera peinada fina al precio australiano. Hilar, tejer y coser en el país llevaría eso hasta ${usd(ST.confeccion.vende_usd)} (${pct(ST.confeccion.queda_pct, 1)}) en el modelo de la cadena; marca y tienda agregan el ${pct(ST.tienda.agrega_usd / price)}.`,
      ],
      [
        "El país peina como antes; lo que dejó de exportar es lana lavada, hilado y tela",
        `La peinada exportada sigue en torno al ${pct(median)} de la producción (${pct(combed(last))} en ${last.temporada}); la lavada bajó de ${tons(peakL.toneladas.lavada)} a ${tons(last.toneladas.lavada)}` +
          (flaZeroSince ? `, y hilados y tejidos figuran en 0 desde ${flaZeroSince}.` : "."),
      ],
      [
        "La lana más fina no se procesa más que la otra",
        `De la lana de remera (hasta ${micron(TEE)}) salió sin peinar el ${pct(bandShare(teeC))} en ${closedF.temporada}, una temporada que vendió stock. ` +
          `Con todas las finuras y los mismos meses, la parte sin peinar subió de ${pct(sameMonths.antes)} a ${pct(sameMonths.ahora)} (${sameMonths.etiqueta}).`,
      ],
      [
        "El paso más cercano es el que menos gana; el siguiente gana bastante más",
        `Peinar más lana propia suma unos ${usd(g.usd_kg)} por kilo limpio, con márgenes de ${pct(opMin)} operativo a ${pct(grMax, 1)} bruto. Hilar suma ${usd(ST.hilado.agrega_kg)} por kilo de peinada con ${pct(grossOf("hilar"), 1)} de margen bruto, y hay rastros de que se hace: los compradores declaran ${tons(esp.hilados.kg / 1e3)} de hilado de origen argentino a ${perKg(esp.hilados.usd_kg)} en ${lastY.anio}.`,
      ],
      [
        "La tela es el paso de fábrica más grande",
        `${usd(ST.tela.agrega_kg, 1)} por kilo de peinada, ${pct(ST.tela.agrega_usd / factory)} de lo que agrega la fábrica. Hilar, tejer y coser la peinada de remera de ${closedF.temporada} (${pct(baseOf(OP.hilar, closedF).t / last.toneladas.peinada)} de las toneladas de peinada) sumaría hasta ${usdM(fs)}, ${pct(fs / last.ingresos.peinada)} de lo que facturó toda la peinada exportada.`,
      ],
    ];
    document.getElementById("hallazgos").innerHTML =
      `<h3>Lo que se encontró</h3><ul>${items.map(([k, v]) => `<li><strong>${k}.</strong> ${v}</li>`).join("")}</ul>` +
      `<p class="note">Cifras de las secciones 1 a 6, donde está cada fuente y cada advertencia. Los techos son máximos, no proyecciones.</p>`;
  }

  // 5. Eslabón por eslabón
  function renderSteps() {
    const g = gapOf(closedF);
    const comb = baseOf(OP.peinar, closedF);
    const spin = baseOf(OP.hilar, closedF);
    const fineUncombed = sum(upTo(closedF, 24.5).map(uncombed));
    const next = closedF.bandas.find((b) => b.desde === 19);
    const peakP = seasons.reduce((a, b) => (b.toneladas.peinada > a.toneladas.peinada ? b : a));
    const esp = lastY.espejo;
    const imp = lastY.importaciones;
    const exp = lastY.exportaciones;
    const factory = ST.confeccion.vende_usd - ST.peinada.vende_usd;
    const negs = seasons.filter((s) => gapH(s) < 0);
    const negGap = negs.length
      ? `${negs.length} temporadas entre ${negs[0].temporada} y ${negs[negs.length - 1].temporada}${negs.every((s) => s.base === "efectiva") ? ", todas antes del cambio de método de 2005/06," : ""}`
      : "ninguna temporada";
    const cg = combGap(closedF);
    const teeAdj = teeBand(closedF).every((b) => b.ajuste_t != null) ? sum(teeBand(closedF).map((b) => b.ajuste_t)) : null;
    const now = (id) => (hasCurrent ? ` En ${seasonLabel(currentF)}: ${tons(baseOf(OP[id], currentF).t)}.` : "");
    const card = (title, items) =>
      `<div class="card prose"><h3>${title}</h3><ul>${items.map(([k, v]) => `<li><strong>${k}.</strong> ${v}</li>`).join("")}</ul></div>`;

    const cards = [
      card("Paso 0 · Peinar más de la lana propia", [
        [
          "Cuánta lana",
          `En ${closedF.temporada} salieron sucias o lavadas ${tons(comb.t)} de lana de hasta ${micron(TEE)}, ${tons(next.t.sucia + next.t.lavada)} de 19,0 a 19,9 µ y ${tons(fineUncombed)} de toda la lana fina (hasta 24,5 µ).${now("peinar")}${teeAdj != null ? ` El ajuste de junio sumó ${tons(teeAdj)} a la banda de remera, sin separar por producto.` : ""} Es una temporada de venta de stock: en las cinco anteriores salieron sucias ${tons(sum(prev5.map((s) => s.toneladas.sucia)) / prev5.length)} por temporada, de todas las finuras. Y el balance estima que al cierre quedaban ${tons(LQ.remanente)} base sucia sin exportar ni usar, ${pct(LQ.remanente / LQ.produccion)} de un año de producción: cuando salgan, pueden salir sucias o peinadas.`,
        ],
        [
          "Cuánto agrega",
          (g.sin_ajuste
            ? `Sin el mes del ajuste anual de no socios, la peinada se exportó a ${perKg(cg.peinada)} y la sucia a ${perKg(cg.sucia)} por kilo limpio: ${perKg(cg.usd_kg)} más (${pct(cg.prima)}); con ese mes, que suma lana sucia barata, ${perKg(g.usd_kg)}. `
            : `La peinada se exportó a ${perKg(g.peinada)} y la sucia a ${perKg(g.sucia)} por kilo limpio: ${perKg(g.usd_kg)} más (${pct(g.prima)}). `) +
            `En las cinco temporadas anteriores promedió ${perKg(sum(prev5.map(gapH)) / prev5.length)}, y en ${negGap} la sucia valió más que la peinada. Paga lavado, peinado y la fibra corta que se pierde, y mezcla finuras; como un kilo limpio de sucia rinde menos de un kilo de peinada, exagera lo que se suma. Con la lana de remera, hasta ${usdM(comb.techo_usd)} por temporada.`,
        ],
        ["Cuánto es ganancia", `Poca. ${comparablesText("peinar")}.` + (OP.peinar.comparables.some((c) => c.empresa.startsWith("Chargeurs")) ? " El 1 % de Chargeurs es de un segmento que comercia lana y no consolida la peinaduría de Trelew." : "") + (grossOf("peinar") < Math.min(grossOf("hilar"), grossOf("tejer"), grossOf("confeccionar")) ? " Es el menor margen bruto de las etapas industriales de la tabla de márgenes." : "")],
        [
          "Qué hay en el país",
          `Seis plantas en el polo de Trelew y no más de diez exportadoras. La peinada exportada cayó de ${tons(peakP.toneladas.peinada)} (${peakP.temporada}) a ${tons(last.toneladas.peinada)}: si las plantas siguen, hay capacidad sin usar (inferencia). La Peinaduría Río Chubut trabajaba al 70 % en 2018.`,
        ],
        ["Tipo de dato", "Toneladas y precios: FLA, medidos. La diferencia de precio y el techo: derivados. Plantas y capacidad: fuentes del sector y prensa, en industria.html."],
      ]),
      card("Paso 1 · Hilar la peinada fina", [
        [
          "Cuánta lana",
          `${tons(spin.t)} de peinada de hasta ${micron(TEE)} exportada en ${closedF.temporada}, y ${tons(next.t.peinada)} más de 19,0 a 19,9 µ.${now("hilar")}`,
        ],
        [
          "Cuánto agrega",
          `En la remera, ${usd(ST.hilado.agrega_kg)} por kilo de peinada; ${usd(ST.hilado.ganancia_kg)} son ganancia. Techo: ${usdM(spin.techo_usd)}. La cadena toma el hilado peinado fino a ${perKg(K.parametros.hilado_fino_usd_kg.valor, 0)}, de un solo aviso, y lo que declaran los compradores es del mismo orden: ${tons(esp.hilados.kg / 1e3)} de hilado argentino en ${lastY.anio} a ${perKg(esp.hilados.usd_kg)}, un promedio CIF de hilados distintos. No se puede restar la peinada promedio (${perKg(esp.peinada.usd_kg)}) para sacar lo que agrega hilar: el hilado lleva lana más fina que el promedio.`,
        ],
        ["Cuánto es ganancia", `${comparablesText("hilar")}. El margen bruto es ${num(grossOf("hilar") / grossOf("peinar"), 1)} veces el del peinado.`],
        [
          "Qué hay en el país",
          `La Cooperativa Lanera Trelew es la única del polo con hilandería. Argentina no declara exportaciones de hilado desde ${lastYarnYear + 1}${flaZeroSince ? ` y la FLA anota 0 desde ${flaZeroSince}` : ""}, pero los compradores declaran hilado de origen argentino, casi todo de lana peinada (partida 5107) y sobre todo Turquía (archivos de 2019 a ${lastY.anio}). ${yarnCaveat()}O alguien hila para exportar fuera de las cuentas de la FLA, o el origen que declaran los compradores no es donde se hiló. La industria del país usó ${tons(lastC.finura.fina)} de lana fina en ${lastC.temporada}, contra ${tons(prevC.finura.fina)} la temporada anterior` +
            (nowBalance ? ` y ${tons(nowBalance.fina.consumo_local)} estimadas para ${currentF.temporada}: la caída de un año es una estimación, no una tendencia.` : "."),
        ],
        ["Tipo de dato", "Hilado exportado: declarado por los compradores (Comtrade). Valor agregado: modelo de la remera."],
      ]),
      card("Paso 2 · Tejer, teñir y terminar la tela", [
        ["Cuánta lana", `La misma peinada de hasta ${micron(TEE)}: ${tons(spin.t)} en ${closedF.temporada}.`],
        [
          "Cuánto agrega",
          `${usd(ST.tela.agrega_kg)} por kilo de peinada, el paso de fábrica más grande: ${pct(ST.tela.agrega_usd / factory)} de lo que agregan hilado, tela y confección juntos. Techo: ${usdM(baseOf(OP.tejer, closedF).techo_usd)}. Es también el número más débil: la tela sale de la hoja de costos de una remera 100 % merino de peso y origen no publicados, y la remera sale de fábrica entre ${usd(K.fabrica.bajo)} y ${usd(K.fabrica.alto)} según la fuente.`,
        ],
        ["Cuánto es ganancia", `${usd(ST.tela.ganancia_kg)} por kilo de peinada. ${comparablesText("tejer")}.`],
        [
          "Qué hay en el país",
          `La FLA registra tejidos en 0${flaZeroSince ? ` desde ${flaZeroSince}` : ""}; en ${lastY.anio} Argentina declaró ${tons(exp.telas.kg / 1e3)} de telas de lana exportadas e importó ${tons(imp.telas.kg / 1e3)} a ${perKg(imp.telas.usd_kg)} (${usdM(imp.telas.usd, 2)}).`,
        ],
        ["Tipo de dato", `Comercio: Comtrade${underReportFrom ? `, donde Argentina declara de menos desde ${underReportFrom.anio}` : ""}. Valor agregado: modelo de la remera.`],
      ]),
      card("Paso 3 · Cortar y coser la prenda", [
        ["Cuánta lana", `La misma peinada: ${tons(spin.t)}.`],
        [
          "Cuánto agrega",
          `${usd(ST.confeccion.agrega_kg)} por kilo de peinada; ${usd(ST.confeccion.ganancia_kg)} son ganancia. Techo: ${usdM(baseOf(OP.confeccionar, closedF).techo_usd)}. La remera sale de fábrica a ${usd(K.fabrica.central)}, entre ${usd(K.fabrica.bajo)} y ${usd(K.fabrica.alto)} según la fuente.`,
        ],
        ["Cuánto es ganancia", `${comparablesText("confeccionar")}.`],
        [
          "Qué hay en el país",
          `Textilana (Mauro Sergio), en Mar del Plata, integrada del hilado a la venta, paró su producción en marzo de 2026; la nota no dice qué fibra usa. Hay tejedoras artesanales, como la cooperativa Albor Patagonia de Puerto Madryn (mención sin releer en el original). En ${lastY.anio} el país importó ${tons(imp.prendas.kg / 1e3)} de prendas de lana a ${perKg(imp.prendas.usd_kg)} (${usdM(imp.prendas.usd)}) y exportó ${usdM(exp.prendas.usd, 2)}.`,
        ],
        ["Tipo de dato", `Comercio: Comtrade${underReportFrom ? `, donde Argentina declara de menos desde ${underReportFrom.anio}` : ""}. Empresas: prensa, en industria.html. Valor agregado: modelo de la remera.`],
      ]),
      card("Paso 4 · La marca y la tienda", [
        ["Cuánta lana", `La misma peinada: ${tons(spin.t)}.`],
        [
          "Cuánto agrega",
          `${usd(ST.tienda.agrega_kg, 0)} por kilo de peinada, ${pct(ST.tienda.agrega_usd / price)} del precio. De eso, la ganancia de la marca es ${usd(ST.tienda.ganancia_kg, 0)} por kilo de peinada (${usd(ST.tienda.ganancia_usd)} por remera; entre ${usd(K.rangos.ganancia_marca_usd.min)} y ${usd(K.rangos.ganancia_marca_usd.max)} según los supuestos). El techo, ${usdM(baseOf(OP.vender, closedF).techo_usd, 0)}, supone que toda esa peinada termina en remeras vendidas a precio pleno: ninguna marca vende así (rebajas, stock sin vender).`,
        ],
        ["Cuánto es ganancia", `${comparablesText("vender")}.`],
        [
          "Qué hay en el país",
          "Las investigaciones no encontraron una marca argentina de prendas de lana fina con volumen publicado. Lo más cercano: una colección de invierno de Etiqueta Negra (2020/21) con hilados de la Cooperativa Lanera Trelew.",
        ],
        ["Tipo de dato", "Modelo de la remera y márgenes de empresas cotizadas, en cadena.html."],
      ]),
    ];
    document.getElementById("eslabones-cards").innerHTML = cards.join("");
  }

  // Quién compra la lana argentina en cada etapa, y qué le vende de vuelta.
  function renderBuyers() {
    const season = D.temporadas.find((s) => s.temporada === closedF.temporada);
    const by = {};
    for (const [prod, rows] of Object.entries(season.por_producto)) {
      for (const r of rows) {
        by[r.pais] ??= { pais: r.pais, sucia: 0, lavada: 0, peinada: 0, resto: 0 };
        by[r.pais][prod === "blousse" || prod === "subproductos" ? "resto" : prod] += r.total;
      }
    }
    const total = (r) => r.sucia + r.lavada + r.peinada + r.resto;
    const rows = Object.values(by).sort((a, b) => total(b) - total(a)).slice(0, 10);
    const orig = I.comercio.origenes;
    const sold = Object.fromEntries(orig.paises.map((p) => [p.pais, sum(Object.values(p.usd))]));
    const world = sum(Object.values(orig.mundo));
    const all = sum(Object.values(by).map(total));
    document.getElementById("compradores-note").textContent =
      `Los diez primeros compradores de ${closedF.temporada} (toneladas limpias, FLA) y lo que cada uno le vendió a Argentina en hilados, telas, prendas y artículos de hogar de lana en ${orig.anio} (UN Comtrade, CIF). ` +
      `Quien compra lana sucia la lava y la peina; quien compra peinada la hila. Varios de los que hacen esas etapas venden después manufacturas de lana al país; los datos no dicen si llevan lana argentina. ` +
      `“Fuera de los diez” es que no está entre los diez primeros orígenes de ${orig.anio}, no que vendió cero.`;
    document.getElementById("tabla-compradores").innerHTML = tableHtml(
      ["País", "Sucia t", "Lavada t", "Peinada t", "Blousse y subp. t", "Parte del total", `Manufacturas vendidas a Argentina ${orig.anio}`],
      rows.map((r) => [
        r.pais,
        num(r.sucia),
        num(r.lavada),
        num(r.peinada),
        num(r.resto),
        pct(total(r) / all),
        sold[r.pais] != null ? `${usdM(sold[r.pais], 2)} (${pct(sold[r.pais] / world)})` : "fuera de los diez",
      ]),
    );
  }

  // 6. Mapa
  const MAP = {
    peinar: {
      paso: "0 · ya lo hace",
      que: "Peinar en el país la lana fina que hoy sale sucia",
      hay: "Seis plantas en Trelew; peinada exportada a la mitad de su máximo",
      dato: "Derivado de precios FLA",
    },
    hilar: {
      paso: "1",
      que: "Hilar la peinada fina",
      hay: "Una cooperativa con hilandería; hilado que declaran los compradores, no Argentina",
      dato: "Declarado por compradores; modelo",
    },
    tejer: { paso: "2", que: "Tejer, teñir y terminar la tela", hay: "Sin exportación de telas; importa", dato: "Comtrade, con subdeclaración argentina; modelo" },
    confeccionar: { paso: "3", que: "Cortar y coser la prenda", hay: "Tejido artesanal; Textilana paró en 2026 (fibra sin dato)", dato: "Comtrade, con subdeclaración argentina; prensa; modelo" },
    vender: { paso: "4", que: "Vender con marca propia", hay: "Nada con volumen publicado", dato: "Modelo; empresas cotizadas" },
  };

  function renderMap() {
    const cur = hasCurrent ? currentF : null;
    document.getElementById("mapa-lede").textContent =
      `Del paso más cercano a lo que el país ya hace al más lejano. La base del paso 0 es la lana de remera (hasta ${micron(TEE)}) que salió sin peinar en ${closedF.temporada}; la de los pasos 1 a 4, la que ya sale peinada. El techo multiplica la base por lo que agrega el paso. ` +
      `Es un máximo, no una proyección: supone que toda esa lana da el paso y que se vende a los precios de la remera. Los techos se suman sólo en orden: tejer supone hilar antes.` +
      (cur ? ` La columna parcial es ${seasonLabel(cur)}.` : "");
    const head = [
      "Paso",
      "Qué haría falta",
      `Base ${closedF.temporada} t`,
      ...(cur ? [`Base ${cur.temporada} parcial t`] : []),
      "Agrega USD/kg",
      "De eso, ganancia USD/kg",
      "Techo",
      "Margen bruto de referencia",
      "Qué hay hoy",
      "Dato",
    ];
    const rows = O.oportunidades.map((o) => {
      const b = baseOf(o, closedF);
      const m = MAP[o.id];
      return [
        { html: esc(m.paso) },
        { html: esc(m.que), cls: "wrap-cell" },
        { html: num(b.t) },
        ...(cur ? [{ html: num(baseOf(o, cur).t) }] : []),
        { html: num(b.usd_kg, 2) },
        { html: b.ganancia_kg == null ? "sin desglose" : num(b.ganancia_kg, 2) },
        { html: usdM(b.techo_usd, b.techo_usd >= 1e8 ? 0 : 1) },
        { html: grossRange(o.id) },
        { html: esc(m.hay), cls: "wrap-cell" },
        { html: esc(m.dato), cls: "wrap-cell" },
      ];
    });
    document.getElementById("tabla-mapa").innerHTML = tableHtml(head, rows, true);
    const g = gapOf(closedF);
    const factorySum = factoryCeiling();
    document.getElementById("mapa-notas").innerHTML = [
      `<strong>Dónde está cada cosa.</strong> El paso 0 es el más cercano y el de menos ganancia. Los pasos 1 a 3 son industria que hoy no existe a escala; el 2, la tela, es el más grande de los tres. El 4 es el más grande de todos y el más lejano: depende de llegar al comprador final.`,
      `<strong>Los pasos 1 a 3 juntos.</strong> Hilar, tejer y coser en el país la peinada de remera de ${closedF.temporada} agregaría hasta ${usdM(factorySum)}: ${pct(factorySum / last.ingresos.peinada)} de lo que facturó toda la peinada exportada esa temporada (${usdM(last.ingresos.peinada, 0)}), con ${pct(baseOf(OP.hilar, closedF).t / last.toneladas.peinada)} de sus toneladas.`,
      `<strong>Por qué la base es una sola banda.</strong> Los precios de los pasos 1 a 4 salen de una remera de lana fina; aplicarlos a lana más gruesa sería suponer otra prenda. El paso 0 sí vale para toda la lana: con toda la fina, la base sube a ${tons(sum(upTo(closedF, 24.5).map(uncombed)))}.`,
      `<strong>El paso 0 mezcla finuras.</strong> La diferencia de ${perKg(combGap(closedF).usd_kg)} entre peinada y sucia${g.sin_ajuste ? ` (sin el mes del ajuste anual de no socios; con él, ${perKg(g.usd_kg)})` : ""} compara dos promedios con distinta mezcla de finura, y la FLA no publica precio por micronaje. Además, un kilo limpio de sucia rinde menos de un kilo de peinada, así que exagera lo que se suma.`,
      `<strong>La temporada base vendió stock.</strong> En ${LQ.temporada} la exportación fue ${pct(LQ.exportado_sobre_produccion)} de la producción (base sucia)` +
        (adjustment(LQ.temporada) ? `, y sumó en junio el ajuste anual de exportadores no socios (${tons(adjustment(LQ.temporada).toneladas.sucia)} de lana sucia).` : "."),
      `<strong>Márgenes.</strong> Los de la tabla de <a href="cadena.html#margenes">cadena.html</a>: empresas enteras, no esta remera, y sólo Canada Goose se releyó en el original.`,
    ]
      .map((t) => `<li>${t}</li>`)
      .join("");
  }

  // 7. Preguntas
  function renderQuestions() {
    const f = tops.fina;
    const same = tops.mismos_meses;
    const items = [
      [
        "Peinado",
        "¿Por qué sale sucia la lana fina si hay plantas con capacidad libre? Costos de energía y mano de obra, financiamiento del stock, la eliminación de los derechos de exportación en 2015, la “barraca de campo” de enero de 2026, o lo que prefieren los compradores de lana sucia.",
      ],
      [
        "Precio por finura",
        `¿Cobra la lana argentina fina lo que vale? La peinada argentina promedió ${perKg(same.usd_kg)} en los mismos meses en que la australiana de 18,5 µ valía ${perKg(f.usd_kg)} en Italia, ${num(f.usd_kg / same.usd_kg, 1)} veces ese precio (uno en Italia, con flete, contra uno FOB argentino). La FLA no publica precio por micronaje: ¿cuánto de esa diferencia es finura y cuánto es descuento por origen, lotes chicos, falta de trazabilidad o certificación?`,
      ],
      [
        "Hilado",
        `¿Quién hace el hilado que declaran Turquía y otros compradores, y por qué no aparece ni en lo que declara Argentina ni en las cuentas de la FLA? ¿Qué escala necesita una hilandería de peinado fino para competir, y qué falta para tenerla?`,
      ],
      [
        "Tela y tintorería",
        "¿Qué frena el tejido y el teñido de lana fina: energía, agua y tratamiento de efluentes, tecnología, escala, o un mercado interno chico?",
      ],
      [
        "Confección",
        "¿Cuánto cuesta coser una prenda de lana en el país contra Vietnam, Bangladesh o China, y qué aranceles paga en cada destino?",
      ],
      [
        "Marca y tienda",
        `¿Qué hace falta para llegar al comprador final: certificaciones (como ZQ o RWS), acceso a mercados, aranceles (la remera paga ${pct(K.arancel.total, 1)} para entrar a EE. UU. desde Vietnam) y lo que prefieren los consumidores?`,
      ],
      [
        "Exportadores no socios",
        "¿Quiénes son los exportadores no socios de la FLA que suman sobre todo lana sucia en el ajuste de junio de 2026, y por qué es la única temporada de la serie con ese ajuste marcado? ¿Tiene que ver la “barraca de campo”, que deja exportar al productor sin pasar por un acopio ni una peinaduría?",
      ],
      [
        "Lavado",
        "¿Por qué desapareció la exportación de lana lavada, y qué pasó con los lavaderos que no peinan?",
      ],
      [
        "Industria del país",
        "¿Por qué la FLA estima que la industria del país usó casi nada de lana fina en 2025/26, y qué fábricas la usan cuando la usan?",
      ],
      [
        "Dueños",
        "Parte de las peinadurías de Trelew tiene o tuvo dueños extranjeros (Schneider, Chargeurs). ¿Pesa eso en dónde se hace el hilado?",
      ],
      [
        "Subproductos",
        "La FLA registra blousse más fina que la peinada en algunas bandas (por ejemplo, de 16,5 a 16,9 µ en 2025/26), y la blousse pesa una parte de la peinada mucho mayor que a comienzos de los 2000. ¿Qué incluye esa fila, y hay usos de más valor para la fibra corta fina que su precio de exportación?",
      ],
    ];
    document.getElementById("lista-preguntas").innerHTML = items
      .map(([k, v]) => `<li><strong>${k}.</strong> ${v}</li>`)
      .join("");
  }

  function renderMethod() {
    const items = [
      `<strong>Fuentes.</strong> Informes mensuales de la FLA (tabla de micronaje por producto, ${closedF.temporada} y ${currentF.temporada}), informes anuales de la FLA (${first.temporada} a ${last.temporada}), UN Comtrade (${years[0].anio} a ${lastY.anio}) y la remera de <a href="cadena.html">cadena.html</a>, con sus supuestos y fuentes en <code>data/cadena.json</code>.`,
      `<strong>Bandas de finura.</strong> Juntan filas de la tabla de micronaje de la FLA sin partir ninguna; el build se detiene si una fila cruza el borde de una banda o si las filas no suman las toneladas de cada producto. Hasta ${micron(TEE)} es la lana de la remera: Icebreaker declara 18,9 µ para la suya y la cadena precia la peinada fina a 18,5 µ.`,
      "<strong>Sin peinar.</strong> Sucia y lavada sobre sucia, lavada y peinada de la misma banda. Blousse y subproductos quedan fuera: sólo existen donde alguien ya peinó.",
      "<strong>Valor agregado y ganancia.</strong> Lo que agrega un paso es lo que vende menos la lana que compra: paga salarios, energía, otros insumos (el nailon, tinturas, avíos), máquinas y ganancia. Lo que se compra afuera no queda en el país, así que es un techo de lo que queda. La ganancia es el margen operativo de una empresa cotizada de esa etapa aplicado a lo que vende el paso: un promedio de empresas enteras, no el de esta remera.",
      `<strong>Por kilo de peinada.</strong> Lo que agrega cada paso de la remera dividido por los ${num(topsG)} g de peinada que lleva. Permite multiplicar por las toneladas de la FLA, que están en peinada.`,
      "<strong>Bases distintas.</strong> Las toneladas de exportación de la FLA son limpias; las del balance (producción, consumo, remanente), base sucia; las de Comtrade, peso neto por año calendario. No se suman entre sí.",
      "<strong>Lo que queda fuera.</strong> El flete y el arancel de la remera, los derechos de exportación, las normas y lo que prefieren los compradores. Los países aparecen sólo para mostrar quién hace la etapa siguiente, no para explicar por qué.",
      "<strong>Lo que el sitio calcula.</strong> Bandas, parte sin peinar, diferencia de precio, valores por kilo de peinada y techos se calculan en <code>pipeline/opportunities.py</code>. Los promedios de cinco temporadas, la mediana de peinada sobre producción, las sumas del mapa y los cocientes del texto se calculan en la página con los mismos datos. Los márgenes de referencia son los de <a href=\"cadena.html#margenes\">cadena.html</a>: sólo Canada Goose se releyó en el original.",
    ];
    document.getElementById("metodo").innerHTML = items.map((t) => `<li>${t}</li>`).join("");
  }

  // ------------------------------------------------------------ selector de temporada

  function renderSeg() {
    const seg = document.getElementById("finura-seg");
    seg.innerHTML = FIN.map(
      (s, i) => `<button type="button" role="radio" aria-checked="${s === finSeason}" data-i="${i}">${esc(seasonLabel(s))}</button>`,
    ).join("");
    seg.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        finSeason = FIN[Number(b.dataset.i)];
        renderSeg();
        render("finura");
      }),
    );
  }

  function renderAll() {
    readTokens();
    renderKpis();
    for (const id of Object.keys(SPECS)) render(id);
  }

  // ------------------------------------------------------------ arranque

  document.querySelectorAll("[data-chart]").forEach((el) => buildCard(el, el.dataset.chart));
  renderSeg();
  renderTexts();
  renderAll();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  let pending;
  window.addEventListener("resize", () => {
    clearTimeout(pending);
    pending = setTimeout(() => Object.values(instances).forEach((i) => i.resize()), 120);
  });
})();
