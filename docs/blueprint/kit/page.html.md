# Kit · page skeleton

One HTML file per study. Copy this, then replace every word in the visible text: it is placeholder content in English. The class names and ids are the contract with `styles.css`, `ui.js` and the page script; keep them.

This skeleton matches the example in [page.js.md](page.js.md). Together with [styles.css.md](styles.css.md), [ui.js.md](ui.js.md) and the chart library, it is a working page.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site name · study name</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="top">
  <div class="wrap top-row">
    <a class="brand" href="index.html"><svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><defs><linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset=".6" style="stop-color:var(--accent-2)"/><stop offset="1" style="stop-color:var(--accent-3)"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#brand-g)"/><path d="M9 22V12m4.7 10v-6m4.6 6V10M23 22v-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg><span>Site<b>name</b></span></a>
    <nav class="pages" aria-label="Studies">
      <a href="index.html" aria-current="page">Now</a>
      <a href="history.html">History</a>
      <a href="industry.html">Industry</a>
      <a href="chain.html">Chain of one product</a>
      <a href="opportunities.html">Opportunities</a>
    </nav>
  </div>
  <nav class="nav wrap" aria-label="Sections">
    <a href="#summary">Summary</a>
    <a href="#monthly">Month by month</a>
    <a href="#destinations">Destinations</a>
    <a href="#sources">Sources</a>
  </nav>
</header>

<div class="hero">
  <canvas class="fibers" aria-hidden="true"></canvas>
  <div class="wrap">
    <p class="eyebrow"><span>01</span>Now<i></i></p>
    <h1>Exports of <em>the material</em></h1>
    <p class="sub" id="sub"></p>
    <nav class="journey" aria-label="The five studies"></nav>
  </div>
</div>

<main class="wrap">
  <section id="summary">
    <div class="hero-grid" id="kpis"></div>
    <p class="note" id="kpi-note"></p>
  </section>

  <section id="monthly">
    <h2>Month by month</h2>
    <p class="lede">One to three sentences: what the charts in this section show, in which unit, and the main
      thing to watch for.</p>
    <div class="card" data-chart="monthly"></div>
  </section>

  <div class="season-bar" id="season-bar">
    <span>The sections below show the total of</span>
    <div class="seg" role="radiogroup" aria-label="Period" id="season-seg"></div>
  </div>

  <section id="destinations">
    <h2>Destinations</h2>
    <p class="lede" id="destinations-lede"></p>
    <div class="card" data-chart="destinations"></div>
  </section>

  <section id="sources">
    <h2>Sources and method</h2>
    <div class="card prose">
      <h3>How to read these numbers</h3>
      <ul>
        <li><strong>Units.</strong> Which unit and basis each section uses, and why they are not added.</li>
        <li><strong>What the site computes.</strong> Shares and prices per unit are computed here from quantities
          and money. Printed percentages are not used.</li>
      </ul>
    </div>
  </section>
</main>

<footer class="wrap foot">
  <p id="foot"></p>
</footer>

<script src="vendor/echarts.min.js"></script>
<script src="data.js"></script>
<script src="page.js"></script>
<script src="ui.js"></script>
</body>
</html>
```

## What to change per page

- **File names.** For the first run save this as `index.html`, with the kit's `page.js` and `data.js` beside it. Each real page is `<page>.html` and loads its own `<page>-data.js` and `<page>.js`. A page that has no charts yet loads `ui.js` alone.
- `<html lang>`, a language tag such as `en` or `es`, and `<title>`. The number format is set in the scripts, not here.
- **Brand.** The gradient square stays. Replace the white `<path>` with a glyph for the industry, drawn in a 32 × 32 box with a white stroke of about 1.7 to 2. Replace the two-part name.
- **Study tabs** (`nav.pages`). The same links on every page, one per study, named as in `STUDIES` in `ui.js`, with `aria-current="page"` on the page's own.
- **Section links** (`nav.nav`). One link per `<section id>` on this page, in order. `ui.js` highlights the one in view.
- **Eyebrow.** The study's number and name. Keep the trailing `<i></i>` only on the page that shows live, current data: it draws a pulsing dot.
- **Title.** Wrap the key phrase in `<em>` for the gradient. Add `class="long"` to the `<h1>` when the title is a full question.
- **Framing line.** Where a page must say something before its figures, such as that its case is hypothetical, put a `<p class="lede">` as the first child of the summary section, above the tiles.
- **Study cards** (`nav.journey`). Leave it empty; `ui.js` fills it. Make its `aria-label` match the number of studies. On the first page use `class="journey"`. On the other pages use `class="journey compact"`, which shows only on narrow screens, where the header tabs are hidden.
- **Sections.** Each chart is an empty `<div class="card" data-chart="ID">`; the id must be a key of `SPECS` in the page script. Put two cards side by side by wrapping them in `<div class="grid-2">`.
- **Period selector.** Keep `id="season-bar"` and `id="season-seg"` if the page has period-to-date sections; place it just above the first of them. On pages without one, delete the whole `div`, and in the page script delete: the `seasons`, `season`, `S` and `seasonLabel` lines; the functions `arrowSelect`, `renderSeasonSeg` and `renderSeasonal`; the `renderSeasonal()` call in `renderAll`; and, in the start section, the `renderSeasonSeg()` call, the `placeSeasonBar` function and its two calls. `ui.js` then sets the scroll offset itself.
- **Prose cards** (`class="card prose"`) hold lists, notes and tables that are not charts. A table goes inside `<div class="table-wrap">`.
- **Scripts, in this order:** chart library; `vendor/world.js` only on a page that draws the map; the data bundles the page reads; the page script; `ui.js` last. `ui.js` must run after the page script has written the tiles.
