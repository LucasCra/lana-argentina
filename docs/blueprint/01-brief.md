# 01 · The brief

The brief is one file, `docs/brief.md` in the new repository. You fill it in before any code exists. It names the sources, fixes the vocabulary, and says which of the five studies this industry can carry. The human confirms it. Then you build.

At this step the new repository holds two things only: `docs/brief.md`, and `data/raw/` with one folder per source, each with its sample files and a `sources.json` that maps file name to URL. Create those folders now. Step 1 builds the rest of the layout around them.

The blueprint itself can stay outside the new repository or be copied into its `docs/blueprint/`. The built site never refers to it.

## What the model needs from an industry

The five studies assume four things. Check each one before anything else.

1. **A physical flow someone counts.** Tons, litres, units, megawatt-hours: a quantity and a value, published per period by a body that collects it.
2. **A processing ladder.** The raw material passes through stages, and each stage sells a different product at a different price per unit.
3. **Trade past the border.** Later stages show up in customs data under their own product codes, in this place and in the places that buy from it.
4. **A product a person can buy.** One finished item with a public shelf price, made from this material.

An industry that lacks one of these can still get a site. [02-studies.md](02-studies.md) says which study to drop or merge in each case. Decide it here, in the brief, and not halfway through the build.

> **Wool example.** Flow: clean tons and dollars of wool exported, published monthly by the Argentine wool federation (FLA). Ladder: greasy → scoured → combed tops → yarn → fabric → garment. Trade: UN Comtrade, HS chapter 51 and the wool garment codes. Product: one merino T-shirt at 95 dollars.

## The five source roles

Every site stands on up to five kinds of source. Find a real one for each role, download a sample, and open it before you write its name in the brief.

| Role | What it is | Feeds |
| --- | --- | --- |
| **A. Current periodic source** | The bulletin or dataset that reports the latest months or quarters. Often revised after publication. | Study 1 |
| **B. Long-run source** | Closed periods going back as far as they are published. Often the annual edition of A. | Studies 2 and 3 |
| **C. Independent second source** | A different body counting the same flow or the next stages. Customs data is the usual one, read from both sides: what the place reports, and what its buyers report (mirror data). | Study 3, and a control on A and B |
| **D. One retail product** | The product page, a published cost breakdown if one exists, price lists for intermediate goods, tariff schedules, listed companies' margins. | Study 4 |
| **E. Qualitative sources** | Sector bodies, press, public research, company filings: who operates at each stage today. | Studies 3 and 5 |

Rules for all of them:

- **Download, then cite.** A source enters the brief only after its file is on disk under `data/raw/` with its URL recorded. See [03-pipeline.md](03-pipeline.md) for the manifest.
- **Read the method notes.** Find where the source defines its units, its period, its revisions and what it leaves out. Quote those lines in the brief.
- **Do not fill from memory.** If you cannot find a source for a role, write "not found" and what you tried. A missing role changes the plan; an invented one ruins the site.
- **Prefer the publisher's own file** over a copy, an aggregator or a news summary.

## The vocabulary to pin

These choices appear on every chart. Fix them once, in the site's language.

- **Quantity unit and basis.** If the industry counts the same material on two bases, name both and say which one each table uses. Two bases never add.
- **Money.** Currency, and whether values are at the border of the seller (FOB) or the buyer (CIF).
- **Period.** Calendar year, fiscal year or a season. If source A and source C use different periods, say so; the site keeps them apart.
- **Entities.** The products or categories the main source splits its totals by. Five or fewer get a fixed colour each. Give them a fixed order.
- **Stages.** The processing ladder, in order, with the name each source gives each stage and the customs codes that match it.
- **Grades.** A quality scale, if the industry has one that moves the price.
- **Destinations and exit points.** How the source names countries, and whether it reports ports or regions.

> **Wool example.** Two bases: clean tons (what wool yields once washed) and greasy tons (as shorn). Export tables are clean; the supply balance is greasy. Period: a season from July to June, while customs data runs on calendar years. Entities: greasy, tops, noils, scoured, by-products. Grade: fibre diameter in microns, with a fine class up to 24.5.

## Fit check

For each study, write one line: **build**, **merge into another study**, or **drop**, and why. A dropped study is named on the site, in the method section of the first page, with the reason.

## The template

Copy this into `docs/brief.md` and replace every angle-bracket field. Keep the headings.

```markdown
# Brief: <industry> in <place>

Site language: <language>. Number format: <locale, e.g. en-US>.
Reader: <who, and what they want to understand>.
Site name: <two or three words>.

## Sources

### A. Current periodic source
- Publisher and title:
- URL of the listing page:
- Format: <PDF | XLSX | CSV | API>
- Frequency and lag:
- Sample downloaded: <path under data/raw/>, <date>
- Tables it holds: <one line each>
- Does it revise earlier periods? <yes/no, with one example seen in the files>
- What it leaves out, in its own words: "<quote>"

### B. Long-run source
- Publisher and title:
- Periods available: <first> to <last>
- Sample downloaded:
- Method changes over time: <period, what changed>

### C. Independent second source
- Publisher and dataset:
- Access: <URL, key needed or not, rate limits>
- Product codes per stage: <stage: codes>
- Mirror side available? <yes/no>
- Sample downloaded:

### D. The product
- Product, brand, price, URL, date read:
- Composition and weight, as printed: "<quote>"
- Where it is made, as printed: "<quote>"
- Cost breakdown or price lists found: <source, URL> or "not found"
- Tariff and freight sources:
- Listed companies per stage, for reference margins:
- Is this product actually made from this place's material? <yes | no | unknown>, source:

### E. Qualitative sources
- <stage>: <source, URL, date> ...

## Vocabulary
- Quantity unit and basis:
- Money:
- Period:
- Entities, in fixed order:
- Stages, in order, with each source's name and codes:
- Grades:
- Destinations and exit points:

## Fit check
- Study 1, now: <build | merge | drop>. <why>
- Study 2, history:
- Study 3, industry:
- Study 4, chain:
- Study 5, opportunities:

## Open questions for the human
- <anything you had to choose without evidence>
```

## The checkpoint

Stop here. Show the filled brief. Say plainly which roles have no source and which studies you propose to drop. Wait for the answer.
