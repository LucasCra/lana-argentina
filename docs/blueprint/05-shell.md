# 05 · The shell and the charts

The look and behaviour of the site live in four files, given in full in `kit/`. Do not write them from a description: copy them, run the example page, then adapt the points listed here.

| Kit file | Becomes | Role |
| --- | --- | --- |
| [kit/styles.css.md](kit/styles.css.md) | `site/styles.css` | Every colour, size and component. One file for all pages. |
| [kit/ui.js.md](kit/ui.js.md) | `site/ui.js` | Behaviour shared by all pages. Reads no data. |
| [kit/page.html.md](kit/page.html.md) | `site/<page>.html` | The skeleton of one page. |
| [kit/page.js.md](kit/page.js.md) | `site/<page>.js` and `site/<page>-data.js` | One page's charts, tiles and texts, with example data. |

Also needed, not in the kit:

- **The chart library.** Apache ECharts 5.5.1, as the single file `echarts.min.js` from the `dist/` folder of its official release, saved to `site/vendor/`.
- **Map data**, only if a page draws the world map. ECharts 5 ships none. Take a world GeoJSON with an open licence in which every feature has a `name` property, and save it as `site/vendor/world.js` in the form `echarts.registerMap("world", <the GeoJSON>);`. The names in that file are the ones the parser's country table must map to.

Download both once and commit them. The site must not load anything from the network.

[kit/chart-excerpts.md](kit/chart-excerpts.md) holds the reference code for the two charts that are hard to rebuild from a description: the world map with flow lines and the sparkline inside a tile.

## Anatomy of a page

From top to bottom:

- **Header** (`header.top`), fixed to the top, translucent. Row one: the brand and the study tabs in a pill. Row two: links to the page's sections; the one in view is highlighted and the row scrolls sideways when it does not fit. A thin gradient line along the bottom edge shows how far the reader has scrolled.
- **Hero** (`div.hero`). An eyebrow with the study's number, a large title with one phrase in a gradient, a line of sources and dates, and the study cards. A canvas behind it draws slow decorative strands.
- **Summary tiles** (`div.hero-grid`). Four tiles; the first is wider and tinted. Figures count up from zero when they scroll into view and always end on the exact text the page script wrote.
- **Sections.** A heading with a short accent bar, a lede, then cards.
- **Chart card** (`div.card[data-chart]`). Title and subtitle, a "show table" button, the chart, a legend, the hidden data table, a footnote.
- **Period selector** (`div.season-bar`), where a page needs one. A pill with a segmented control that sticks under the header.
- **Prose card** (`div.card.prose`). Lists, notes and tables that are not charts.
- **Footer.** One line: when and how the data was generated.

Cards and tiles lift slightly on hover and show a soft highlight that follows the pointer. Headings, ledes, cards and tiles fade up as they enter the screen. A fixed, dimmed copy of the decorative strands fades in behind the whole page once the hero scrolls away.

## Colour tokens

All colours are CSS custom properties at the top of `styles.css`. Charts read them at draw time with `getComputedStyle`, so a chart never holds a hard-coded colour and the dark theme reaches the charts.

| Tokens | Use |
| --- | --- |
| `--page`, `--surface`, `--ink`, `--ink-2`, `--muted`, `--grid`, `--axis`, `--border` | Page, cards, three text strengths, chart grid and axes, hairlines. |
| `--s1` … `--s5` | Categorical data colours. One per entity, fixed. |
| `--seq-1` … `--seq-5` | A sequential ramp of one hue, for magnitude: the map, heatmaps. |
| `--ord-1` … `--ord-3` | An ordered ramp for ordered classes, such as grades. |
| `--past` | The comparison series: last period, the total behind the parts. Grey. |
| `--empty` | No data: map areas with nothing. |
| `--up`, `--down` | The sign of a change in a tile. |
| `--accent`, `--accent-2`, `--accent-3` | The interface: gradients, focus ring, active marks, the brand square. |
| `--glow-*`, `--bar`, `--chip*`, `--shadow*`, `--sheen`, `--dots`, `--fiber-*` | Background lights, the translucent header, pills, shadows, decoration strength. |

The dark values appear twice: once under `@media (prefers-color-scheme: dark)` and once under `:root[data-theme="dark"]`. Setting `data-theme="light"` or `"dark"` on `<html>` forces a theme. **Change a dark value in both blocks.**

You may keep the palette as it is; it does not say "wool". If you change it, change the three accents for identity and leave the data colours unless they clash. Check every pair in both themes.

## What to adapt

### In `ui.js`

| Where | What | Change to |
| --- | --- | --- |
| `ICONS` | Five 24 × 24 stroke icons, one per study. | Icons that fit your studies. Same style: `stroke="currentColor"`, width 1.6, no fill. |
| `STUDIES` | One entry per study: file, name, a one-line question, icon key, colour token. | Your pages, in order. The number shown on each card is its position. |
| The card template under `STUDIES` | The strings `"Estás acá"` ("you are here") and `"Abrir →"` ("open"). | The site's language. |
| `countUp` | It reads a tile's text back into a number, so it must know the locale's separators. It ships for `es-AR`: `.` for thousands, `,` for decimals. | See the locale section below. |
| `fibers` | The decorative strands. The `rizo` (crimp) term in the drawing loop is the wave along each strand that makes it read as wool. | See the decoration section below. |
| `placePadding` | Skips its work when an element with id `season-bar` exists, because the page script sets the scroll offset on such pages. | Nothing, as long as the period selector keeps that id. |

### In `styles.css`

| Where | What | Change to |
| --- | --- | --- |
| The `:root` blocks | The palette. | Optional. See above. |
| `.journey` | `repeat(5, …)` appears three times: the study cards assume five studies. | The number of studies you build. |
| `#tabla-supuestos` | A height for one table of the reference chain page. | Rename to your table's id, or delete. |

### In every HTML page

Listed at the end of [kit/page.html.md](kit/page.html.md).

### In every page script

| Where | What | Change to |
| --- | --- | --- |
| `num`, `longDate` | The locale `"es-AR"`. | The site's locale. |
| `tons`, `usdM`, `perKg` | Unit formatters. | Your units and currency. |
| `buildCard` | The button labels `"Show table"` and `"Hide table"`. | The site's language. |
| Everything marked `EXAMPLE` | Example entities, charts, tiles and texts. | The page's own. |

### Locale

The number format appears in three places that must agree: `num` and `longDate` in each page script, and `countUp` in `ui.js`. If they disagree, tiles animate through wrong values. For example, the shipped `es-AR` pattern reads the en-US text `4,488` as 4.488.

For a locale with `,` for thousands and `.` for decimals, such as `en-US`, replace these four lines of `countUp`:

```js
const m = final.match(/^(\s*)(\d{1,3}(?:,\d{3})*(?:\.\d+)?)(\s*)$/);
const decimals = (m[2].split(".")[1] || "").length;
const target = Number(m[2].replace(/,/g, ""));
const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
```

The four lines are not adjacent in the file: leave the lines between them as they are. For any other locale, write the same four lines for its separators and check three tiles by hand: one with thousands, one with decimals, one with both. Each must count up through sensible values and stop on the exact original text.

Month and period labels are made by the pipeline, in the site's language, and arrive in the data bundle.

### Decoration

The strands are decoration only. They follow a slow flow field, take their colours from the tokens, bend away from the pointer, and represent no data. You have three honest options: keep them as abstract lines, redraw the motif for your industry, or remove the canvas. Whatever you choose, keep the contract:

- `aria-hidden="true"` on the canvas, and no information in it.
- One static frame when the system asks for reduced motion.
- Paused when off screen or when the tab is hidden.
- Dimmed behind the reading column, and dimmer on phones.

## The chart-card contract

Each chart is one entry in the page script's `SPECS` object. Its key is the `data-chart` id in the HTML.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | What the chart shows. Also its accessible name. |
| `sub` | function → string | Unit and scope: "Tons, 2026 to April". |
| `legend` | function → list of `{label, color, line?, series?}` | The legend under the chart. `line: true` draws a line swatch. `series: "<name>"` makes the entry a button that shows and hides that series. |
| `foot` | string or function → string | Source table and what to watch for. Hidden when empty. |
| `height` | `"short"`, `"tall"`, `"map"` or absent | 280, 520, 460 or 340 pixels. |
| `seasonal` | true or absent | Redrawn when the reader picks another period. |
| `option` | function → ECharts option | Built from the helpers below. |
| `table` | function → `{head: [...], rows: [[...]]}` | The same data as text. Required for every chart. |

How it runs: `buildCard` writes the card's inner markup once. `render(id)` fills subtitle, footnote and legend, creates the chart on first use, and sets its option, replacing the previous one. `renderAll` re-reads the colour tokens and renders everything; it runs at start and whenever the system theme changes. A resize handler resizes every chart. With reduced motion on, `render` turns the chart's animation off.

For a legend entry to toggle a series, the option must also declare a hidden ECharts legend that names the series: `legend: { show: false, data: [names] }`.

Helpers in the kit, all reading colours from the tokens:

| Helper | Gives |
| --- | --- |
| `num(v, decimals)` | A number in the site's locale; `–` for missing. |
| `pct`, `signed`, `tons`, `usdM`, `perKg` | Shares, signed changes and unit formats built on `num`. |
| `esc(s)` | HTML-escaped text. Use it on every data string that goes into markup. |
| `base()` | Font, margins and tooltip style common to every chart. |
| `axisCat(labels, extra)`, `axisVal(format, extra)` | A category axis and a value axis in the house style. |
| `barStyle(color, roundedEnd, horizontal)` | A bar fill with a hairline in the card colour between segments. |
| `stacked(keys, rows, get, horizontal)` | Data for stacked bars; only the last segment present in each bar is rounded; missing values become gaps. |
| `totalLabel(stack, n, format)` | An invisible last series that prints each bar's total at its tip. |
| `lineSeries(name, data, color, extra)` | A line with round joins and dots ringed in the card colour. |
| `swatch(color, line)` | A colour mark for tooltips. |
| `inkOn(hex)` | White or near-black, whichever reads on that fill. |

## Chart rules

- **Colour follows the entity, never the rank.** Each entity has one slot for the whole site. A product that is blue on page one is blue on page five.
- **One colour for "now", grey for comparison.** The current period takes `--s1`; earlier periods and totals-behind-the-parts take `--past`.
- **Provisional figures are the same colour at 40% opacity**, and the footnote says so.
- **Ramps for order.** Magnitude uses the sequential ramp. Ordered classes use the ordered ramp. Categorical colours are for categories only.
- **Label directly where there is room.** Names at the ends of lines, totals at the tips of bars. The legend is HTML under the chart, not the chart library's.
- **Tooltips carry units.** A bold header, then one line per series: swatch, name, bold value with its unit.
- **Small categories are grouped**, as "Others (n)", with n stated. The table lists them all.
- **Every chart has its table.** The button under the title opens it. The table is the accessible version and the copyable one.
- **Missing is a gap**, not a zero and not an interpolated line.
- **A title says what; a subtitle says in what unit and for when; a footnote says from where and what to watch for.**

Which form for which data:

| Data | Form |
| --- | --- |
| Quantity per month or period, split by entity | Vertical stacked bars |
| Price over time | Lines: one grey for the total, one per entity switched from the legend |
| This period against the last, cumulative | Lines by month; current in colour, past in grey, named at the line's end |
| Destinations or origins | Horizontal stacked bars, largest on top, the tail grouped |
| Geography | World map shaded on the sequential ramp, with flow lines from the place |
| Shares over time | Bars stacked to 100%, or lines |
| Month by period | Heatmap on the sequential ramp |
| A value built up stage by stage | Waterfall |
| Scenarios | One horizontal stacked bar per scenario |
| One figure's recent path, inside a tile | Sparkline with the last point marked |

A waterfall is a stacked bar chart whose first series is transparent and silent: its value lifts each bar to where the previous one ended.

The map needs two tables. In the parser: each country name as the source prints it → the name in the map file; an unknown country stops the build. In the page script: country → `[longitude, latitude]` for the end of its flow line. The code is in [kit/chart-excerpts.md](kit/chart-excerpts.md).

## Accessibility and small screens

The first, second and fourth of these were defects in the reference site before they were rules.

- **Reduced motion.** The stylesheet stops transitions and the reveal; `ui.js` skips the count-up and draws one static frame of the decoration; each page script turns chart animation off. All four, not only the stylesheet.
- **Keyboard.** A period selector is a radio group: one tab stop, arrow keys move the choice, Home and End jump to the ends. After the selector redraws itself, focus returns to the chosen button; otherwise the keyboard user is thrown to the top of the page.
- **State on controls.** The table button carries `aria-expanded`. Legend toggles carry `aria-pressed`. Charts carry `role="img"` and their title as label.
- **Phone width.** At 375 pixels nothing scrolls sideways except rows meant to. One long unbroken string, such as a URL in a note, is enough to widen the whole page; let it wrap.
- **Narrow layouts.** Below 860 pixels the header tabs hide and the compact study cards take their place; paired cards stack. Tiles go to two columns below 960 and one below 520.
- **Dark theme.** Follows the system. Charts redraw with the new tokens when it changes.

Check every page at desktop width and at 375 pixels, in light and in dark, with reduced motion on and off, and once with the keyboard alone.
