// Dibuja la página de la cadena a partir de window.CADENA (generado por build.py).
// Todas las cuentas están en pipeline/chain.py; aquí sólo hay formato. Los ayudantes de
// formato, tema y tarjetas son copia de los de industria.js.
(() => {
  "use strict";

  const D = window.CADENA;
  const P = D.parametros;
  const ST = D.etapas;
  const S = Object.fromEntries(ST.map((s) => [s.id, s]));
  const SC = Object.fromEntries(D.escenarios.map((s) => [s.id, s]));
  const M = D.masas;
  const price = D.precio_usd;
  const tops = D.peinada;
  const part = (s, id) => s.partes.find((p) => p.id === id)?.usd ?? 0;

  const SNAME = {
    peinada: "Peinada argentina",
    hilado: "Hilado",
    tela: "Tela",
    confeccion: "Confección",
    importacion: "Flete y arancel",
    tienda: "Marca y tienda",
  };
  const PNAME = {
    peinada: "Peinada",
    costos: "Costos",
    ganancia: "Ganancia",
    flete: "Flete y seguro",
    arancel: "Arancel de EE. UU.",
    tienda: "Tienda y venta directa",
    marca: "Marca y oficina central",
  };
  const CLASSES = ["materia", "costo", "ganancia", "impuesto"];
  const CNAME = { materia: "Lana (peinada argentina)", costo: "Costos", ganancia: "Ganancia", impuesto: "Arancel de EE. UU." };
  const CSLOT = { materia: "s1", costo: "past", ganancia: "s3", impuesto: "s2" };
  const GROUPS = ["peinada", "fabrica", "importacion", "marca_tienda"];
  const GNAME = { peinada: "Peinada argentina", fabrica: "Hilado, tela y confección", importacion: "Flete y arancel", marca_tienda: "Marca y tienda" };
  const GSLOT = { peinada: "s1", fabrica: "s4", importacion: "s2", marca_tienda: "s5" };
  const TYPE = { fla: "FLA", fuente: "Fuente", inferencia: "Inferencia", supuesto: "Supuesto" };

  // ------------------------------------------------------------ formato

  const nf = {};
  const num = (v, d = 0) => {
    if (v == null || Number.isNaN(v)) return "–";
    nf[d] ??= new Intl.NumberFormat("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[d].format(v);
  };
  const usd = (v, d = 2) => (v == null ? "–" : `${num(v, d)} USD`);
  const perKg = (v, d = 2) => (v == null ? "–" : `${num(v, d)} USD/kg`);
  const grams = (v) => `${num(v)} g`;
  const pct = (v, d = 0) => (v == null ? "–" : `${num(v * 100, d)} %`);
  const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const monthName = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
  // "junio y julio de 2026" when the months share a year.
  const monthList = (yms) =>
    new Set(yms.map((m) => m.slice(0, 4))).size === 1
      ? `${yms.map((m) => MONTHS[Number(m.slice(5, 7)) - 1]).join(" y ")} de ${yms[0].slice(0, 4)}`
      : yms.map(monthName).join(" y ");
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const link = (url, text) => `<a href="${esc(url)}" rel="noopener">${esc(text)}</a>`;
  const share = (v) => pct(v / price, 1);
  const groupUsd = (sc, g) => sc[`${g}_usd`];
  const narrow = () => window.innerWidth < 640;

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
  const cColor = (k) => C[CSLOT[k]];
  const gColor = (k) => C[GSLOT[k]];
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
  // Barras apiladas: sólo el último segmento presente de cada barra lleva la punta redondeada
  // y, si se pide, la etiqueta.
  function stacked(keys, rows, get, radius = [4, 4, 0, 0], label = null) {
    const top = rows.map((r) => [...keys].reverse().find((k) => get(r, k)));
    return keys.map((k) =>
      rows.map((r, i) => {
        const v = get(r, k);
        if (!v) return null;
        if (top[i] !== k) return { value: v };
        return { value: v, itemStyle: { borderRadius: radius }, ...(label ? { label: label(r, i) } : {}) };
      }),
    );
  }
  const barSeries = (name, data, color, extra = {}) => ({
    name,
    type: "bar",
    stack: "t",
    barMaxWidth: 44,
    data,
    itemStyle: { color, borderColor: C.surface, borderWidth: 1 },
    emphasis: { focus: "series" },
    ...extra,
  });

  // ------------------------------------------------------------ gráficos

  // La cascada: cada etapa arranca donde terminó la anterior; la última barra es el precio entero.
  const cascadeRows = () => [
    ...ST.map((s) => ({ name: SNAME[s.id], base: s.compra_usd, stage: s })),
    { name: "Precio en la tienda", base: 0, stage: null },
  ];
  const classUsd = (row, k) =>
    row.stage
      ? sum(row.stage.partes.filter((p) => p.clase === k).map((p) => p.usd))
      : sum(ST.flatMap((s) => s.partes.filter((p) => p.clase === k).map((p) => p.usd)));

  const SPECS = {
    cascada: {
      title: () => `De ${num(S.peinada.vende_usd, 2)} a ${num(price, 2)} dólares`,
      sub: () => "Lo que agrega cada etapa a una remera y en qué se va, en dólares por remera",
      legend: () => CLASSES.map((k) => ({ label: CNAME[k], color: cColor(k) })),
      foot: "Cada barra empieza donde terminó la anterior. Las etapas de fábrica (hilado, tela y confección) son las menos seguras: ver “Qué cambia si cambia un supuesto”.",
      height: "tall",
      option() {
        const rows = cascadeRows();
        const label = (r) => ({
          show: true,
          position: "top",
          color: C.ink2,
          fontSize: 11,
          formatter: () => (r.stage ? `+${num(r.stage.agrega_usd, 2)}` : num(price, 2)),
        });
        const data = stacked(CLASSES, rows, classUsd, [4, 4, 0, 0], label);
        return {
          ...base(),
          grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              if (!r.stage) {
                const lines = CLASSES.map((k) => `${swatch(cColor(k))}${CNAME[k]}: <b>${usd(classUsd(r, k))}</b> · ${share(classUsd(r, k))}`);
                return `<b>Precio en la tienda: ${usd(price)}</b><br>${lines.join("<br>")}`;
              }
              const s = r.stage;
              const lines = s.partes.map((p) => `${swatch(cColor(p.clase))}${PNAME[p.id]}: <b>${usd(p.usd)}</b>`);
              return (
                `<b>${SNAME[s.id]}</b><br>Compra: ${usd(s.compra_usd)} · vende: <b>${usd(s.vende_usd)}</b><br>` +
                `Agrega: <b>${usd(s.agrega_usd)}</b> · ${share(s.agrega_usd)} del precio<br>${lines.join("<br>")}`
              );
            },
          },
          xAxis: axisCat(rows.map((r) => r.name), {
            axisLabel: narrow()
              ? { color: C.ink2, fontSize: 10, interval: 0, rotate: 45, formatter: (v) => v.split(" ")[0] }
              : { color: C.ink2, fontSize: 11, interval: 0, width: 72, overflow: "break" },
          }),
          yAxis: axisVal((v) => num(v)),
          series: [
            {
              name: "base",
              type: "bar",
              stack: "t",
              silent: true,
              data: rows.map((r) => r.base),
              itemStyle: { color: "transparent" },
              tooltip: { show: false },
            },
            ...CLASSES.map((k, i) => barSeries(CNAME[k], data[i], cColor(k))),
          ],
        };
      },
      table: () => ({
        head: ["Etapa", "Compra USD", "Agrega USD", "Vende USD", "% del precio"],
        rows: ST.map((s) => [SNAME[s.id], num(s.compra_usd, 2), num(s.agrega_usd, 2), num(s.vende_usd, 2), share(s.agrega_usd)]),
      }),
    },

    kilo: {
      title: "Cuánto vale un kilo en cada etapa",
      sub: () => "Dólares por kilo de lo que sale de cada etapa, en escala logarítmica",
      legend: () => [],
      foot: () => `Un kilo de remera son unas ${num(1000 / M.prenda_g, 1)} remeras. Desde el hilado, el kilo incluye el nailon.`,
      option() {
        const rows = kiloRows();
        return {
          ...base(),
          grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
          tooltip: { ...axisTip(), formatter: (ps) => `${esc(rows[ps[0].dataIndex].label)}<br><b>${perKg(ps[0].value)}</b>` },
          xAxis: axisVal((v) => num(v), { type: "log", min: 5, axisLabel: { show: false } }),
          yAxis: axisCat(rows.map((r) => r.label), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: [
            {
              type: "bar",
              barMaxWidth: 22,
              data: rows.map((r) => ({ value: r.v, itemStyle: { color: r.color, borderRadius: [0, 4, 4, 0] } })),
              label: { show: true, position: "right", color: C.ink2, fontSize: 11, formatter: (p) => num(p.value, p.value < 100 ? 1 : 0) },
            },
          ],
        };
      },
      table: () => ({ head: ["Etapa", "USD por kilo", "Gramos por remera"], rows: kiloRows().map((r) => [r.label, num(r.v, 2), num(r.g)]) }),
    },

    masas: {
      title: "Gramos que compra cada etapa para una remera",
      sub: () => `Remera de ${grams(M.prenda_g)} con ${pct(P.lana_frac.valor)} de lana`,
      legend: () => [
        { label: "Lana", color: C.s1 },
        { label: "Nailon", color: C.past },
      ],
      foot: "Cada etapa compra más de lo que entrega: lo que falta es la merma. Según Woolwise, los desperdicios del hilado peinado vuelven a la industria cardada.",
      option() {
        const rows = massRows();
        const data = stacked(["lana", "nailon"], rows, (r, k) => r[k], [0, 4, 4, 0], (r) => ({
          show: true,
          position: "right",
          color: C.ink2,
          fontSize: 11,
          formatter: () => grams(r.lana + r.nailon),
        }));
        return {
          ...base(),
          grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              return `<b>${r.label}</b><br>Lana: <b>${grams(r.lana)}</b><br>Nailon: <b>${grams(r.nailon)}</b>${r.merma ? `<br>${r.merma}` : ""}`;
            },
          },
          xAxis: axisVal((v) => num(v)),
          yAxis: axisCat(rows.map((r) => r.label), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: [barSeries("Lana", data[0], C.s1, { barMaxWidth: 26 }), barSeries("Nailon", data[1], C.past, { barMaxWidth: 26 })],
        };
      },
      table: () => ({
        head: ["Etapa", "Lana g", "Nailon g", "Total g", "Merma"],
        rows: massRows().map((r) => [r.label, num(r.lana, 1), num(r.nailon, 1), num(r.lana + r.nailon, 1), r.merma || "–"]),
      }),
    },

    escenarios: {
      title: "A dónde va el precio en cada escenario",
      sub: () => "Dólares por remera; cada fila cambia un supuesto del caso base",
      legend: () => GROUPS.map((g) => ({ label: GNAME[g], color: gColor(g) })),
      foot: "La peinada no cambia lo que agregan las fábricas: la cuenta supone que la pasan a costo. Las dos últimas filas venden la misma remera más barata; la diferencia sale entera de la marca y la tienda.",
      height: "tall",
      option() {
        const rows = D.escenarios;
        const data = stacked(GROUPS, rows, groupUsd, [0, 4, 4, 0], (r) => ({
          show: true,
          position: "right",
          color: C.ink2,
          fontSize: 11,
          formatter: () => num(r.precio_usd, 2),
        }));
        return {
          ...base(),
          grid: { left: 8, right: 52, top: 8, bottom: 8, containLabel: true },
          tooltip: {
            ...axisTip(),
            formatter: (ps) => {
              const r = rows[ps[0].dataIndex];
              const lines = GROUPS.map((g) => `${swatch(gColor(g))}${GNAME[g]}: <b>${usd(groupUsd(r, g))}</b> · ${pct(groupUsd(r, g) / r.precio_usd, 1)}`);
              return `<b>${esc(r.nombre)}</b><br>${esc(r.cambio)}<br>${lines.join("<br>")}<br>Ganancia de la marca: <b>${usd(r.ganancia_marca_usd)}</b>`;
            },
          },
          xAxis: axisVal((v) => num(v)),
          yAxis: axisCat(rows.map((r) => r.nombre), { inverse: true, axisLabel: { color: C.ink2, fontSize: 12 } }),
          series: GROUPS.map((g, i) => barSeries(GNAME[g], data[i], gColor(g), { barMaxWidth: 20 })),
        };
      },
      table: () => ({
        head: ["Escenario", "Qué cambia", "Peinada USD", "% del precio", "Fábrica USD", "Flete y arancel USD", "Marca y tienda USD", "% del precio", "Ganancia de la marca USD"],
        rows: D.escenarios.map((r) => [
          r.nombre,
          r.cambio,
          num(r.peinada_usd, 2),
          pct(r.peinada_usd / r.precio_usd, 1),
          num(r.fabrica_usd, 2),
          num(r.importacion_usd, 2),
          num(r.marca_tienda_usd, 2),
          pct(r.marca_tienda_usd / r.precio_usd, 1),
          num(r.ganancia_marca_usd, 2),
        ]),
      }),
    },
  };

  function kiloRows() {
    const rows = [
      ["Peinada", S.peinada, C.s1],
      ["Hilado", S.hilado, C.s4],
      ["Tela", S.tela, C.s4],
      ["Remera en la fábrica", S.confeccion, C.s4],
      ["Remera importada", S.importacion, C.s2],
      ["Remera en la tienda", S.tienda, C.s5],
    ];
    return rows.map(([label, s, color]) => ({ label, v: s.usd_kg, g: s.salida_g, color }));
  }

  function massRows() {
    return [
      { label: "Peinada", lana: M.peinada_g, nailon: 0, merma: `Se pierden ${grams(S.hilado.merma_g)} al hilar (${pct(P.merma_hilado.valor)})` },
      { label: "Hilado", lana: M.lana_hilado_g, nailon: M.nailon_g, merma: `Se pierden ${grams(S.tela.merma_g)} al tejer y terminar (${pct(P.merma_tejido.valor, 1)})` },
      { label: "Tela", lana: M.lana_tela_g, nailon: M.tela_g - M.lana_tela_g, merma: `Se pierden ${grams(S.confeccion.merma_g)} al cortar (${pct(P.merma_corte.valor)})` },
      { label: "Remera", lana: M.lana_prenda_g, nailon: M.prenda_g - M.lana_prenda_g, merma: null },
    ];
  }

  // ------------------------------------------------------------ tarjetas

  const instances = {};
  const resolve = (v) => (typeof v === "function" ? v() : v || "");

  function buildCard(el, id) {
    const spec = SPECS[id];
    el.innerHTML = `
      <div class="card-head">
        <div><p class="card-title"></p><p class="card-sub"></p></div>
        <button class="btn" type="button" aria-expanded="false">Ver tabla</button>
      </div>
      <div class="chart ${spec.height || ""}" role="img"></div>
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

  function tableHtml(t) {
    return `<table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${t.rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  }

  function renderTable(id) {
    const el = document.querySelector(`[data-chart="${id}"] .table-wrap`);
    if (el.hidden) return;
    el.innerHTML = tableHtml(SPECS[id].table());
  }

  function render(id) {
    const card = document.querySelector(`[data-chart="${id}"]`);
    const spec = SPECS[id];
    const title = resolve(spec.title);
    card.querySelector(".card-title").textContent = title;
    card.querySelector(".chart").setAttribute("aria-label", title);
    card.querySelector(".card-sub").textContent = resolve(spec.sub);
    const foot = resolve(spec.foot);
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

  function renderKpis() {
    const factory = SC.base.fabrica_usd;
    const shop = S.tienda;
    const tile = (label, value, unit, delta, hero = false) =>
      `<div class="tile${hero ? " hero" : ""}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit}</span></div><div class="delta">${delta}</div></div>`;
    document.getElementById("kpis").innerHTML = [
      tile(
        "Lana argentina en la remera",
        num(S.peinada.vende_usd, 2),
        "USD",
        `${share(S.peinada.vende_usd)} de los ${num(price)} dólares: ${grams(M.peinada_g)} de peinada a ${perKg(tops.cerrada.usd_kg)} (FLA ${tops.cerrada.temporada}).`,
        true,
      ),
      tile(
        "Hilado, tela y confección",
        num(factory, 2),
        "USD",
        `${share(factory)} del precio. Sale de la fábrica a ${usd(D.fabrica.central)}; con otras fuentes, entre ${num(D.fabrica.bajo, 2)} y ${num(D.fabrica.alto, 2)}.`,
      ),
      tile(
        "Flete y arancel de EE. UU.",
        num(S.importacion.agrega_usd, 2),
        "USD",
        `Arancel de ${pct(D.arancel.total, 1)} sobre el precio de fábrica: ${pct(D.arancel.nmf)} general y ${pct(D.arancel.s301, 1)} de recargo a Vietnam.`,
      ),
      tile(
        "Marca y tienda",
        num(shop.agrega_usd, 2),
        "USD",
        `${share(shop.agrega_usd)} del precio. Ganancia estimada de la marca: ${usd(part(shop, "ganancia"))} por remera.`,
      ),
    ].join("");
    const pr = D.producto;
    document.getElementById("kpi-note").innerHTML =
      `${link(pr.url, `${pr.nombre} (${pr.estilo})`)}: ${esc(pr.composicion)}, hecha en ${esc(pr.origen)}, ${usd(price)} en la tienda de la marca en EE. UU., sin impuesto a las ventas (leído el ${longDate(pr.leido)}). ` +
      `Dueña de la marca: ${link(pr.duenio_url, pr.duenio)}.`;
  }

  function renderTexts() {
    document.getElementById("sub").textContent =
      `Una remera de merino, etapa por etapa, con la peinada al precio de exportación de la FLA (${tops.cerrada.temporada})`;

    const f = tops.fina;
    const same = tops.mismos_meses;
    document.getElementById("cascada-lede").innerHTML =
      `El punto de partida es el pedido: la lana entra a la cadena al precio al que Argentina exportó lana peinada en ${tops.cerrada.temporada}, ` +
      `${perKg(tops.cerrada.usd_kg)} limpio y FOB (${num(tops.cerrada.t)} t por ${num(tops.cerrada.usd / 1e6, 1)} millones de dólares, informe EL ${tops.cerrada.numero}). ` +
      `De ahí se hila con un alma de nailon, se teje y se tiñe (la marca no dice dónde), se confecciona en ${esc(D.producto.origen)}, viaja a EE. UU., paga arancel y se vende en la tienda propia de la marca a ${usd(price)}. ` +
      `<strong>Ojo con la finura:</strong> la FLA clasifica como fina (hasta 24,5 micras) el ${pct(tops.cerrada.fina_pct)} de la peinada exportada en ${tops.cerrada.temporada} y no publica precios por micronaje; ` +
      `una remera para usar sobre la piel lleva lana más fina (Icebreaker declara 18,9 micras para la suya). ` +
      `En ${monthList(same.meses)} la peinada argentina valió ${perKg(same.usd_kg)}; la australiana de 18,5 micras, ${perKg(f.usd_kg)} en Italia, ` +
      `${num(f.usd_kg / same.usd_kg, 1)} veces ese precio. Con esa lana, la remera lleva ${usd(SC.peinada_fina.peinada_usd)} de lana.`;
    document.getElementById("nota-finura").innerHTML =
      `<strong>La finura.</strong> La FLA no publica el precio de la peinada por micronaje. El ${pct(tops.cerrada.fina_pct)} de la exportada en ${tops.cerrada.temporada} es fina (hasta 24,5 micras), ` +
      `pero una remera para usar sobre la piel lleva lana más fina. La cuenta usa el precio promedio porque es el punto de partida pedido; el escenario de peinada fina muestra cuánto cambia.`;

    document.getElementById("kilos-lede").textContent =
      `Una remera de ${grams(M.prenda_g)} tiene ${grams(M.lana_prenda_g)} de lana. Para llegar a ella hace falta comprar ${grams(M.peinada_g)} de peinada: ` +
      `en cada etapa se pierde algo de fibra. El peso de la remera es el supuesto más débil de la cuenta: la marca no lo publica y las mediciones van de ` +
      `${grams(P.peso_prenda_g.min)} a ${grams(P.peso_prenda_g.max)}. Con eso, la lana va de ${usd(SC.peso_min.peinada_usd)} a ${usd(SC.peso_max.peinada_usd)} por remera.`;

    const fullPrice = D.escenarios.filter((s) => s.precio_usd === price);
    const argentine = fullPrice.filter((s) => s.id !== "peinada_fina").map((s) => s.peinada_usd / s.precio_usd);
    const brand = fullPrice.map((s) => s.marca_tienda_usd / s.precio_usd);
    const sale = D.escenarios.filter((s) => s.precio_usd < price);
    document.getElementById("supuestos-lede").textContent =
      `Ningún supuesto cambia el orden de las cosas. A precio pleno, la lana argentina queda entre ${pct(Math.min(...argentine), 1)} y ` +
      `${pct(Math.max(...argentine), 1)} del precio (${pct(SC.peinada_fina.peinada_usd / price, 1)} si fuera peinada fina australiana), y la marca con la tienda entre ` +
      `${pct(Math.min(...brand))} y ${pct(Math.max(...brand))}. Lo que más mueve es el costo de fábrica, la parte menos documentada. ` +
      sale
        .map((s, i) => {
          const result = s.ganancia_marca_usd < 0 ? `pierde ${usd(-s.ganancia_marca_usd)}` : `gana ${usd(s.ganancia_marca_usd)}`;
          return `${i ? "v" : "V"}endida a ${num(s.precio_usd, 2)}, la marca ${result} por remera`;
        })
        .join("; ") +
      `: la remera puesta en EE. UU. cuesta lo mismo (${usd(S.tienda.compra_usd)}) y los gastos de tienda y de marca, que la cuenta toma como parte del precio, bajan menos que lo que se rebaja.`;

    renderStageTable();
    renderMargins();
    renderAssumptions();
    renderMethod();

    document.getElementById("foot").textContent =
      `Datos generados el ${longDate(D.generado)} con build.py a partir de los informes de la FLA y de data/cadena.json. Uso personal.`;
  }

  function renderStageTable() {
    const margin = (s) => (s.margen != null ? pct(s.margen, 1) : "–");
    const rows = ST.map((s) => {
      const cost = sum(s.partes.filter((p) => p.clase === "costo" || p.clase === "impuesto").map((p) => p.usd));
      const profit = part(s, "ganancia");
      return [
        SNAME[s.id],
        num(s.compra_usd, 2),
        num(s.vende_usd, 2),
        num(s.agrega_usd, 2),
        share(s.agrega_usd),
        s.id === "peinada" ? "–" : num(cost, 2),
        s.id === "peinada" || s.id === "importacion" ? "–" : num(profit, 2),
        s.id === "tienda" ? pct(profit / s.vende_usd, 1) : margin(s),
        s.multiplicador ? `× ${num(s.multiplicador, 2)}` : "–",
      ];
    });
    document.getElementById("tabla-etapas").innerHTML = tableHtml({
      head: ["Etapa", "Compra USD", "Vende USD", "Agrega USD", "% del precio", "Costos y arancel USD", "Ganancia USD", "Ganancia / ventas", "Vende / compra"],
      rows,
    });

    const cmp = Object.fromEntries(D.comparables.map((c) => [c.empresa, c]));
    const ref = (name, text) => (cmp[name] ? link(cmp[name].url, text) : esc(text));
    const shop = S.tienda;
    const notes = [
      `<strong>Peinada argentina, ${usd(S.peinada.vende_usd)}.</strong> Es lo que cobra Argentina por la lana ya lavada y peinada, puesta en el barco: ` +
        `el precio del productor por la lana sucia más el lavado y el peinado (la prima del peinado está en ${link("industria.html#valor", "la página de industria")}). ` +
        `Como referencia de ganancia, el segmento lanero de Chargeurs, que comercia lana, ganó ${ref("Chargeurs, segmento Luxury Fibers", "1,0 % de sus ventas en 2025")}; ` +
        `según su documento de 2023, Chargeurs tiene la peinaduría de Trelew como negocio conjunto, sin consolidarla. La línea de peinada de Xinao tuvo ${ref("Xinao, línea de peinada", "7,2 % de margen bruto")}.`,
      `<strong>Hilado, ${usd(S.hilado.agrega_usd)}.</strong> El hilandero compra ${grams(M.peinada_g)} de peinada y ${grams(M.nailon_g)} de nailon, pierde ` +
        `${grams(S.hilado.merma_g)} de fibra y entrega ${grams(M.hilado_g)} de hilado, que vale ${perKg(S.hilado.usd_kg)}. ` +
        `Paga energía, mano de obra, el alma de nailon y el viaje de la peinada hasta la hilandería. Ganancia supuesta: ${pct(S.hilado.margen, 1)} de lo que vende (Xinao).`,
      `<strong>Tela, ${usd(S.tela.agrega_usd)}.</strong> Tejido de punto, teñido, terminación y avíos (etiquetas, hilo de coser). Es la etapa de fábrica que más agrega y la menos segura: ` +
        `la hoja de costos de una marca equivale a ${perKg(D.tela_hoja_usd_kg, 0)} de tela de lana fina; los avisos de fábricas chinas piden desde ${perKg(P.tela_catalogo_usd_kg.valor, 0)}, sin decir el micronaje. ` +
        `Ganancia supuesta: ${pct(S.tela.margen, 1)} (Nanshan, tela peinada).`,
      `<strong>Confección, ${usd(S.confeccion.agrega_usd)}.</strong> Corte, costura, terminación y embalaje en ${esc(D.producto.origen)}; al cortar se pierden ${grams(S.confeccion.merma_g)} de tela. ` +
        `Ganancia supuesta: ${pct(S.confeccion.margen)} del precio de fábrica, lo que Public Eye anota como finanzas y ganancia en una remera básica de Bangladesh (la ganancia neta es 3 % y los salarios, 12 %).`,
      `<strong>Flete y arancel, ${usd(S.importacion.agrega_usd)}.</strong> Flete y seguro, ${usd(part(S.importacion, "flete"))} (supuesto). ` +
        `Arancel, ${usd(part(S.importacion, "arancel"))}: EE. UU. lo cobra sobre el precio pagado a la fábrica, sin el flete internacional. Lo cobra el Estado; no es ganancia de nadie en la cadena.`,
      `<strong>Marca y tienda, ${usd(shop.agrega_usd)}.</strong> Lo que queda entre la remera puesta en EE. UU. (${usd(shop.compra_usd)}) y el precio. ` +
        `Tienda y venta directa (alquiler, personal, web, envíos), ${usd(part(shop, "tienda"))}; marca y oficina central (diseño, publicidad, administración), ${usd(part(shop, "marca"))}: ` +
        `${pct(D.tienda.tienda, 1)} y ${pct(D.tienda.marca, 1)} de las ventas, como en la venta directa de Canada Goose. ` +
        `La ganancia es lo que sobra: ${usd(part(shop, "ganancia"))}. VF, dueña de Smartwool, no publica cifras de la marca.`,
    ];
    document.getElementById("notas-etapas").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
  }

  function renderMargins() {
    const rows = D.comparables.map(
      (c) =>
        `<tr><td>${esc(c.etapa)}</td><td class="left">${link(c.url, c.empresa)}</td><td>${esc(c.anio)}</td><td>${pct(c.bruto, 1)}</td><td>${pct(c.operativo, 1)}</td><td class="wrap-cell">${esc(c.nota)}</td></tr>`,
    );
    document.getElementById("tabla-margenes").innerHTML =
      `<table><thead><tr><th>Etapa</th><th>Empresa</th><th>Año</th><th>Margen bruto</th><th>Margen operativo</th><th>Nota</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }

  function value(key, p) {
    const v = p.valor;
    if (key === "peinada_fina")
      return v.map((q) => `${num(q.eur_kg, 2)} €/kg el ${longDate(q.fecha)} (${num(q.eur_kg * q.usd_eur, 2)} USD)`).join("; ");
    if (key === "tienda_canada_goose")
      return `margen bruto ${pct(v.dtc_margen_bruto, 1)}; margen del canal ${pct(v.dtc_margen_operativo, 1)}; gastos corporativos ${num(v.gastos_corporativos_mcad, 1)} M de ${num(v.ingresos_totales_mcad, 1)} M`;
    if (Array.isArray(v)) return v.map((x) => usd(x)).join(" y ");
    if (p.unidad.startsWith("fracción")) return pct(v, v < 0.1 ? 2 : 1);
    if (p.unidad === "g") return grams(v);
    if (p.unidad === "USD/kg") return perKg(v);
    return usd(v);
  }
  const range = (key, p) => (p.min == null ? "–" : `${value(key, { ...p, valor: p.min })} a ${value(key, { ...p, valor: p.max })}`);

  function renderAssumptions() {
    const fla = `<tr><td class="name-cell">Peinada argentina, ${esc(tops.cerrada.temporada)}</td><td class="value-cell">${perKg(tops.cerrada.usd_kg)}</td><td>–</td><td><span class="tag">FLA</span></td><td>build</td>` +
      `<td class="source-cell">Ingresos sobre toneladas limpias de peinada del informe EL ${tops.cerrada.numero}. ${esc(tops.actual.temporada)} hasta ${monthName(tops.actual.hasta)}: ${perKg(tops.actual.usd_kg)}` +
      `${tops.actual.provisionales.length ? ` (${monthList(tops.actual.provisionales)}, provisorios)` : ""}.</td></tr>`;
    const rows = Object.entries(P).map(([key, p]) => {
      const note = p.nota ? ` ${esc(p.nota)}` : "";
      return (
        `<tr><td class="name-cell">${esc(p.nombre)}</td><td class="value-cell">${value(key, p)}</td><td>${range(key, p)}</td>` +
        `<td><span class="tag">${TYPE[p.tipo]}</span></td><td>${p.releido ? "sí" : "no"}</td>` +
        `<td class="source-cell">${link(p.url, p.fuente)}${note}</td></tr>`
      );
    });
    document.getElementById("tabla-supuestos").innerHTML =
      `<table><thead><tr><th>Parámetro</th><th>Valor</th><th>Rango</th><th>Tipo</th><th>Releído</th><th>Fuente y nota</th></tr></thead><tbody>${fla}${rows.join("")}</tbody></table>`;
  }

  function renderMethod() {
    const fine = SC.peinada_fina;
    const fineLanded = fine.fob_usd + fine.importacion_usd;
    const cg = P.tienda_canada_goose.valor;
    const items = [
      `<strong>Por remera.</strong> Se parte del peso de la remera y se sube por la cadena: tela comprada (más la merma de corte), hilado comprado (más la de tejido), ` +
        `lana en ese hilado (${pct(P.lana_frac.valor)}) y peinada comprada (más la de hilado). Cada etapa compra lo que vende la anterior.`,
      `<strong>El precio en la puerta de la fábrica.</strong> La única hoja de costos publicada de una remera de merino (Quince: materiales ${usd(P.materiales_usd.valor)}, ` +
        `confección ${usd(P.confeccion_usd.valor)}, embalaje ${usd(P.embalaje_usd.valor)}) fija ese precio para una remera de lana fina: ${usd(fine.fob_usd)}. ` +
        `Quince no publica el peso; la cuenta supone que su remera pesa como ésta y lleva sus materiales a un precio por kilo de tela. ` +
        `Con peinada argentina, cada etapa desde el hilado cuesta ${usd(fine.fob_usd - SC.base.fob_usd)} menos: la diferencia de precio de la peinada por los gramos que se compran (inferencia).`,
      `<strong>Por qué ese precio y no la suma de avisos.</strong> Sumar la tela más barata de los avisos y la confección da ${usd(D.fabrica.bajo)} con peinada argentina; los avisos de remeras terminadas piden hasta ${usd(P.fob_alto_usd.valor)}. ` +
        `Control: en la venta directa de Canada Goose el costo de la mercadería es ${pct(1 - cg.dtc_margen_bruto, 1)} de las ventas, ${usd((1 - cg.dtc_margen_bruto) * price)} en una remera de ${num(price)}. ` +
        `La remera de lana fina puesta en EE. UU. cuesta aquí ${usd(fineLanded)} (${share(fineLanded)}); con la suma de avisos, aun con peinada fina, quedaría muy por debajo ` +
        `(con peinada argentina, ${usd(SC.fabrica_bajo.fob_usd + SC.fabrica_bajo.importacion_usd)}). Por eso los avisos quedan como piso.`,
      `<strong>Arancel.</strong> Partida 6109.90.80 del arancel de EE. UU. (remeras de punto de lana de manga corta), ${pct(D.arancel.nmf)}, más ${pct(D.arancel.s301, 1)} de la Sección 301 para productos de Vietnam desde el 24 de julio de 2026. ` +
        `Se cobra sobre el precio pagado a la fábrica, sin el flete ni el seguro internacionales (${link("https://www.law.cornell.edu/uscode/text/19/1401a", "19 U.S.C. § 1401a(b)(4)(A)")}). ` +
        `El recargo está impugnado; el escenario “sin el recargo” muestra el caso.`,
      `<strong>Ganancia y costos.</strong> En el hilado, la tela y la confección, la ganancia es el margen operativo de una empresa cotizada de la etapa por lo que vende la etapa; en la marca y la tienda, lo que queda después de los gastos de tienda y de marca. ` +
        `Son promedios de empresas enteras, con otras fibras y otros clientes: indican el orden de magnitud, no la cuenta de esta remera.`,
      `<strong>Monedas.</strong> Euros y yuanes a dólares con el promedio mensual o anual del Banco Central Europeo. Dólares corrientes.`,
    ];
    document.getElementById("metodo").innerHTML = items.map((i) => `<li>${i}</li>`).join("");
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
    pending = setTimeout(() => {
      Object.values(instances).forEach((i) => i.resize());
      render("cascada"); // the axis labels change with the width
    }, 120);
  });
})();
