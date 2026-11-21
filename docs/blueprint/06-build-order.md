# 06 · Build order and acceptance

Work in this order. Each step ends in a commit and a short report. Do not start a study before the one above it passes its gate.

The reference site was built data first and given its shared look last, which meant restyling five finished pages. Build the shell first.

## Step 0 · The brief

Fill in `docs/brief.md` as [01-brief.md](01-brief.md) says. Stop. Wait for the human to confirm.

## Step 1 · Skeleton and shell

1. Create the repository layout from [03-pipeline.md](03-pipeline.md): `pyproject.toml`, an empty `pipeline/`, `tests/`, `data/raw/`, `site/vendor/`, `.gitignore`.
2. Download the chart library into `site/vendor/` and commit it.
3. Copy the four kit files into `site/`. Run the example page exactly as shipped. It must show four tiles, two charts and a period selector, with no error in the browser console.
4. Adapt `ui.js` and `styles.css`: studies, icons, strings, locale, brand glyph, number of studies. The list is in [05-shell.md](05-shell.md).
5. Create one HTML file per study from the skeleton, each with its title, eyebrow, tabs and an empty `<main>`. Every tab and every study card must link to a page that exists.
6. Write `build.py` with the bundle writer and no sources yet.
7. Check the example page at desktop width and at 375 pixels, in light and dark, with reduced motion on, and with the keyboard alone.

**Gate.** Five linked pages with the final header, hero and study cards. The example charts still run on the first page. Commit.

## Steps 2 to 6 · One study at a time

In order: now, history, industry, chain, opportunities. Skip the studies the brief dropped. For each one, run this loop.

1. **Store the sources.** Write or extend `fetch.py`. Download every file the study needs into `data/raw/`, with its URL in `sources.json`.
2. **Parse and check.** Write the parser with its guarantees and its checks against printed totals. Run it on every stored file. When a file fails, read the file: either the parser is wrong, or the source is, and the second is a finding to show on the page.
3. **Test on the real files.** Known values copied by hand, one test per layout quirk, the failure cases.
4. **Derive.** Write the derive step. Put every decision in it and say each one in its docstring. Add its bundle to `build.py`.
5. **Draw.** Replace the page's example charts with the study's sections from [02-studies.md](02-studies.md). Texts that quote figures are built from the bundle.
6. **Review your own page against [04-evidence.md](04-evidence.md)**, rule by rule.
7. **Fact-check.** Hand the page to a separate agent or session with the prompt in [04-evidence.md](04-evidence.md). Fix everything it finds that is not supported.
8. **Check in the browser**: desktop and 375 pixels, light and dark, console clean, every table opens.
9. **Commit**, with a message that says what the study answers and what the sources could not give. If the fact-check changed claims, say which.

A prompt for one study, if you run each as its own task:

```text
Build study <N> (<name>) of the site, following docs 02 to 06 of the blueprint and the
confirmed brief in docs/brief.md.

Sources for this study: <roles and files from the brief>.

Do steps 1 to 9 of the study loop in 06-build-order.md. Stop the build on any table that
does not add up and tell me which. Before you report, run the independent fact-check and
fix what it finds.

Report: what the page answers, the checks you ran and their results, each thing the
sources could not give and how the page says so, and what the fact-check changed.
```

### Extra steps for the chain study

Before step 2 of the loop:

1. **Choose the product** named in the brief and read its page yourself. Record price, composition, origin and date, each with the exact line quoted.
2. **Research the inputs** the chain needs: weight, losses per stage, intermediate prices, a published cost breakdown, duty and freight, listed companies' margins. Every figure goes into the assumptions file with source, URL, date and `reread: false`.
3. **Re-read at the original** every input that moves the result: open the URL, find the figure, confirm the date. Set `reread: true` only then. Fix or delete what does not hold.
4. **Find out whether the product really uses the place's material.** If not, or if unknown, the first line of the page says the account is hypothetical.

A prompt for the research pass:

```text
Find published figures for the value chain of <product>, made from <material>.

For each of these, give the figure, its unit, the exact sentence it comes from, the URL
and the date of the source: <list: weight, loss at each stage, price of each intermediate
good, a per-unit cost breakdown from any maker, duty rate and its legal basis, freight,
gross and operating margins of listed companies at each stage>.

Give a figure only if you saw it on the page. If you found nothing for an item, say so
and say where you looked. Do not estimate.
```

### Extra steps for the opportunities study

- It reads the other studies' bundles. Add only the arithmetic that joins them, in its own derive step.
- Write the findings card last, from the sections below it.
- Run the fact-check twice, with two separate reviewers. This page's claims are joins of joins.

## Step 7 · The whole site

Go through the acceptance list below on all pages together. Then write the project's own `README.md`: what the site is, how to open it, how to update it when a new file is published, where each kind of thing lives, how to run the checks.

## Step 8 · Publish

Only if the human asked. See the end of [03-pipeline.md](03-pipeline.md).

## Acceptance checklist

### Data

- [ ] Every figure on every page traces to a file under `data/raw/` or to an entry in the assumptions file.
- [ ] `sources.json` has a URL for every stored file.
- [ ] `build.py` exits with an error, and writes nothing, when one stored file is altered so a total no longer adds up. (Try it on a copy.)
- [ ] The test suite passes. It includes real-file tests, known values and failure cases.
- [ ] The linter passes.
- [ ] No printed share or average from a source is used anywhere.
- [ ] A blank in a source appears as a gap or an empty cell on the site, never as 0.

### Pages

- [ ] Each page states its sources and dates in the hero line and lists its files in the last section, with a link to the stored copy and to the publisher.
- [ ] Each chart has a title, a subtitle with unit and scope, a table and, where needed, a footnote.
- [ ] Each chart's axis, tooltip and table say the unit and the basis.
- [ ] Provisional, estimated and one-off figures are marked on the chart and explained under it.
- [ ] Every comparison is between equal periods.
- [ ] Every ceiling is called a ceiling and says what it assumes.
- [ ] Ranges sit beside the figures they qualify.
- [ ] Every assumption shows its type, source, date and whether it was re-read.
- [ ] The opportunities page explains nothing by policy, taxes or preferences; those are listed as questions.
- [ ] Each research page passed an independent fact-check, and its findings were fixed.
- [ ] Dropped studies and missing sources are named on the first page.

### Interface

- [ ] The site opens from `file://` with the network off.
- [ ] No console errors on any page.
- [ ] Header tabs, study cards and section links all lead somewhere, on every page.
- [ ] An entity has the same colour on every page.
- [ ] Light and dark both read well; charts follow the theme.
- [ ] At 375 pixels no page scrolls sideways.
- [ ] With reduced motion on, nothing animates, charts included.
- [ ] The period selector works with arrow keys and keeps focus.
- [ ] Tile figures end on exactly the text the page script wrote.
- [ ] Numbers use the site's locale everywhere.

### Repository

- [ ] One commit per study, each message saying why.
- [ ] Raw files, vendored files and data bundles are committed; `data/processed/` is not.
- [ ] The README says how to update the site when the publisher issues a new file.

## The report at the end

For each study: the question it answers, the sources it stands on, the checks that ran and what they said, what the sources could not give and where the page says so, and what the fact-check changed. Then one list for the whole site: studies dropped and why, inputs not re-read at the original, and anything a human should look at before trusting the site.
