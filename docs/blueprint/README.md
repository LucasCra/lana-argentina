# Industry site blueprint

A set of documents that tells a coding agent how to build a research site about one industry in one place. The site answers five questions, one page each: where the industry stands now, how it got here, how far the place processes its own raw material, what one product's value chain looks like, and where more value could be kept.

The blueprint was extracted from a working site about Argentine wool, at commit `0440132` of that site's repository. That site is the reference. Nothing here depends on wool: every wool detail sits either in a block marked **Wool example** or, in the kit's code, at a point listed in [05-shell.md](05-shell.md). The builder replaces both.

The set is self-contained. An agent that has only this folder can build the site. It does not need the wool repository.

## What the result is

- Five static pages that open from `file://` with no server and no network.
- A Python pipeline that reads raw source files, checks every table against its own totals, and writes one data bundle per page. The build stops when a source does not add up.
- Every number on a page is computed from stored raw files or from a listed assumption with a source. Gaps and caveats are printed where the reader looks.
- One look across the five pages: shared header, hero, summary tiles, chart cards with a data table behind each chart, light and dark themes.

## Reading order

| File | What it holds | When the agent reads it |
| --- | --- | --- |
| [01-brief.md](01-brief.md) | The brief to fill in: sources, units, stages, the product. Ends in the one human checkpoint. | First. Nothing is built before it is confirmed. |
| [02-studies.md](02-studies.md) | The five studies: question, sections, tiles and charts of each, and what to do when the industry has no equivalent. | While filling the brief, then again per study. |
| [03-pipeline.md](03-pipeline.md) | Repository layout, the parse → derive → bundle flow, what a parser must guarantee, the assumptions file, tests. | Before writing any Python. |
| [04-evidence.md](04-evidence.md) | The rules that keep the site true, each with the mistake that produced it. Includes the fact-check prompt. | Before writing any page text, and at every fact-check. |
| [05-shell.md](05-shell.md) | The interface: tokens, components, behaviours, the chart-card contract, accessibility. Lists every point to adapt. | Before writing any HTML, CSS or page script. |
| [06-build-order.md](06-build-order.md) | The order of work, a prompt per step, and the acceptance checklist. | After the brief is confirmed. It drives the rest. |
| [kit/styles.css.md](kit/styles.css.md) | The stylesheet, verbatim. | Copy it. |
| [kit/ui.js.md](kit/ui.js.md) | The shared interface script, verbatim. | Copy it, then edit the adaptation points. |
| [kit/page.html.md](kit/page.html.md) | A page skeleton with placeholders. | Copy it once per page. |
| [kit/page.js.md](kit/page.js.md) | A runnable page script with two example charts, tiles and a period selector. | Copy it once per page and replace the example charts. |
| [kit/chart-excerpts.md](kit/chart-excerpts.md) | The world map with flow lines and the sparkline in a tile, as the reference site draws them. | Read it when a page needs either. |

## Kickoff prompt

Give the agent this folder and paste the prompt below with the four fields filled in.

```text
Build a research site about the industry below, following the blueprint in this folder.

Industry: <the industry, e.g. "copper", "soybeans", "wine", "lithium">
Place: <the country or region>
Site language and number format: <e.g. "English, en-US" or "Spanish, es-AR">
Reader: <who reads the site and what they want to understand>

Start with README.md and 01-brief.md. Fill in the brief with sources you have actually
downloaded. Then stop and show me the filled brief before you write any pipeline or page.

After I confirm the brief, follow 06-build-order.md: the shell first, then one study per
commit, with a fact-check before each study counts as done.

The rules in 04-evidence.md are not optional. When the data does not support a claim, the
claim goes. When a source cannot be found, say so; never fill the gap from memory.
```

## What the agent needs

- A shell, with Python 3.12 or later and `uv`, and the freedom to add the Python libraries that read the sources' formats (PDF tables, spreadsheets, HTML).
- File read and write in a new, empty repository.
- Web access to find and download the sources.
- A browser it can drive, to check each page at desktop and phone widths, in light and dark.
- For the fact-check, a second agent or session that did not write the page.

## The one human checkpoint

The agent stops once, after the brief. The brief decides everything that is expensive to change later: which sources carry the site, which units and periods it uses, which stages the industry has, and which product the chain page follows. Read it, correct it, confirm it.

After that the agent works through to the end without asking, and reports per study what it built, what it checked and what it could not find. A source that turns out to be missing after the checkpoint does not stop the work: the agent builds what the data supports, says on the page what is missing, and reports it. It stops again only if a study loses its main source.

## Where the blueprint came from

The reference site was built in this order: the current-period page, then history, industry, chain and opportunities, and the shared look last. Three of those pages needed a correcting commit after a fact-check. The blueprint reorders the work (shell first) and turns each correction into a rule in [04-evidence.md](04-evidence.md), so a new build does not repeat them.

The files in `kit/` are copies of the reference code at the commit named above. If the reference site changes, the kit does not follow by itself.
