// Dibuja el sitio a partir de window.DATA (generado por build.py).
// Toda la aritmética de fondo está en pipeline/derive.py; aquí sólo hay
// agregados de presentación (acumulados por mes, "Otros", participaciones).
(() => {
  "use strict";

  const D = window.DATA;

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
  const FIN = ["fina", "mediana", "gruesa"];
  const FNAME = { fina: "Fina (≤ 24,5 µ)", mediana: "Mediana (24,6–32,5 µ)", gruesa: "Gruesa (> 32,5 µ)" };
  const FSLOT = { fina: "ord1", mediana: "ord2", gruesa: "ord3" };
  const SEASON_MONTHS = ["jul", "ago", "sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun"];

  // Centroides aproximados (lon, lat) para las líneas del mapa.
  const CENTROIDS = {
    Argentina: [-64, -34], China: [104, 35], Italia: [12.5, 42.5], Alemania: [10.4, 51.2],
    Turquía: [35, 39], Perú: [-75, -9.2], Uruguay: [-56, -32.8], "República Checa": [15.5, 49.8],
    Bolivia: [-64.7, -16.3], México: [-102.5, 23.6], Egipto: [30.8, 26.8], India: [79, 22],
    Chile: [-71, -33], Rumania: [25, 45.9], Portugal: [-8.2, 39.6], Ecuador: [-78.2, -1.8],
    "Reino Unido": [-2, 54], Brasil: [-51.9, -14.2], España: [-3.7, 40.4], Bulgaria: [25.5, 42.7],
    Polonia: [19.1, 52], Lituania: [23.9, 55.2], Singapur: [103.8, 1.35], "Estados Unidos": [-98, 39.5],
    Japón: [138, 36.2], Bélgica: [4.5, 50.5], Tailandia: [101, 15.9], Francia: [2.2, 46.2],
    "Países Bajos": [5.3, 52.1], Paraguay: [-58.4, -23.4], "Corea del Sur": [127.8, 36.5],
    Sudáfrica: [22.9, -30.6], Australia: [133.8, -25.3], "Nueva Zelanda": [174.9, -40.9],
    Canadá: [-106, 56], Colombia: [-74.3, 4.6], Venezuela: [-66.6, 6.4], Marruecos: [-7.1, 31.8],
    Taiwán: [121, 23.7], Indonesia: [113.9, -0.8], Malasia: [102, 4.2], Bangladesh: [90.4, 23.7],
    Paquistán: [69.3, 30.4], Irán: [53.7, 32.4], Israel: [34.9, 31], Grecia: [21.8, 39],
    Hungría: [19.5, 47.2], Eslovaquia: [19.7, 48.7], Austria: [14.5, 47.5], Suiza: [8.2, 46.8],
    Suecia: [18.6, 60.1], Finlandia: [25.7, 61.9], Dinamarca: [9.5, 56.3], Rusia: [90, 61],
    Ucrania: [31.2, 48.4], Croacia: [15.2, 45.1], Letonia: [24.6, 56.9],
  };

  // ------------------------------------------------------------ formato

  const nf = {};
  const num = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    nf[d] ??= new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  const tons = (v) => `${num(v, Math.abs(v) < 100 ? 1 : 0)} t`;
  const usdM = (v) => `USD ${num(v / 1e6, 1)} M`;
  const perKg = (v) => (v == null ? "–" : `${num(v, 2)} USD/kg`);
  const pct = (v, d = 1) => `${num(v * 100, d)}%`;
  const signed = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v) * 100, d)}%`;
  const monthName = (ym) => {
    const [y, m] = ym.split("-");
    return `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+m - 1]} ${y.slice(2)}`;
  };
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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
  const fColor = (f) => C[FSLOT[f]];

  // Texto dentro de un relleno: blanco o casi negro según la luminancia del relleno.
  function inkOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    return L > 0.33 ? "#0b0b0b" : "#ffffff";
  }

  const swatch = (c, line = false) =>
    `<i style="display:inline-block;width:${line ? 12 : 8}px;height:${line ? 2 : 8}px;border-radius:2px;background:${c};margin:0 6px 2px 0;vertical-align:middle"></i>`;

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
  const barStyle = (color, top = true, horizontal = false) => ({
    color,
    borderColor: C.surface,
    borderWidth: 1,
    borderRadius: top ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0,
  });
  // Barras apiladas: sólo el último segmento presente de cada barra lleva la punta redondeada.
  function stacked(keys, rows, get, horizontal = false) {
    const last = rows.map((r) => [...keys].reverse().find((k) => get(r, k)));
    return keys.map((k) =>
      rows.map((r, i) => {
        const v = get(r, k);
        if (!v) return null;
        return last[i] === k
          ? { value: v, itemStyle: { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] } }
          : { value: v };
      }),
    );
  }
  // Serie invisible al final de una pila, para poner el total en la punta de cada barra.
  const totalLabel = (stack, n, formatter) => ({
    type: "bar",
    stack,
    data: Array(n).fill(0),
    itemStyle: { color: "transparent" },
    label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter },
    tooltip: { show: false },
    silent: true,
  });

  const lineSeries = (name, data, color, extra = {}) => ({
    name,
    type: "line",
    data,
    symbol: "circle",
    symbolSize: 8,
    showSymbol: true,
    lineStyle: { width: 2, color, cap: "round", join: "round" },
    itemStyle: { color, borderColor: C.surface, borderWidth: 2 },
    emphasis: { focus: "series", scale: 1.4 },
    ...extra,
  });

  // ------------------------------------------------------------ datos de apoyo

  const seasons = D.temporadas;
  let season = seasons[seasons.length - 1].temporada;
  const S = () => seasons.find((s) => s.temporada === season);
  const seasonLabel = (s) =>
    s.completa ? `${s.temporada} completa` : `${s.temporada} · ${monthName(s.desde)} – ${monthName(s.hasta)}`;
  const months = D.meses;
  const monthCats = months.map((m) => m.etiqueta + (m.ajuste_anual ? " *" : "") + (m.provisional ? " p" : ""));
  // Precio por producto de cada mes: solo los bloques de un único mes (el bloque de varios meses no se reparte).
  const priceByProduct = months.map(
    (m) => D.bloques.find((b) => b.meses.length === 1 && b.meses[0] === m.mes)?.usd_kg_producto || {},
  );
  const provisional = months.filter((m) => m.provisional);
  const PROV_NOTE = provisional.length
    ? `p = provisional: ${provisional.map((m) => m.etiqueta).join(" y ")} llevan pocas versiones publicadas y la FLA ` +
      "suele corregir los meses recientes hacia arriba en los informes siguientes (julio 2026 pasó de 1.587 t a 2.019 t)."
    : "";
  const FADE = 0.4;

  // Temporadas cuyo acumulado incluye el ajuste anual de no socios de junio.
  function ajusteNote(s) {
    const m = months.find((x) => x.ajuste_anual && x.temporada === s.temporada);
    if (!m) return "";
    const b = D.bloques.find((x) => x.meses.includes(m.mes));
    const china = b?.destinos?.China?.total || 0;
    return (
      `El acumulado ${s.temporada} incluye el ajuste anual de no socios de ${m.etiqueta} (${num(m.total_t)} t, ` +
      `${pct((m.toneladas.sucia || 0) / m.total_t, 0)} lana sucia${china ? `, ${num(china)} t a China` : ""}).`
    );
  }
  const mapNameToEs = {};
  for (const [es, map] of Object.entries(D.paises_mapa)) (mapNameToEs[map] ??= []).push(es);

  function cumulative(field) {
    return seasons.map((s) => {
      let acc = 0;
      const rows = months.filter((m) => m.temporada === s.temporada);
      return { temporada: s.temporada, data: rows.map((m) => (acc += m[field])) };
    });
  }
  const seasonColor = (t) => (t === seasons[seasons.length - 1].temporada ? C.s1 : C.past);

  // ------------------------------------------------------------ gráficos

  const SPECS = {
    mensualT: {
      title: "Toneladas limpias exportadas por mes",
      sub: () => `${monthName(months[0].mes)} a ${monthName(months[months.length - 1].mes)}, por producto`,
      legend: () => PRODUCTS.map((p) => ({ label: PNAME[p], color: pColor(p) })),
      foot: () =>
        `* Junio 2026 incluye el ajuste anual de exportadores no socios. ${PROV_NOTE} Fuente: tabla mensual de EL 812 y EL 816.`,
      option() {
        const groups = seasons.map((s) => {
          const idx = months.map((m, i) => (m.temporada === s.temporada ? i : -1)).filter((i) => i >= 0);
          return [
            { xAxis: monthCats[idx[0]], name: `Temporada ${s.temporada}` },
            { xAxis: monthCats[idx[idx.length - 1]] },
          ];
        });
        const present = PRODUCTS.filter((p) => months.some((m) => m.toneladas[p]));
        const data = stacked(present, months, (m, p) => m.toneladas[p]);
        for (const col of data)
          col.forEach((d, i) => {
            if (d && months[i].provisional) d.itemStyle = { ...(d.itemStyle || {}), opacity: FADE };
          });
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (ps) => {
              const m = months[ps[0].dataIndex];
              const rows = PRODUCTS.filter((p) => m.toneladas[p])
                .map((p) => `${swatch(pColor(p))}${PNAME[p]}: <b>${tons(m.toneladas[p])}</b>`)
                .join("<br>");
              return `<b>${m.etiqueta}</b> · temporada ${m.temporada}<br>${rows}<br>Total: <b>${tons(m.total_t)}</b> · ${perKg(m.usd_kg)}${
                m.ajuste_anual ? "<br><i>Incluye ajuste anual de no socios</i>" : ""
              }${provTip(m)}`;
            },
          },
          xAxis: axisCat(monthCats),
          yAxis: axisVal((v) => num(v)),
          series: present.map((p, i) => ({
            name: PNAME[p],
            type: "bar",
            stack: "t",
            barMaxWidth: 24,
            data: data[i],
            itemStyle: barStyle(pColor(p), false),
            emphasis: { focus: "series" },
            ...(i === 0
              ? {
                  markArea: {
                    silent: true,
                    itemStyle: { color: "transparent" },
                    label: { color: C.muted, fontSize: 11, position: "insideTop", offset: [0, -26] },
                    data: groups,
                  },
                }
              : {}),
          })),
        };
      },
      table: () => ({
        head: ["Mes", ...PRODUCTS.map((p) => PNAME[p]), "Total t", "USD", "USD/kg", "Informe"],
        rows: months.map((m) => [
          m.etiqueta + (m.ajuste_anual ? " *" : ""),
          ...PRODUCTS.map((p) => (m.toneladas[p] == null ? "" : num(m.toneladas[p], 1))),
          num(m.total_t, 1),
          num(m.ingresos_usd),
          num(m.usd_kg, 2),
          `EL ${m.fuente}`,
        ]),
      }),
    },

    mensualPrecio: {
      title: "Precio implícito por mes",
      sub: () => "Dólares por kilo limpio, todos los productos",
      legend: () => [
        { label: "Todos los productos", color: C.past, line: true },
        ...PRODUCTS.map((p) => ({ label: PNAME[p], color: pColor(p), line: true, series: PNAME[p] })),
      ],
      foot: () =>
        "Línea gris: ingreso de divisas del mes / toneladas limpias del mes; el punto oscuro es junio 2026 (ajuste anual) " +
        "y los huecos son meses provisionales. Líneas de color: precio de cada producto, de la resta entre informes " +
        "consecutivos (la tabla mensual no reparte dólares por producto). Empiezan en feb 26 y cada punto puede " +
        "arrastrar correcciones de meses anteriores. Los botones de la leyenda muestran u ocultan cada producto.",
      height: "short",
      option() {
        const last = months.length - 1;
        // Un punto sin vecinos no dibuja línea: sólo ése lleva símbolo.
        const productData = (p) =>
          priceByProduct.map((d, i) => {
            const v = d[p] ?? null;
            const alone = v != null && priceByProduct[i - 1]?.[p] == null && priceByProduct[i + 1]?.[p] == null;
            return { value: v, symbol: alone ? "circle" : "none" };
          });
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "line", lineStyle: { color: C.axis } },
            formatter: (ps) => {
              const m = months[ps[0].dataIndex];
              const prods = PRODUCTS.filter((p) => ps.some((x) => x.seriesName === PNAME[p]) && priceByProduct[ps[0].dataIndex][p] != null)
                .map((p) => `${swatch(pColor(p), true)}${PNAME[p]}: ${perKg(priceByProduct[ps[0].dataIndex][p])}`)
                .join("<br>");
              return (
                `<b>${m.etiqueta}</b><br>${swatch(C.past, true)}Todos: ${perKg(m.usd_kg)}<br>${tons(m.total_t)} · ${usdM(m.ingresos_usd)}${provTip(m)}` +
                (prods ? `<br>${prods}` : "")
              );
            },
          },
          legend: { show: false, data: PRODUCTS.map((p) => PNAME[p]) },
          xAxis: axisCat(monthCats, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v, 0), { scale: true }),
          series: [
            lineSeries(
              "USD/kg",
              months.map((m, i) => ({
                value: m.usd_kg,
                symbol: m.ajuste_anual || m.provisional ? "circle" : "none",
                itemStyle: m.ajuste_anual
                  ? { color: C.ink2, borderColor: C.surface, borderWidth: 2 }
                  : { color: C.surface, borderColor: C.past, borderWidth: 2 },
                label:
                  i === last
                    ? {
                        show: true,
                        position: "top",
                        color: C.ink2,
                        fontWeight: 600,
                        formatter: () => `${num(m.usd_kg, 2)}${m.provisional ? " p" : ""}`,
                      }
                    : undefined,
              })),
              C.past,
              { symbolSize: 7, lineStyle: { width: 3, color: C.past, cap: "round", join: "round" }, z: 1 },
            ),
            ...PRODUCTS.map((p) =>
              lineSeries(PNAME[p], productData(p), pColor(p), {
                symbolSize: 6,
                itemStyle: { color: pColor(p), borderWidth: 0 },
                connectNulls: false,
                z: 2,
              }),
            ),
          ],
        };
      },
      table: () => ({
        head: ["Mes", "USD/kg", "Toneladas", "USD", ...PRODUCTS.map((p) => PNAME[p])],
        rows: months.map((m, i) => [
          m.etiqueta,
          num(m.usd_kg, 2),
          num(m.total_t, 1),
          num(m.ingresos_usd),
          ...PRODUCTS.map((p) => (priceByProduct[i][p] == null ? "" : num(priceByProduct[i][p], 2))),
        ]),
      }),
    },

    mensualUsd: {
      title: "Ingreso de divisas por mes",
      sub: () => "Millones de dólares",
      foot: "Barras claras: meses provisionales. Barra gris: junio 2026 con ajuste anual. Fuente: tabla mensual de EL 812 y EL 816.",
      height: "short",
      option() {
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (ps) => {
              const m = months[ps[0].dataIndex];
              return `<b>${m.etiqueta}</b><br>${usdM(m.ingresos_usd)}${m.ajuste_anual ? "<br><i>Incluye ajuste anual</i>" : ""}${provTip(m)}`;
            },
          },
          xAxis: axisCat(monthCats),
          yAxis: axisVal((v) => num(v)),
          series: [
            {
              type: "bar",
              barMaxWidth: 24,
              data: months.map((m) => ({
                value: m.ingresos_usd / 1e6,
                itemStyle: { ...barStyle(m.ajuste_anual ? C.past : C.s1), opacity: m.provisional ? FADE : 1 },
              })),
            },
          ],
        };
      },
      table: () => ({
        head: ["Mes", "USD"],
        rows: months.map((m) => [m.etiqueta, num(m.ingresos_usd)]),
      }),
    },

    acumT: {
      title: "Toneladas acumuladas en la temporada",
      sub: () => "Toneladas limpias desde julio",
      legend: () => seasons.map((s) => ({ label: s.temporada, color: seasonColor(s.temporada), line: true })),
      height: "short",
      option: () => cumulativeOption("total_t", (v) => num(v), tons),
      table: () => cumulativeTable("total_t", (v) => num(v, 1)),
    },

    acumUsd: {
      title: "Divisas acumuladas en la temporada",
      sub: () => "Millones de dólares desde julio",
      legend: () => seasons.map((s) => ({ label: s.temporada, color: seasonColor(s.temporada), line: true })),
      height: "short",
      option: () => cumulativeOption("ingresos_usd", (v) => num(v / 1e6), usdM),
      table: () => cumulativeTable("ingresos_usd", (v) => num(v)),
    },

    compProd: {
      title: "Mismos meses, por producto",
      sub: () => {
        const c = D.comparacion;
        return `Toneladas limpias, ${c.anterior.etiqueta} contra ${c.actual.etiqueta}`;
      },
      legend: () => [
        { label: D.comparacion.anterior.etiqueta, color: C.past },
        { label: D.comparacion.actual.etiqueta, color: C.s1 },
      ],
      foot: "La tabla mensual no separa los dólares por producto, así que esta comparación es sólo en toneladas.",
      option() {
        const c = D.comparacion;
        const ps = PRODUCTS.filter((p) => c.actual.toneladas[p] || c.anterior.toneladas[p]).reverse();
        const label = { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (x) => num(x.value) };
        return {
          ...base(),
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const p = ps[items[0].dataIndex];
              const a = c.anterior.toneladas[p] || 0;
              const b = c.actual.toneladas[p] || 0;
              return `<b>${PNAME[p]}</b><br>${c.anterior.etiqueta}: ${tons(a)}<br>${c.actual.etiqueta}: ${tons(b)}${
                a ? `<br>Variación: <b>${signed(b / a - 1)}</b>` : ""
              }`;
            },
          },
          yAxis: axisCat(ps.map((p) => PNAME[p])),
          xAxis: axisVal((v) => num(v)),
          series: [
            { name: c.anterior.etiqueta, type: "bar", barMaxWidth: 14, barGap: "20%", label,
              data: ps.map((p) => c.anterior.toneladas[p] ?? 0), itemStyle: barStyle(C.past, true, true) },
            { name: c.actual.etiqueta, type: "bar", barMaxWidth: 14, label,
              data: ps.map((p) => c.actual.toneladas[p] ?? 0), itemStyle: barStyle(C.s1, true, true) },
          ],
        };
      },
      table: () => {
        const c = D.comparacion;
        return {
          head: ["Producto", c.anterior.etiqueta, c.actual.etiqueta, "Variación"],
          rows: PRODUCTS.map((p) => {
            const a = c.anterior.toneladas[p] || 0;
            const b = c.actual.toneladas[p] || 0;
            return [PNAME[p], num(a, 1), num(b, 1), a ? signed(b / a - 1) : ""];
          }),
        };
      },
    },

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

    destinos: {
      seasonal: true,
      title: "Destinos por producto",
      sub: () => `Toneladas limpias, ${seasonLabel(S())}. Los países chicos se agrupan en "Otros".`,
      legend: () => PRODUCTS.map((p) => ({ label: PNAME[p], color: pColor(p) })),
      height: "tall",
      option() {
        const s = S();
        const ranked = [...s.destinos].sort((a, b) => b.total - a.total);
        const top = ranked.slice(0, 14);
        const rest = ranked.slice(14);
        const rows = [...top];
        if (rest.length) {
          const otros = { pais: `Otros (${rest.length})`, total: sum(rest.map((d) => d.total)) };
          for (const p of PRODUCTS) otros[p] = sum(rest.map((d) => d[p]));
          rows.push(otros);
        }
        rows.reverse();
        const present = PRODUCTS.filter((p) => rows.some((r) => r[p]));
        const data = stacked(present, rows, (r, p) => r[p], true);
        return {
          ...base(),
          grid: { left: 8, right: 96, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => destinoTip(rows[items[0].dataIndex], s),
          },
          yAxis: axisCat(rows.map((r) => r.pais), { axisLabel: { color: C.ink2, fontSize: 12 } }),
          xAxis: axisVal((v) => num(v)),
          series: [
            ...present.map((p, i) => ({
              name: PNAME[p],
              type: "bar",
              stack: "d",
              barMaxWidth: 18,
              data: data[i],
              itemStyle: barStyle(pColor(p), false, true),
              emphasis: { focus: "series" },
            })),
            totalLabel("d", rows.length, (x) => `${num(rows[x.dataIndex].total)} t · ${pct(rows[x.dataIndex].total / s.total_t)}`),
          ],
        };
      },
      table: () => destinosTable(),
    },

    bloques: {
      title: "Participación de cada destino, informe a informe",
      sub: () => "% de las toneladas limpias agregadas entre un informe y el anterior. Vale para ambas temporadas.",
      foot:
        "Cada columna es el acumulado de un informe menos el del anterior: incluye revisiones de meses previos. " +
        "La primera columna junta siete meses porque falta el informe de diciembre 2025.",
      height: "tall",
      option() {
        const blocks = D.bloques;
        const totals = {};
        for (const b of blocks)
          for (const [c, v] of Object.entries(b.destinos)) totals[c] = (totals[c] || 0) + v.total;
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c]) => c);
        const ys = [...top, "Resto"].reverse();
        const data = [];
        let max = 0;
        blocks.forEach((b, x) => {
          ys.forEach((c, y) => {
            const t =
              c === "Resto"
                ? sum(Object.entries(b.destinos).filter(([k]) => !top.includes(k)).map(([, v]) => v.total))
                : b.destinos[c]?.total || 0;
            const share = b.total_t ? t / b.total_t : 0;
            max = Math.max(max, share);
            data.push({ value: [x, y, share * 100, t], label: {} });
          });
        });
        const ramp = C.seq;
        for (const d of data) {
          const share = d.value[2];
          const show = share >= 4;
          const step = Math.min(4, Math.floor((share / (max * 100)) * 4.999));
          d.label = { show, color: inkOn(ramp[Math.max(0, step)]) };
        }
        return {
          ...base(),
          grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "item",
            formatter: (p) => {
              const b = blocks[p.value[0]];
              return `<b>${esc(ys[p.value[1]])}</b> · ${b.etiqueta}<br>${num(p.value[2], 1)}% de ${tons(b.total_t)}<br>${tons(p.value[3])}<br><span style="color:${C.muted}">EL ${b.numero}${b.menos ? ` − EL ${b.menos}` : ""}</span>`;
            },
          },
          xAxis: axisCat(blocks.map((b) => b.etiqueta), {
            axisLabel: { color: C.muted, fontSize: 11, interval: 0, rotate: 30 },
            splitArea: { show: false },
          }),
          yAxis: axisCat(ys, { axisLabel: { color: C.ink2, fontSize: 12 } }),
          visualMap: {
            dimension: 2,
            min: 0.05, // por debajo (sin compras) usa el color vacío

            max: Math.ceil(max * 100),
            inRange: { color: ramp },
            outOfRange: { color: C.empty },
            show: false,
          },
          series: [
            {
              type: "heatmap",
              data,
              label: { fontSize: 10, formatter: (p) => num(p.value[2], 0) },
              itemStyle: { borderColor: C.surface, borderWidth: 2, borderRadius: 3 },
              emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 1 } },
            },
          ],
        };
      },
      table: () => {
        const blocks = D.bloques;
        const countries = [...new Set(blocks.flatMap((b) => Object.keys(b.destinos)))].sort();
        return {
          head: ["Destino", ...blocks.map((b) => b.etiqueta)],
          rows: [
            ...countries.map((c) => [c, ...blocks.map((b) => (b.destinos[c] ? num(b.destinos[c].total, 1) : ""))]),
            ["Total t", ...blocks.map((b) => num(b.total_t, 1))],
            ["Diferencia con tabla mensual t", ...blocks.map((b) => num(b.revision_t, 1))],
          ],
        };
      },
    },

    precioProd: {
      title: "Precio implícito por producto",
      sub: () => "USD por kilo limpio, acumulado de cada temporada",
      legend: () => seasons.map((s) => ({ label: seasonLabel(s), color: seasonColor(s.temporada) })),
      foot: () =>
        `Períodos distintos: la temporada en curso tiene sólo sus primeros meses. ${seasons.map(ajusteNote).join(" ")} ` +
        "Ese ajuste es casi todo lana sucia barata y baja el precio de la sucia en esa temporada.",
      option() {
        const ps = PRODUCTS.filter((p) => seasons.some((s) => s.usd_kg_producto[p])).reverse();
        return {
          ...base(),
          grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const p = ps[items[0].dataIndex];
              return `<b>${PNAME[p]}</b><br>${seasons
                .map((s) => `${swatch(seasonColor(s.temporada))}${s.temporada}: ${perKg(s.usd_kg_producto[p])} · ${tons(s.toneladas[p] || 0)}`)
                .join("<br>")}`;
            },
          },
          yAxis: axisCat(ps.map((p) => PNAME[p])),
          xAxis: axisVal((v) => num(v)),
          series: seasons.map((s) => ({
            name: s.temporada,
            type: "bar",
            barMaxWidth: 14,
            barGap: "20%",
            data: ps.map((p) => s.usd_kg_producto[p] ?? null),
            itemStyle: barStyle(seasonColor(s.temporada), true, true),
            label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (x) => num(x.value, 2) },
          })),
        };
      },
      table: () => ({
        head: ["Producto", ...seasons.map((s) => `${s.temporada} USD/kg`), ...seasons.map((s) => `${s.temporada} t`)],
        rows: PRODUCTS.map((p) => [
          PNAME[p],
          ...seasons.map((s) => num(s.usd_kg_producto[p], 2)),
          ...seasons.map((s) => num(s.toneladas[p], 1)),
        ]),
      }),
    },

    finura: {
      seasonal: true,
      title: "Finura por producto",
      sub: () => `Reparto de toneladas limpias, ${seasonLabel(S())}`,
      legend: () => FIN.map((f) => ({ label: FNAME[f], color: fColor(f) })),
      option() {
        const s = S();
        const ps = PRODUCTS.filter((p) => s.finura[p]).reverse();
        const share = (p, f) => (s.finura[p][f] || 0) / s.finura[p].total;
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const p = ps[items[0].dataIndex];
              return `<b>${PNAME[p]}</b> · ${tons(s.finura[p].total)}<br>${FIN.filter((f) => s.finura[p][f])
                .map((f) => `${swatch(fColor(f))}${FNAME[f]}: ${pct(share(p, f), 0)} · ${tons(s.finura[p][f])}`)
                .join("<br>")}`;
            },
          },
          yAxis: axisCat(ps.map((p) => PNAME[p])),
          xAxis: axisVal((v) => `${v}%`, { max: 100 }),
          series: FIN.map((f, i) => ({
            name: FNAME[f],
            type: "bar",
            stack: "f",
            barMaxWidth: 18,
            data: ps.map((p) => {
              const v = share(p, f) * 100;
              return {
                value: v || null,
                label: { show: v >= 14, color: inkOn(fColor(f)), formatter: () => `${num(v, 0)}%` },
              };
            }),
            itemStyle: barStyle(fColor(f), i === FIN.length - 1, true),
            label: { fontSize: 11, position: "inside" },
          })),
        };
      },
      table: () => {
        const s = S();
        return {
          head: ["Producto", ...FIN.map((f) => FNAME[f]), "Total t"],
          rows: PRODUCTS.filter((p) => s.finura[p]).map((p) => [
            PNAME[p],
            ...FIN.map((f) => num(s.finura[p][f], 1)),
            num(s.finura[p].total, 1),
          ]),
        };
      },
    },

    micron: {
      title: "Perfil de micronaje",
      sub: () =>
        "% de las toneladas limpias de cada temporada en cada rango de micrones. Promedio ponderado: " +
        seasons.map((s) => `${num(s.micron_promedio.total, 1)} µ (${s.temporada})`).join(" · "),
      legend: () => seasons.map((s) => ({ label: seasonLabel(s), color: seasonColor(s.temporada) })),
      foot:
        "Menos micrones = lana más fina, que suele valer más. Los rangos son los de la FLA y no tienen el mismo ancho: " +
        "20,0–20,9 y 31,0–32,5 abarcan un micrón o más, 23,0–24,5 un micrón y medio, el resto medio micrón; por eso " +
        "esas barras salen más altas. El pico de 2025/26 en 30,0–30,9 µ viene en su mayor parte del ajuste anual " +
        "de junio (unas 2.100 t en ese rango). Fuente: tabla de micrones de EL 812 y EL 816.",
      option() {
        const bins = seasons[0].micrones.map((r) => r.rango);
        const binLabel = (r) =>
          r.desde == null ? `< ${num(r.hasta, 1)}` : r.hasta == null ? `> ${num(r.desde, 1)}` : num(r.desde, 1);
        const labels = seasons[0].micrones.map(binLabel);
        return {
          ...base(),
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const i = items[0].dataIndex;
              return `<b>${esc(bins[i])} µ</b><br>${seasons
                .map((s) => {
                  const r = s.micrones[i];
                  return `${swatch(seasonColor(s.temporada))}${s.temporada}: ${pct((r.total || 0) / s.total_t)} · ${tons(r.total || 0)}`;
                })
                .join("<br>")}`;
            },
          },
          xAxis: axisCat(labels, { name: "µ desde", nameLocation: "end", nameTextStyle: { color: C.muted, fontSize: 11 } }),
          yAxis: axisVal((v) => `${v}%`),
          series: seasons.map((s) => ({
            name: s.temporada,
            type: "bar",
            barMaxWidth: 12,
            barGap: "15%",
            data: s.micrones.map((r) => ((r.total || 0) / s.total_t) * 100),
            itemStyle: barStyle(seasonColor(s.temporada)),
          })),
        };
      },
      table: () => ({
        head: ["Rango µ", ...seasons.map((s) => `${s.temporada} t`), ...seasons.map((s) => `${s.temporada} %`)],
        rows: seasons[0].micrones.map((r, i) => [
          r.rango,
          ...seasons.map((s) => num(s.micrones[i].total || 0, 1)),
          ...seasons.map((s) => pct((s.micrones[i].total || 0) / s.total_t)),
        ]),
      }),
    },

    balance: {
      seasonal: true,
      title: "Disponibilidad y destino de la lana",
      sub: () => {
        const s = S();
        const b = s.balance;
        return b
          ? `Toneladas base sucia, ${seasonLabel(s)} (EL ${s.numero}). Disponibilidad total: ${tons(b.__total__.disponibilidad)}`
          : "Sin balance en este informe";
      },
      legend: () => [
        { label: "Exportado", color: C.s1 },
        { label: "Consumo local", color: C.s2 },
        { label: S().completa ? "Remanente al cierre" : "Remanente estimado", color: C.past },
      ],
      foot: "Disponibilidad = saldo de la temporada anterior + producción. La barra completa es la disponibilidad.",
      option() {
        const b = S().balance;
        if (!b) return { ...base() };
        const fs = FIN.filter((f) => b[f]).reverse();
        const parts = [
          ["exportado", "Exportado", C.s1],
          ["consumo_local", "Consumo local", C.s2],
          ["remanente", "Remanente", C.past],
        ];
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const r = b[fs[items[0].dataIndex]];
              return `<b>${FNAME[fs[items[0].dataIndex]]}</b><br>Saldo previo: ${tons(r.saldo_previo)}<br>Producción: ${tons(
                r.produccion,
              )}<br>Disponibilidad: <b>${tons(r.disponibilidad)}</b><br>${parts
                .map(([k, n, c]) => `${swatch(c)}${n}: ${tons(r[k])} (${pct(r[k] / r.disponibilidad, 0)})`)
                .join("<br>")}`;
            },
          },
          yAxis: axisCat(fs.map((f) => FNAME[f])),
          xAxis: axisVal((v) => num(v)),
          series: parts.map(([k, n, c], i) => ({
            name: n,
            type: "bar",
            stack: "b",
            barMaxWidth: 22,
            data: fs.map((f) => {
              const share = b[f][k] / b.__total__.disponibilidad;
              return {
                value: b[f][k],
                label: { show: share > 0.08, color: inkOn(c), formatter: () => num(b[f][k]) },
              };
            }),
            itemStyle: barStyle(c, i === parts.length - 1, true),
            label: { position: "inside", fontSize: 11 },
          })),
        };
      },
      table: () => {
        const b = S().balance;
        const cols = ["saldo_previo", "produccion", "disponibilidad", "consumo_local", "exportado", "remanente"];
        const names = ["Saldo previo", "Producción", "Disponibilidad", "Consumo local", "Exportado", "Remanente"];
        return {
          head: ["Finura", ...names],
          rows: b
            ? [...FIN, "__total__"].filter((f) => b[f]).map((f) => [f === "__total__" ? "Total" : FNAME[f], ...cols.map((c) => num(b[f][c], 1))])
            : [],
        };
      },
    },

    remanente: {
      title: "Cómo baja el remanente a lo largo de la temporada",
      sub: () => "Remanente total en toneladas base sucia, según cada informe",
      legend: () => seasons.map((s) => ({ label: s.temporada, color: seasonColor(s.temporada), line: true })),
      foot:
        "Cada punto es un informe. En 2025/26 la FLA estimó 31.107 t de producción y 3.650 t de consumo local hasta mayo; " +
        "el cierre de junio (EL 812) usa 31.038 t y 1.574 t. El remanente al cierre pasa a ser el saldo previo de la temporada siguiente.",
      height: "short",
      option() {
        const idx = (ym) => SEASON_MONTHS.indexOf(monthName(ym).split(" ")[0]);
        return {
          ...base(),
          grid: { left: 8, right: 56, top: 24, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "item",
            formatter: (p) => {
              const s = seasons[p.seriesIndex];
              const h = s.balance_historia.find((x) => idx(x.hasta) === p.value[0]);
              const t = h.balance.__total__;
              return `<b>EL ${h.numero}</b> · hasta ${monthName(h.hasta)}<br>Remanente: <b>${tons(t.remanente)}</b><br>Exportado: ${tons(
                t.exportado,
              )}<br>Producción estimada: ${tons(t.produccion)}`;
            },
          },
          xAxis: axisCat(SEASON_MONTHS, { boundaryGap: false }),
          yAxis: axisVal((v) => num(v), { scale: true }),
          series: seasons.map((s) =>
            lineSeries(
              s.temporada,
              s.balance_historia.map((h) => [idx(h.hasta), h.balance.__total__.remanente]),
              seasonColor(s.temporada),
              { endLabel: { show: true, color: C.ink2, fontSize: 11, formatter: (p) => num(p.value[1]) } },
            ),
          ),
        };
      },
      table: () => ({
        head: ["Informe", "Hasta", "Temporada", "Producción", "Consumo local", "Exportado", "Remanente"],
        rows: seasons.flatMap((s) =>
          s.balance_historia.map((h) => {
            const t = h.balance.__total__;
            return [`EL ${h.numero}`, monthName(h.hasta), s.temporada, num(t.produccion), num(t.consumo_local), num(t.exportado, 1), num(t.remanente, 1)];
          }),
        ),
      }),
    },

    puertos: {
      seasonal: true,
      title: "Toneladas por puerto",
      sub: () => {
        const s = S();
        const pat = sum(s.puertos.filter((p) => p.patagonico).map((p) => p.total));
        return `Toneladas limpias, ${seasonLabel(s)}. Puertos patagónicos: ${pct(pat / s.total_t)} del total`;
      },
      option() {
        const s = S();
        const rows = [...s.puertos].sort((a, b) => a.total - b.total);
        return {
          ...base(),
          grid: { left: 8, right: 96, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...base().tooltip,
            trigger: "axis",
            axisPointer: { type: "shadow", shadowStyle: { color: C.grid, opacity: 0.5 } },
            formatter: (items) => {
              const r = rows[items[0].dataIndex];
              return `<b>${esc(r.puerto)}</b>${r.patagonico ? " (patagónico)" : ""}<br>${tons(r.total)} · ${pct(r.total / s.total_t)}<br>${PRODUCTS.filter(
                (p) => r[p],
              )
                .map((p) => `${swatch(pColor(p))}${PNAME[p]}: ${tons(r[p])}`)
                .join("<br>")}`;
            },
          },
          yAxis: axisCat(rows.map((r) => r.puerto + (r.patagonico ? " ◆" : "")), { axisLabel: { color: C.ink2, fontSize: 12 } }),
          xAxis: axisVal((v) => num(v)),
          series: [
            {
              type: "bar",
              barMaxWidth: 16,
              data: rows.map((r) => r.total),
              itemStyle: barStyle(C.s1, true, true),
              label: {
                show: true,
                position: "right",
                color: C.ink2,
                fontSize: 11,
                formatter: (x) => `${num(x.value)} t · ${pct(x.value / s.total_t)}`,
              },
            },
          ],
        };
      },
      foot: "◆ puerto patagónico.",
      table: () => {
        const s = S();
        return {
          head: ["Puerto", ...PRODUCTS.map((p) => PNAME[p]), "Total t"],
          rows: [...s.puertos]
            .sort((a, b) => b.total - a.total)
            .map((r) => [r.puerto, ...PRODUCTS.map((p) => (r[p] ? num(r[p], 1) : "")), num(r.total, 1)]),
        };
      },
    },
  };

  function cumulativeOption(field, axisFmt, tipFmt) {
    const series = cumulative(field);
    return {
      ...base(),
      grid: { left: 8, right: 64, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...base().tooltip,
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: C.axis } },
        formatter: (items) =>
          `<b>Hasta ${SEASON_MONTHS[items[0].dataIndex]}</b><br>${items
            .map((it) => `${swatch(seasonColor(it.seriesName), true)}${it.seriesName}: <b>${tipFmt(it.value)}</b>`)
            .join("<br>")}`,
      },
      xAxis: axisCat(SEASON_MONTHS, { boundaryGap: false }),
      yAxis: axisVal(axisFmt),
      series: series.map((s) =>
        lineSeries(s.temporada, s.data, seasonColor(s.temporada), {
          symbolSize: 6,
          endLabel: { show: true, color: C.ink2, fontSize: 11, formatter: (p) => `${p.seriesName}` },
        }),
      ),
    };
  }

  function cumulativeTable(field, fmt) {
    const series = cumulative(field);
    return {
      head: ["Mes", ...series.map((s) => s.temporada)],
      rows: SEASON_MONTHS.map((m, i) => [m, ...series.map((s) => (s.data[i] == null ? "" : fmt(s.data[i])))]),
    };
  }

  const provTip = (m) =>
    m.provisional
      ? `<br><span style="color:${C.muted}">Provisional: ${m.versiones} ${m.versiones === 1 ? "versión publicada" : "versiones publicadas"}</span>`
      : "";

  function destinoTip(d, s) {
    const rows = PRODUCTS.filter((p) => d[p])
      .map((p) => `${swatch(pColor(p))}${PNAME[p]}: ${tons(d[p])}${s.ingresos ? "" : ""}`)
      .join("<br>");
    return `<b>${esc(d.pais)}</b><br>${tons(d.total)} · ${pct(d.total / s.total_t)} del total<br>${rows}`;
  }

  function destinosTable() {
    const s = S();
    return {
      head: ["Destino", ...PRODUCTS.map((p) => PNAME[p]), "Total t", "Part."],
      rows: [...s.destinos]
        .sort((a, b) => b.total - a.total)
        .map((d) => [d.pais, ...PRODUCTS.map((p) => (d[p] ? num(d[p], 1) : "")), num(d.total, 1), pct(d.total / s.total_t)]),
    };
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
    el.querySelector(".legend").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-series]");
      if (!b) return;
      b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
      instances[id]?.dispatchAction({ type: "legendToggleSelect", name: b.dataset.series });
    });
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
      .map((l) => {
        const inner = `<i class="${l.line ? "line" : ""}" style="background:${l.color}"></i>${esc(l.label)}`;
        return l.series
          ? `<button type="button" class="leg-btn" aria-pressed="true" data-series="${esc(l.series)}">${inner}</button>`
          : `<span>${inner}</span>`;
      })
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
    const c = D.comparacion;
    const a = c.actual;
    const b = c.anterior;
    const s = seasons[seasons.length - 1];
    const lead = [...s.destinos].sort((x, y) => y.total - x.total)[0];
    const delta = (x, y) => {
      const d = x / y - 1;
      return `<span class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${signed(d)}</span> contra ${b.etiqueta}`;
    };
    document.getElementById("kpis").innerHTML = `
      <div class="tile hero">
        <div class="label">Precio implícito, ${a.etiqueta}</div>
        <div class="value">${num(a.usd_kg, 2)}<span class="unit">USD/kg limpio</span></div>
        <div class="delta">${delta(a.usd_kg, b.usd_kg)} (${num(b.usd_kg, 2)})</div>
        <div class="spark" id="spark"></div>
      </div>
      <div class="tile">
        <div class="label">Toneladas limpias exportadas</div>
        <div class="value">${num(a.total_t)}<span class="unit">t</span></div>
        <div class="delta">${delta(a.total_t, b.total_t)} (${num(b.total_t)} t)</div>
      </div>
      <div class="tile">
        <div class="label">Ingreso de divisas</div>
        <div class="value">${num(a.ingresos_usd / 1e6, 1)}<span class="unit">M USD</span></div>
        <div class="delta">${delta(a.ingresos_usd, b.ingresos_usd)} (${num(b.ingresos_usd / 1e6, 1)} M)</div>
      </div>
      <div class="tile">
        <div class="label">Primer destino, temporada ${s.temporada}</div>
        <div class="value">${esc(lead.pais)}</div>
        <div class="delta">${pct(lead.total / s.total_t)} de las toneladas · ${num(lead.total)} t</div>
      </div>`;
    const last = D.informes[D.informes.length - 1];
    document.getElementById("kpi-note").textContent =
      `Temporada en curso (${a.etiqueta}) contra los mismos meses de la anterior, según la tabla mensual. ` +
      (provisional.length
        ? `Ojo: ${provisional.map((m) => m.etiqueta).join(" y ")} son cifras provisionales; la FLA suele corregir los ` +
          "meses recientes al alza en toneladas y eso tiende a bajar el precio por kilo. "
        : "") +
      `Último informe: EL ${last.numero}, publicado el ${longDate(last.emision)}. La línea es el precio implícito mes a mes.`;

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
  }

  function renderTexts() {
    const first = D.informes[0];
    const last = D.informes[D.informes.length - 1];
    document.getElementById("sub").textContent =
      `Federación Lanera Argentina · ${D.informes.length} informes mensuales (EL ${first.numero}–${last.numero}) · datos hasta ${monthName(last.hasta)}`;
    const c = D.comparacion;
    document.getElementById("temporadas-lede").textContent =
      `La temporada ${c.actual.temporada} lleva ${c.meses} meses. La única comparación de igual período es contra ` +
      `${c.anterior.etiqueta}, con la tabla mensual: ${tons(c.actual.total_t)} contra ${tons(c.anterior.total_t)}, ` +
      `${usdM(c.actual.ingresos_usd)} contra ${usdM(c.anterior.ingresos_usd)}.`;
    document.getElementById("foot").textContent =
      `Datos generados el ${longDate(D.generado)} con build.py a partir de los PDF de la FLA. Uso personal.`;

    document.getElementById("revisiones").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Mes</th><th>Versiones (t)</th><th>Cambio t</th><th>Cambio USD</th></tr></thead><tbody>${D.revisiones
      .filter((r) => Math.abs(r.cambio_t) > 0.05)
      .map(
        (r) =>
          `<tr><td>${r.etiqueta}</td><td>${dedupe(r.versiones)
            .map((v) => `EL ${v.numero}: ${num(v.total_t, 1)}`)
            .join(" → ")}</td><td>${num(r.cambio_t, 1)}</td><td>${num(r.cambio_usd)}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;

    document.getElementById("informes").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Informe</th><th>Período</th><th>Publicado</th><th>PDF</th></tr></thead><tbody>${D.informes
      .map(
        (r) =>
          `<tr><td>EL ${r.numero}${r.rectificativa ? '<span class="tag">rectificativa</span>' : ""}</td><td>${monthName(r.desde)} – ${monthName(
            r.hasta,
          )}</td><td>${longDate(r.emision)}</td><td><a href="../data/raw/${encodeURI(r.archivo)}">local</a>${
            r.url ? ` · <a href="${esc(r.url)}" rel="noopener">FLA</a>` : ""
          }</td></tr>`,
      )
      .join("")}</tbody></table></div>${
      D.reemplazados.length
        ? `<p class="note">Reemplazados por una rectificativa posterior: ${D.reemplazados
            .map((r) => `EL ${r.numero} (${esc(r.archivo)})`)
            .join(", ")}.</p>`
        : ""
    }`;
  }

  // Sólo las versiones en que el mes cambió.
  function dedupe(versions) {
    return versions.filter((v, i) => i === 0 || Math.abs(v.total_t - versions[i - 1].total_t) > 0.05);
  }

  // Flechas, Inicio y Fin eligen otra temporada, como en un grupo de botones de radio.
  function arrowSelect(e, seg) {
    const bs = [...seg.querySelectorAll("button")];
    const i = bs.indexOf(e.currentTarget);
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: bs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    bs[(j + bs.length) % bs.length].click();
  }

  function renderSeasonSeg() {
    const seg = document.getElementById("season-seg");
    seg.innerHTML = [...seasons]
      .reverse()
      .map(
        (s) =>
          `<button type="button" role="radio" aria-checked="${s.temporada === season}" tabindex="${s.temporada === season ? 0 : -1}" data-s="${s.temporada}">${esc(seasonLabel(s))}</button>`,
      )
      .join("");
    seg.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        season = b.dataset.s;
        renderSeasonSeg();
        seg.querySelector('[aria-checked="true"]').focus(); // el selector se vuelve a dibujar: sin esto el teclado pierde el foco
        renderSeasonal();
      });
      b.addEventListener("keydown", (e) => arrowSelect(e, seg));
    });
  }

  function renderSeasonal() {
    const s = S();
    const ranked = [...s.destinos].sort((a, b) => b.total - a.total);
    const top3 = ranked.slice(0, 3);
    document.getElementById("destinos-lede").textContent =
      `${seasonLabel(s)}: ${s.destinos.length} destinos. ` +
      top3.map((d) => `${d.pais} ${pct(d.total / s.total_t, 0)}`).join(", ") +
      `; entre los tres, ${pct(sum(top3.map((d) => d.total)) / s.total_t, 0)} de las toneladas. ${ajusteNote(s)}`;
    for (const id of Object.keys(SPECS)) if (SPECS[id].seasonal) render(id);
  }

  function renderAll() {
    readTokens();
    renderKpis();
    for (const id of Object.keys(SPECS)) render(id);
    renderSeasonal();
  }

  // ------------------------------------------------------------ arranque

  document.querySelectorAll("[data-chart]").forEach((el) => buildCard(el, el.dataset.chart));
  renderTexts();
  renderSeasonSeg();
  renderAll();

  // El selector de temporada queda fijo justo debajo del encabezado, cuya altura cambia al angostar.
  function placeSeasonBar() {
    const h = document.querySelector(".top").offsetHeight;
    document.getElementById("season-bar").style.top = `${h + 8}px`;
    document.documentElement.style.scrollPaddingTop = `${h + 70}px`;
  }
  placeSeasonBar();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
  let pending;
  window.addEventListener("resize", () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      placeSeasonBar();
      Object.values(instances).forEach((i) => i.resize());
    }, 120);
  });
})();
