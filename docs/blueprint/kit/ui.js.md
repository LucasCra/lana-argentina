# Kit · ui.js

The interface script shared by every page, copied without changes from `site/ui.js` at commit `0440132`. Save it as `site/ui.js` and load it last on every page. It reads no data and changes no figure. Comments are in Spanish, the reference site's language.

It ships with the reference site's content: five wool studies, Spanish labels, numbers in the `es-AR` format. [05-shell.md](../05-shell.md) lists each point to change.

```js
// Interfaz común a las cinco páginas: recorrido entre investigaciones, navegación activa,
// barra de lectura, aparición al desplazarse, conteo de las cifras del resumen y las fibras
// de la portada. No lee ni cambia datos: las cifras las escribe el script de cada página y
// el conteo siempre termina en el texto exacto que ese script escribió.
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ recorrido

  const ICONS = {
    globe:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z"/></svg>',
    timeline:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20V10M9 20V5M14 20v-8M19 20V8"/><path d="M3 20h18" opacity=".5"/></svg>',
    spindle:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20"/><path d="M7 8c3-1.5 7-1.5 10 0M6 12c4-1.6 8-1.6 12 0M7 16c3-1.5 7-1.5 10 0"/></svg>',
    tee:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8.5 3.5 4 6l-1.5 4.5L6 11.5V21h12v-9.5l3.5-1L20 6l-4.5-2.5C14.8 5 13.6 6 12 6s-2.8-1-3.5-2.5z"/></svg>',
    target:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  };

  const STUDIES = [
    { href: "index.html", name: "Temporada actual", q: "Cuánta lana sale este año, a qué precio y a dónde.", icon: "globe", color: "--s1" },
    { href: "historia.html", name: "Historia 1998–2026", q: "Las exportaciones, temporada por temporada.", icon: "timeline", color: "--s3" },
    { href: "industria.html", name: "Industria", q: "¿Qué se fabrica en Argentina con su lana?", icon: "spindle", color: "--s4" },
    { href: "cadena.html", name: "Cadena de una remera", q: "De la peinada argentina a una remera de 95 dólares.", icon: "tee", color: "--s2" },
    { href: "oportunidades.html", name: "Oportunidades", q: "¿Dónde puede el país quedarse con más valor de su lana?", icon: "target", color: "--s5" },
  ];

  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  document.querySelectorAll(".journey").forEach((nav) => {
    nav.innerHTML = STUDIES.map((s, i) => {
      const current = s.href === here;
      return (
        `<a href="${s.href}" style="--j:var(${s.color})"${current ? ' aria-current="page"' : ""}>` +
        `<span class="j-top"><span class="j-num">0${i + 1}</span>${ICONS[s.icon]}</span>` +
        `<span class="j-name">${s.name}</span>` +
        `<span class="j-q">${s.q}</span>` +
        `<span class="j-go">${current ? "Estás acá" : "Abrir →"}</span></a>`
      );
    }).join("");
  });

  // ------------------------------------------------------------ cabecera

  const top = document.querySelector(".top");
  const nav = document.querySelector(".nav");
  const progress = document.createElement("div");
  progress.className = "progress";
  top.appendChild(progress);

  const links = [...(nav?.querySelectorAll('a[href^="#"]') || [])];
  const targets = links.map((a) => document.getElementById(a.getAttribute("href").slice(1)));

  function placePadding() {
    // index.html tiene su selector de temporada fijo y app.js ya pone el margen.
    if (!document.getElementById("season-bar")) root.style.scrollPaddingTop = `${top.offsetHeight + 20}px`;
  }

  let active = null;
  let ticking = false;
  function onScroll() {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    progress.style.setProperty("--read", max > 0 ? Math.min(1, scrollY / max) : 0);

    const line = top.offsetHeight + 80;
    let idx = -1;
    targets.forEach((t, i) => {
      if (t && t.getBoundingClientRect().top <= line) idx = i;
    });
    if (scrollY + innerHeight >= root.scrollHeight - 4) idx = targets.length - 1;
    const next = links[idx] || null;
    if (next === active) return;
    active?.classList.remove("is-active");
    active = next;
    if (!active) return;
    active.classList.add("is-active");
    const l = active.offsetLeft - nav.offsetLeft;
    if (l < nav.scrollLeft || l + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, l - 24), behavior: reduce ? "auto" : "smooth" });
    }
  }
  const requestScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  addEventListener("scroll", requestScroll, { passive: true });
  addEventListener("resize", () => {
    placePadding();
    requestScroll();
  });
  placePadding();
  onScroll();

  // ------------------------------------------------------------ brillo bajo el puntero

  document.addEventListener(
    "pointermove",
    (e) => {
      const el = e.target.closest?.(".card, .tile, .journey a");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
    { passive: true },
  );

  // ------------------------------------------------------------ aparición

  if (!reduce && "IntersectionObserver" in window) {
    root.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("main h2, main .lede, main .card, main .tile").forEach((el) => {
      const sibs = el.parentElement ? [...el.parentElement.children] : [];
      const i = Math.min(4, sibs.indexOf(el));
      if (el.matches(".card, .tile") && i > 0) el.style.transitionDelay = `${i * 70}ms`;
      el.classList.add("reveal");
      io.observe(el);
    });
    // Cuando terminó de aparecer, vuelve a sus propias transiciones (sombra, elevación al pasar el puntero).
    document.addEventListener("transitionend", (e) => {
      const el = e.target;
      if (e.propertyName !== "opacity" || !el.classList?.contains("in")) return;
      el.classList.remove("reveal", "in");
      el.style.transitionDelay = "";
    });
  }

  // ------------------------------------------------------------ conteo de las cifras del resumen

  // Sólo números escritos en formato es-AR ("7.067", "9,89"). Al final pone el texto original tal
  // cual; si el script de la página reescribe la cifra mientras tanto, el conteo se detiene.
  function countUp(el) {
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return;
    const final = node.textContent;
    const m = final.match(/^(\s*)(\d{1,3}(?:\.\d{3})*(?:,\d+)?)(\s*)$/);
    if (!m) return;
    const decimals = (m[2].split(",")[1] || "").length;
    const target = Number(m[2].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(target) || target === 0) return;
    const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const t0 = performance.now();
    const D = 1200;
    let last = final;
    const step = (now) => {
      if (node.textContent !== last) return;
      const p = Math.min(1, (now - t0) / D);
      const eased = 1 - (1 - p) ** 4;
      last = p < 1 ? m[1] + fmt.format(target * eased) + m[3] : final;
      node.textContent = last;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Si el navegador pausa los cuadros (pestaña en segundo plano), la cifra exacta igual queda puesta.
    setTimeout(() => {
      if (node.textContent === last && last !== final) {
        node.textContent = final;
        last = final;
      }
    }, D + 400);
  }

  if (!reduce && "IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        seen.unobserve(en.target);
        countUp(en.target);
      }
    });
    document.querySelectorAll(".tile .value").forEach((el) => seen.observe(el));
  }

  // ------------------------------------------------------------ fibras

  // Decoración: hebras con rizo, como el de la lana merino, que siguen un campo de corriente
  // lento y se apartan del puntero. No representan datos.
  // scroll: cuánto corre el campo con el desplazamiento de la página (0 = nada).
  function fibers(canvas, { scroll = 0 } = {}) {
    const ctx = canvas.getContext("2d");
    let active = true;
    let W = 0;
    let H = 0;
    let list = [];
    let palette = [];
    let dark = false;
    let running = false;
    let visible = true;
    const pointer = { x: -1e4, y: -1e4 };

    function readColors() {
      const s = getComputedStyle(root);
      palette = ["accent", "accent-2", "accent-3", "s1", "s3", "accent"].map((n) => s.getPropertyValue(`--${n}`).trim());
      dark = s.colorScheme === "dark";
    }

    function seed() {
      const n = Math.round(Math.max(24, Math.min(80, (W * H) / 10000)));
      list = Array.from({ length: n }, (_, i) => ({
        y0: Math.random() * H * 1.2 - H * 0.1,
        x0: -40 - Math.random() * W * 0.25,
        reach: 0.7 + Math.random() * 0.6,
        amp: 1.2 + Math.random() * 3.2,
        wl: 8 + Math.random() * 10,
        ph: Math.random() * Math.PI * 2,
        col: i % palette.length,
        w: 0.5 + Math.random() * 1.1,
        a: 0.18 + Math.random() * 0.5,
        sp: 0.5 + Math.random() * 0.9,
        drift: Math.random() * 1000,
      }));
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    const field = (x, y, t) =>
      0.42 * Math.sin(y * 0.0045 + t * 0.12) + 0.3 * Math.cos(x * 0.0032 - t * 0.09) + 0.22 * Math.sin((x + y) * 0.0021 + t * 0.05) - 0.08;

    function draw(time) {
      const t = time / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const step = 6;
      const off = scroll * scrollY;
      for (const f of list) {
        const steps = Math.ceil((W * 1.25 * f.reach) / step);
        let x = f.x0;
        let y = f.y0 + 18 * Math.sin(t * 0.2 + f.drift);
        ctx.beginPath();
        for (let s = 0; s < steps; s++) {
          let ang = field(x, y + f.drift + off, t);
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 26000) ang += (dy >= 0 ? 1 : -1) * 0.9 * (1 - d2 / 26000);
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          x += ca * step;
          y += sa * step;
          // rizo: desplazamiento perpendicular a la dirección de la hebra
          const c = f.amp * Math.sin((s * step) / f.wl + f.ph + t * f.sp);
          const px = x - sa * c;
          const py = y + ca * c;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          if (x > W + 40 || y < -60 || y > H + 60) break;
        }
        ctx.strokeStyle = palette[f.col];
        ctx.globalAlpha = f.a;
        ctx.lineWidth = f.w;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function loop(time) {
      if (!running) return;
      draw(time);
      requestAnimationFrame(loop);
    }
    function setRunning() {
      const want = active && visible && !document.hidden && !reduce;
      if (want && !running) {
        running = true;
        requestAnimationFrame(loop);
      } else if (!want) running = false;
    }

    readColors();
    resize();
    draw(performance.now());

    new ResizeObserver(() => {
      resize();
      if (!running) draw(performance.now());
    }).observe(canvas);
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      setRunning();
    }).observe(canvas);
    document.addEventListener("visibilitychange", setRunning);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      readColors();
      if (!running) draw(performance.now());
    });
    canvas.parentElement.addEventListener(
      "pointermove",
      (e) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
      },
      { passive: true },
    );
    canvas.parentElement.addEventListener("pointerleave", () => {
      pointer.x = pointer.y = -1e4;
    });
    setRunning();
    return {
      setActive(on) {
        active = on;
        setRunning();
      },
    };
  }

  document.querySelectorAll("canvas.fibers").forEach((c) => fibers(c));

  // Una capa fija con las mismas hebras acompaña al lector por toda la página. Se enciende
  // cuando la portada (que tiene las suyas) empieza a salir de pantalla.
  const hero = document.querySelector(".hero");
  const page = document.createElement("canvas");
  page.className = "page-fibers";
  page.setAttribute("aria-hidden", "true");
  document.body.prepend(page);
  const pageFibers = fibers(page, { scroll: 0.35 });
  function fadePage() {
    const k = hero ? Math.min(1, Math.max(0, scrollY / (hero.offsetHeight * 0.8))) : 1;
    page.style.setProperty("--k", k.toFixed(3));
    pageFibers.setActive(k > 0.02);
  }
  addEventListener("scroll", fadePage, { passive: true });
  fadePage();
})();
```
