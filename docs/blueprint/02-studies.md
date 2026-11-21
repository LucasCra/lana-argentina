# 02 · The five studies

Each study is one page that answers one question. The pages go from the plain numbers to the argument: the first two report, the third and fourth explain, the fifth concludes. A reader can enter at any page; the header tabs show where they are, and the first page carries one card per study under its title.

Words used below: the **place** is the country or region; the **material** is what the industry produces; a **stage** is one step of the processing ladder; an **entity** is one of the products the main source splits its totals by; a **period** is the year or season the source closes its books on. The **main source** is the brief's role A, with role B when B is its long-run edition. The **export stage** is the most processed stage the place sells abroad at scale. A **band** is a range of the grade scale.

## What every page has

1. **Header.** Site name, five tabs (one per study), and a second row with links to the page's own sections.
2. **Hero.** The study's number and name, a title with the key phrase highlighted, one line generated from the data that says which sources and dates the page covers, and the study cards. The cards show in full on the first page; on the others they appear only on narrow screens, where the header tabs are hidden.
3. **Summary.** Four tiles. The first is the headline answer to the page's question and is larger. Each tile carries a line of comparison or context under its figure. Under the tiles, one note says what the comparison is and which figures are provisional.
4. **Sections.** Each has a heading, a lede of one to three sentences that states what the charts show and the main caveat, and one to four chart cards. Every chart card has a title, a subtitle with unit and scope, a button that opens the data table, and a footnote with the source and what to watch for.
5. **Sources and method**, always the last section: what the site computes itself, what it refuses to use from the source, how to read the units, and the list of files used with links to the stored copy and to the publisher.
6. **Footer.** The date the data was generated and how.

Ledes and tile text that contain figures are written by the page script from the data bundle, so they cannot go stale when the data updates.

## Study 1 · Now

**Question.** How much is moving in the current period, at what price, and to where?

**Source.** Role A, the current periodic source.

| Section | What it shows |
| --- | --- |
| Summary | Implied price for the period to date against the same months of the previous period, with a sparkline. Quantity. Revenue. Leading destination and its share. |
| Month by month | Quantity per month, stacked by entity. Implied price per month, with one line per entity that the legend switches on and off. Revenue per month. |
| Period against period | Cumulative quantity and revenue, current period against the previous one, month by month. The same months compared by entity. |
| Destinations | A world map with flow lines from the place. Destinations by entity as horizontal stacked bars, with small ones grouped as "Others (n)". The share of each destination from one report to the next. |
| Price and quality | Implied price by entity. Grade mix by entity. The profile across the grade scale. |
| Supply balance | What was available and where it went. How the remaining stock falls through the period. |
| Exit points | Quantity by port or region of exit. |
| Revisions, sources, method | Months the publisher revised, with every version. Reports used. How to read the numbers. |

A period selector sits above the sections that show a period-to-date total. It stays fixed under the header while the reader scrolls those sections.

Three things this page must get right:

- **Latest version wins, and revisions are shown.** Each month comes from the latest report that prints it. Earlier versions are kept and listed.
- **Recent months are provisional.** If the publisher revises, flag the most recent months, draw them faded, and say in the summary note which way revisions usually go.
- **Only like-for-like comparisons.** A partial period is compared with the same months of the previous period, never with a full one.

> **Wool example.** The federation revised July 2026 from 1,587 t to 2,019 t three reports later, so the two latest months are marked "p" and drawn at 40% opacity. June 2026 carries a once-a-year adjustment for exporters outside the federation (5,329 t, 20% of the season, mostly greasy wool); the page marks that month on every chart and says its low price is a change of mix, not of market.

## Study 2 · History

**Question.** How did the industry get here, period by period?

**Source.** Role B, the long-run source.

| Section | What it shows |
| --- | --- |
| Summary | Quantity in the latest closed period, with the series maximum and the first period. Revenue with its maximum. Production. Leading destination. |
| Exports by period | Quantity by entity. Revenue. Implied price by entity. |
| Destinations | Share of the main destinations over time. |
| Quality | Share of the top grade. Average grade. |
| Production and balance | Production by grade. Production as estimated at the close of each period against the revised series. Exported, used locally and carried over. |
| Seasonality | A heatmap of quantity by month and period, from the long-run source's monthly tables or from the archive of role A. A second seasonal or regional cut if the source has one. |
| What each report holds, sources, method | A table of which series exist for which periods. Disagreements between tables of the same report. Reports used. |

What this page must get right:

- **Method breaks are kept apart.** When the publisher changed a definition, the series before and after are not joined. Each period carries a flag that says which method it uses, and the charts mark the break.
- **Coverage is stated.** Old reports hold less. The availability table says, series by series, which periods have it.
- **Source errors are shown, not hidden.** When two tables of one old report disagree, the build passes it as a warning and the page lists it.
- **Periods are consecutive.** A missing period stops the build, because a gap would silently join its neighbours on every chart.
- **One consolidated file is fine.** If the long-run source is a single file covering every period, the availability table gives the first period of each series instead.

> **Wool example.** Twenty-eight annual reports, 1998/99 to 2025/26. Until 2004/05 the federation reported destinations in shipped weight and split fineness into five classes; from 2005/06 it uses clean weight and three. The fine-wool cut-off moved from 24.9 to 24.5 microns at the same time, so the fine share is the only fineness series drawn across all seasons, with the old era shaded and the two cut-offs in the footnote.

## Study 3 · Industry

**Question.** What does the place make with its own material?

**Sources.** Role B for the stages the main source covers; role C for the later stages; role E for who operates them.

| Section | What it shows |
| --- | --- |
| Summary | Local industrial use. Exports of manufactured stages. Imports of manufactured goods. The price premium of the first processing stage over raw. |
| How far it is processed | The share of exports leaving at each stage, over time. Quantity leaving processed. Manufactured exports. |
| Local industrial use | Quantity used by local industry. Which grades it uses. |
| What each stage is worth | A price ladder: money per unit at every stage from raw to finished. The premium the first processing stage pays, over time. |
| Trade in manufactured goods | Imports by stage in money and in quantity. Exports by stage. Origins of imports. |
| Who processes | Prose with sources and dates, stage by stage. Items not re-read at the original are listed apart and labelled. |
| Sources and method | A control chart: the same flow according to the main source, the place's customs reports and its buyers' customs reports. In money when the sources weigh on different bases. Two series instead of three when the main source is itself built from the place's customs records. |

What this page must get right:

- **Choose a source per series, and show why.** Where the two sources overlap, draw them together. Use each one only for what it measures well.
- **A missing column is not a zero.** A report without a column for a stage says nothing about that stage.
- **Estimates are flagged.** A figure that repeats exactly, or sits on the same round number for years, is an estimate, not a trend.
- **Different bases stay apart.** Calendar years and seasons, net weight and the main source's basis: side by side, never summed.

> **Wool example.** The place's own customs reports for combed wool fall below both the federation and the buyers from 2018 on. So raw and combed wool stay on the federation's figures, customs data is used only for yarn, fabric and garments, and a control chart shows the three series. The federation's local-use figure is 2,000 t in ten of eleven seasons; the page marks it as a round estimate.

## Study 4 · The chain of one product

**Question.** From the place's export stage to a shop shelf: what does each stage add, and how much of that is cost and how much profit?

**Sources.** Role D, plus the export price from role A.

| Section | What it shows |
| --- | --- |
| Summary | A framing line above the tiles, if the case is hypothetical. Then four tiles that split the shelf price: the place's material, with its range; the factory stages, with their range; freight and duty; brand and shop, with the range of the brand's profit. |
| What each stage adds | A waterfall from the material's price to the shelf price. The value of one unit of material at each stage. |
| Cost and profit per stage | A table: what each stage buys, sells, adds, and how the addition splits into cost and profit. |
| How much material one product takes | A mass balance: what each stage buys to make one unit, with the losses. |
| What changes if an assumption changes | One bar per scenario, showing where the shelf price goes. |
| Reference margins | Listed companies per stage, gross and operating margin, source, and whether the figure was re-read at the original. |
| Assumptions, sources, method | Every input: value, unit, type, source, date, re-read or not. How the account is built. What the account leaves out. |

What this page must get right:

- **Every input lives in one file** with its source, type and range. The build stops if an input that is not declared an assumption lacks a source, or if one leaves its range. See [03-pipeline.md](03-pipeline.md).
- **The account closes.** Each stage buys what the previous one sold, and the additions sum to the shelf price. Tests check both.
- **Ranges reach the tiles.** A figure that rests on a weak input shows its range next to the figure, not only in the table at the bottom.
- **Proxies are named as proxies.** A listed company's margin is that company's, across everything it sells. Say so beside the number.
- **The page says what it could not find.** No independent study to compare with, no price list after a date, an input read from one advertisement: each is printed.

> **Wool example.** One merino T-shirt at 95 dollars. The brand names a New Zealand wool company as its partner and no country of origin for the wool, so the first line of the page says the account is hypothetical: it prices the shirt as if it were made from Argentine combed wool at its export price. Scenarios: this season's wool price, finer wool at the Australian price, a cheap and an expensive factory, the lightest and heaviest published shirt weight, minimum and maximum losses, the duty without its surcharge, and the same shirt made in China.

## Study 5 · Opportunities

**Question.** Where could the place keep more of the value of its material?

**Sources.** No new ones. It joins the other four and loads their data bundles.

| Section | What it shows |
| --- | --- |
| Summary | Tiles: how much of the product's shelf price stays in the place; of the material the product can use, the share that leaves unprocessed; the share local industry uses; what buyers' customs reports show arriving from the place at the next stage. Then a findings card: five findings, each one sentence in bold and one of evidence. Then a card that says what the page is and what it leaves out. |
| 1. The size of the chain | Production, exports and local use over time. |
| 2. How far the place processes | The stage at which the material leaves. |
| 3. Which material leaves unprocessed | Quantity by grade band and stage, with a period selector. |
| 4. Where a product's value is | The share of the shelf price that stays in the place if the product leaves at each stage. What each step adds per unit of the export product. |
| 5. Link by link | One card per step the place does not do, or does only in small volume: how much material could take it, what it adds per unit, how much of that is profit, what exists today. A table of who does the next stage with the place's material. |
| 6. Opportunity map | One table, nearest step to farthest: what it would take, volume base, adds per unit, profit per unit, ceiling, reference margin, what exists today, and the kind of data behind the row (measured, declared by buyers, or modelled). |
| 7. Questions for the next stage | What the page cannot answer, grouped by step. |
| Method and limits | Bases, bands, how value added and ceilings are computed, what is left out. |

What this page must get right:

- **It stays inside the chain.** How much, where, at what price. Trade policy, taxes, rules and buyers' preferences are the why, and the why goes to section 7 as questions. They are never used as explanations.
- **Ceilings are ceilings.** "Every unit of that band takes that one step, at this product's prices" is a maximum. The word *ceiling* and the sentence "a maximum, not a projection" sit next to the number.
- **The volume base matches the price.** If the step's value comes from one product, the volume is only the material that product can use.
- **Findings carry their caveat.** A finding from a period that sold stock, or that includes a one-off, says so in the same sentence.
- **It is fact-checked by someone who did not write it.** This page makes the strongest claims on the weakest joins. See [04-evidence.md](04-evidence.md).

> **Wool example.** Steps: comb more of the wool that leaves greasy, spin, knit and finish, cut and sew, sell under a brand. The volume base is wool up to 18.9 microns, the fineness a next-to-skin shirt uses, because the later steps are priced from that shirt. Combing was first sized on a price gap of 3.31 dollars per kilo; without the month of the annual adjustment it is 2.08, and the page uses that.

## When the industry has no equivalent

Decide these in the brief. Whatever you drop, say so on the first page.

| The industry lacks | Do this |
| --- | --- |
| A current source (only annual data) | Merge study 1 into study 2. The first page becomes "latest closed period", without month-by-month charts, revisions or provisional flags. |
| A long series | Keep study 2 with the periods that exist and say how many. Under five periods, merge it into study 1 as one section. |
| Destinations (a domestic industry) | Drop the destination sections and the map. Use regions inside the place if the source has them. |
| A grade scale | Drop the quality sections. In study 5, section 3 splits by entity instead of by grade. |
| A supply balance (the source prints none) | Drop the balance sections. Do not assemble one from parts. Study 5 section 1 shows only what is counted. |
| Exit points | Drop that section. |
| Monthly data in the long run | Drop the seasonality section of study 2. |
| A single route (parallel routes lead to the same product) | Keep one ladder per route in the pipeline. Charts by stage show the routes as separate entities where they differ. |
| By-products that matter | Show them in a section of their own in study 3. Keep them out of every total of the material. |
| A second source | Study 3 keeps only what the main source covers, and has no control chart. Say that nothing checks the main source. |
| A processing ladder (the product is sold as produced) | Drop study 3. Study 5 becomes "where the price goes" and leans on study 4. |
| A retail product with a public price | Drop study 4. Study 5 keeps sections 1 to 3 and the questions; it has no map, because nothing prices the later steps. |
| Physical units (a service) | The model fits poorly. Replace quantity with the unit the industry bills in, stages with the steps between producer and final buyer, and expect to drop studies 3 and 5. Tell the human before building. |

With fewer than five studies, the header tabs, the study cards and their numbering shrink to match, and the first study you build becomes `index.html`. [05-shell.md](05-shell.md) lists the places to change.
