# 01 · The brief

The brief is one file, `docs/brief.md` in the new repository. You fill it in before any code exists. It names the sources, fixes the vocabulary, and says which of the five studies this industry can carry. The human confirms it. Then you build.

At this step you create the new repository, and it holds two things only: `docs/brief.md`, and `data/raw/` with one folder per source, each with its sample files and a `sources.json` that maps each file name to its URL and fetch date. Commit both when the brief is ready. Step 1 builds the rest of the layout around them.

The blueprint itself can stay outside the new repository or be copied into its `docs/blueprint/`. The built site never refers to it.

## What the model needs from an industry

The five studies assume four things. Check each one before anything else, and write the result at the top of the brief under "Model check".

1. **A physical flow someone counts.** Tons, litres, units, megawatt-hours: a quantity and a value, published per period by a body that collects it.
2. **A processing ladder.** The raw material passes through stages, and each stage sells a different product at a different price per unit.
3. **Trade past the border.** Later stages show up in customs data under their own product codes, in this place and in the places that buy from it.
4. **A product a person can buy.** One finished item with a public shelf price, made from this material.

An industry that lacks one of these can still get a site. [02-studies.md](02-studies.md) says which study or section to drop or merge in each case. Decide it here, in the brief, and not halfway through the build.

> **Wool example.** Flow: clean tons and dollars of wool exported, published monthly by the Argentine wool federation (FLA). Ladder: greasy → scoured → combed tops → yarn → fabric → garment. Trade: UN Comtrade, HS chapter 51 and the wool garment codes. Product: one merino T-shirt at 95 dollars.

## The five source roles

Every site stands on up to five kinds of source. Find a real one for each role, download a sample, and open it before you write its name in the brief.

| Role | What it is | Feeds |
| --- | --- | --- |
| **A. Current periodic source** | The bulletin or dataset that reports the latest months or quarters. Often revised after publication. | Study 1 |
| **B. Long-run source** | Closed periods going back as far as they are published. Often the annual edition of A, or A's own archive. | Studies 2 and 3 |
| **C. Independent second source** | A different body counting the same flow or the next stages. Customs data is the usual one, read from both sides: what the place reports, and what its buyers report (mirror data). | Study 3, and a control on A and B |
| **D. One retail product** | The product page, a published cost breakdown if one exists, price lists for intermediate goods, tariff schedules, listed companies' margins. | Study 4 |
| **E. Qualitative sources** | Sector bodies, press, public research, company filings: who operates at each stage today. | Studies 3 and 5 |

**The main source**, in all the documents, means role A together with role B when B is A's long-run edition.

Rules for all of them:

- **Download, then cite.** A source enters the brief only after its file is on disk under `data/raw/` with its URL recorded in that folder's `sources.json`. [03-pipeline.md](03-pipeline.md), "Raw files are evidence", has the details.
- **For role A, store three issues:** the two latest and one from a year earlier. One file cannot show whether the publisher revises earlier months, or how late it publishes.
- **A web page is a source too.** Save its HTML. If a figure you read on screen is not in the saved file, as with shop prices filled in by a script, write what you read, when and how in a text file beside it.
- **Read the method notes.** Find where the source defines its units, its period, its revisions and what it leaves out. Quote those lines in the brief. If the source prints no such line, write "none printed".
- **Do not fill from memory.** A missing role changes the plan; an invented one ruins the site. Every source in the brief is in one of four states, and you write which: *downloaded* (with its path), *located, not downloaded* (URL and why), *not found* (what you tried), or *not searched yet* (only where this page allows it).
- **Prefer the publisher's own file** over a copy, an aggregator or a news summary. Role C is the exception: a database that republishes each country's own customs reports unchanged, such as UN Comtrade, is the normal way to reach them.
- **Find product codes in the data, not in memory.** Query the chapter at a coarse level, read the descriptions that come back, and list the codes whose descriptions match each stage.
- **Check how independent role C is.** If the main source is itself compiled from the place's customs records, the place's side of the customs data repeats it. Only the buyers' side is independent. Say so in the brief.
- **Role D needs little at this step:** the product page, read and stored, and whether a published cost breakdown exists. Tariffs, freight, intermediate prices and company margins are researched in the chain study ([06-build-order.md](06-build-order.md)); mark them *not searched yet*.

### Choosing the product

Pick one product that:

- is made mostly of this material;
- has a page that prints its price, its composition, its weight or size, and where it is made;
- comes from a stage the place already has, or the nearest one it could add.

If no product meets all three, take the closest and say which condition fails. Whether the product is really made from this place's material is a separate question, and "no" or "unknown" is an acceptable answer: the chain page then says its account is hypothetical.

## The vocabulary to pin

These choices appear on every chart. Fix them once, in the site's language.

- **Quantity unit and basis.** If the industry counts the same material on two bases (gross and net, as produced and as contained), name both and say which one each table of each source uses. Two bases never add. **Name the one basis on which prices per unit are computed**, and use it in every study: money divided by gross weight and money divided by contained weight are different prices. Where two sources weigh on different bases, compare them in money, or state the conversion and its source.
- **Money.** Currency, and whether values are at the border of the seller (FOB) or the buyer (CIF).
- **Period.** Calendar year, fiscal year or a season. If source A and source C use different periods, say so; the site keeps them apart.
- **Entities.** The products or categories the main source splits its totals by, in a fixed order. Up to five get a fixed colour each. With more, take the grouping the source itself prints, or the largest four and "Others". If roles A and B split their totals differently, list both sets and say which study uses which.
- **Stages.** The processing ladder, in order, with the name each source gives each stage and the customs codes that match it. Name which stage counts as *raw*, which is the *first processing stage* (the one whose premium over raw the site tracks), and the *export stage*: the most processed stage the place sells abroad at scale, where the chain study starts. If the industry has parallel routes to the same product, list each route.
- **By-products.** Listed apart. They stay out of the material's totals.
- **Grades.** A quality scale, if the industry has one that moves the price.
- **Destinations and exit points.** How the source names countries, and whether it reports ports or regions.
- **Marks that are not numbers.** What the source prints for "not available", "not applicable", "less than" and the like.

> **Wool example.** Two bases: clean tons (what wool yields once washed) and greasy tons (as shorn). Export tables are clean and prices are per clean kilo; the supply balance is greasy. Period: a season from July to June, while customs data runs on calendar years. Entities: greasy, tops, noils, scoured, by-products. Raw is greasy wool; the premium the site tracks is combed tops over greasy; the chain study starts from combed tops. Grade: fibre diameter in microns, with a fine class up to 24.5.

## Fit check

For each study, write one line: **build**, **merge into another study**, or **drop**, and why. For a study you build, add the sections you leave out, from the table at the end of [02-studies.md](02-studies.md). Whatever is dropped is named on the site, in the method section of the first page, with the reason.

## Pages

The human confirms names too. For each study you build, propose the file name, the tab name, a one-line question for its card, and the page title with its highlighted phrase. The first study you build is `index.html`.

## The reader

The kickoff names a reader. That decides the titles, what the summary tiles lead with, and the findings on the last page. If the reader's question needs something the studies leave out by design (taxes, ownership, policy, buyers' preferences), write it under "Open questions": the last study lists such things as questions for later and does not answer them.

## The template

Copy this into `docs/brief.md` and replace every angle-bracket field. Keep the headings. Add lines where a source needs them.

```markdown
# Brief: <industry> in <place>

Site language: <language>. Number format: <locale, e.g. en-US>.
Reader: <who, and what they want to understand>.
Site name: <two or three words>.

## Model check
- A physical flow someone counts: <yes/no, and what>
- A processing ladder: <yes/no, and its stages>
- Trade past the border: <yes/no, and where it is recorded>
- A product a person can buy: <yes/no, and which>

## Sources

For each source: state (downloaded | located, not downloaded | not found | not searched yet).

### A. Current periodic source
- State:
- Publisher and title:
- URL of the listing page:
- Format: <PDF | XLSX | CSV | HTML page | API>
- Frequency and lag:
- Samples stored: <paths under data/raw/>, <date>
- Tables it holds: <one line each>
- Units and basis, in its own words: "<quote>" or "none printed"
- Does it revise earlier periods? <yes/no, with one example seen across the stored issues>
- What it leaves out, in its own words: "<quote>" or "none printed"
- Is it compiled from customs records? <yes/no, with the line that says so>

### B. Long-run source
- State:
- Publisher and title:
- URL:
- Format:
- Shape: <one file per period | one consolidated file>
- Periods available: <first> to <last>
- Sample stored:
- Tables it holds:
- Units and basis, in its own words:
- Method changes over time: <period, what changed>

### C. Independent second source
- State:
- Publisher and dataset:
- Access: <URL, key needed or not, rate limits>
- Weight basis and valuation: <as the dataset defines them>
- Product codes per stage, with the description read in the data: <stage: code, description>
- Mirror side available? <yes/no>
- How independent of the main source: <fully | buyers' side only>
- Sample stored:

### D. The product
- State:
- Product, brand, price, URL, date read:
- Stored copy: <path>; figures read on screen but not in the file: <which, in which note>
- Composition and weight, as printed: "<quote>"
- Where it is made, as printed: "<quote>"
- Is this product actually made from this place's material? <yes | no | unknown>, source:
- Published cost breakdown: <source, URL> | not found
- Tariff, freight, intermediate prices, company margins: not searched yet

### E. Qualitative sources
- <stage>: <source, URL, date> ...

## Vocabulary
- Quantity unit and basis, per source table:
- Basis for prices per unit:
- Money:
- Period:
- Entities, in fixed order: <and a second set, if B splits differently>
- Stages, in order, with each source's name and codes:
  - raw: <stage>; first processing: <stage>; export stage: <stage>
  - parallel routes, if any:
- By-products:
- Grades:
- Destinations and exit points:
- Marks that are not numbers, and how each is read:

## Fit check
- Study 1, now: <build | merge | drop>. <why>. Sections left out: <…>
- Study 2, history:
- Study 3, industry:
- Study 4, chain:
- Study 5, opportunities:

## Pages
- <file>: tab "<name>"; card question "<one line>"; title "<title with *highlighted phrase*>"

## Open questions for the human
- <anything you had to choose without evidence>
- <anything the reader wants that the studies leave out by design>
```

## The checkpoint

Stop here. Show the filled brief. Say plainly which roles have no source and which studies or sections you propose to drop. Wait for the answer.
