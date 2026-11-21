# 04 · Evidence rules

A site like this is only worth reading if every figure is true and every claim is as strong as its data, no stronger. These rules are how the reference site got there. Most of them exist because the reference site broke them first; the mistake is given with each rule.

They are not optional. When a rule and a nicer sentence disagree, the sentence loses.

## Numbers

**1. Compute; do not copy.** Shares, averages and prices per unit are computed from quantities and money. Printed percentages and printed averages are never read.

> **Wool example.** One monthly report prints a pair of shares as "33% / 73%". The federation's printed average fibre diameter cannot be reproduced from the diameter table of the same report.

**2. Blank is not zero. A missing column is not zero either.** An empty cell, a period not yet reported and a table that has no column for something all mean "not stated". Only a printed zero is a zero.

> **Wool example.** The annual reports of 2003/04 to 2009/10 have no column for yarn and fabric. From 2015/16 the column exists and prints 0. The first is unknown; the second is a reported zero.

**3. A zero from a source that under-reports is not a measured zero.** Before you write "none", check whether the source catches the flow at all.

> **Wool example.** The opportunities page called the place's customs zeros for yarn exports "measured". The same customs reports under-count combed wool from 2018, and the buyers' customs reports show yarn of that origin arriving.

**4. Every table adds up, or the build stops.** See [03-pipeline.md](03-pipeline.md). A source that fails its own totals is reported with the file and the table, and nothing is written.

**5. State the basis on every chart, and never add across bases.** Different weights, different periods and different valuation points go side by side with their labels. They are not summed and not divided by one another without saying so. Every price per unit names both of its terms: money valued where, per unit weighed how. The site uses one price basis throughout, the one the brief names.

**6. Say which population an average covers.**

> **Wool example.** The chain page said the place's combed wool was "about 23 microns". That figure was the average of all wool exports, not of combed wool. The source gives no average for combed wool; the page now states what it does give, the share in the fine class.

**7. Compare like with like.** A partial period is compared with the same months of another period. Never with a full one.

> **Wool example.** The opportunities page compared four months of the open season with a full closed season. It now compares the same months, and on those the uncombed share rose.

**8. Find the one-off before it finds you.** If one month or one line carries a yearly adjustment, a reclassification or a correction, mark it on every chart it touches, and compute the affected figures with and without it.

> **Wool example.** One June books a full year of exports by firms outside the federation, mostly cheap greasy wool. With it, the price gap between combed and greasy wool was 3.31 dollars per kilo. Without it, 2.08. The first figure had sized an opportunity.

**9. Recent figures are provisional when the publisher revises.** Flag them, draw them faded, and say which way revisions usually go.

**10. A ceiling is a maximum.** Any figure of the form "if all of X did Y" is labelled a ceiling, with "a maximum, not a projection" beside it, and with the assumptions that make it a maximum.

**11. Describe the series you measured, not a neighbouring one.**

> **Wool example.** The opportunities page said combing had retreated. The combed share of production had held; only the volume had fallen.

## Sources

**12. Raw files are stored and never edited.** Every figure can be traced to a file on disk and to the URL it came from.

**13. When two sources disagree, show both and choose per series.** Draw a control chart with the same flow according to each source, in money if they weigh on different bases. Use each source only for what it measures well, and say on the page why.

**14. Say exactly what the source says.** Its dates, its period, its scope, its hedges. If the source covers part of a period, so does your sentence.

> **Wool example.** A cited paper dates an export-duty change "from 2015"; the page had said 2016. A company's figure was quoted for a full season when the article covered it only to November. A slide's "60% processed" used partial-season data. All three were corrected to the source's own terms.

**15. No source, no sentence.** A claim whose source cannot be found again is deleted, however plausible.

> **Wool example.** One line about a sector body had no matching article when it was checked. It was dropped.

**16. Do not infer what the source does not state.**

> **Wool example.** The brand says only that the shirt is made in one country. The page had placed spinning and knitting in that country too, and sent the wool "to Asia". Neither was stated anywhere.

**17. Every source date is read, not guessed.** If you did not see the date on the page, the field is empty.

> **Wool example.** Two source dates in the assumptions file had been invented. Both were corrected.

**18. Mark what was re-read.** Research done by search returns figures nobody opened. Each input and each company margin carries a flag: re-read at the original, or not. The page shows the flag. Items not re-read are listed apart and labelled.

**19. A proxy is named as a proxy.** A listed company's margin belongs to that company, across everything it sells, in the segment it reports. Say which segment, and what else it includes.

> **Wool example.** A 1.0% margin was presented as "combers earn little". It was the wool-trading segment of a group that holds its combing mill as a joint venture outside its consolidated accounts. An 8% sewing figure was finance cost plus profit; the net was 3%.

## What reaches the reader

**20. Caveats go where the reader looks.** A range belongs on the tile, next to the figure. A hypothetical case is declared in the first line of the page. A table of sources at the bottom is necessary and not sufficient.

> **Wool example.** The site's owner asked whether the chain page's data gaps reached the reader. Most appeared only in the sources table at the bottom, and four did not appear at all. The page gained a framing line at the top, ranges on two tiles, a re-read column, and sentences on what was searched for and not found.

**21. Say what you looked for and did not find.** A missing price list, no independent study to compare against, a figure that rests on a single advertisement: each is a sentence on the page.

**22. Stay inside the question.** Each page answers its own question. The opportunities page says where value leaves, not why. Explanations from outside the data (policy, taxes, rules, buyers' preferences) are written as questions for later, never as causes.

**23. The page says what it computes.** The method section names which figures come from the pipeline and which small aggregates the page computes itself for display.

**24. Text with figures is generated from the data.** A lede, a tile or a footnote that quotes a number is built by the page script from the bundle. Typed numbers go stale at the next update.

## The independent fact-check

A page that makes claims is not done until someone who did not write it has checked it. In the reference site, two independent reviews of one page found seven errors after its author considered it finished.

Run the check in a separate agent or session. Give it the page, the data bundle, the assumptions file and the raw files. Do not give it your reasoning.

```text
You are fact-checking one page of a data site. You did not write it. Assume nothing on
it is true until you have checked it.

Page: <path to the HTML and its script>
Data it draws: <path to the data bundle(s)>
Assumptions: <path, if the page uses any>
Raw sources: <path to data/raw/ and its sources.json files>

Go through every sentence, tile, table cell and footnote that states a fact or a number.
For each one:
1. Find the figure in the data bundle, and recompute it if it is derived.
2. For a claim about what a source says, open the stored file or the URL and read it.
3. Check that the wording claims no more than the data shows. Look hard at: comparisons
   of unequal periods; averages (of which population?); "none" or "zero" (does the source
   measure this at all?); trends (is it the share or the volume that moved?); causes
   (does the data show the cause, or only the change?); ceilings presented as forecasts;
   one-off months or lines that distort a total; dates and periods of each source.
4. Check that every caveat a reader needs sits next to the figure it qualifies.

Report a list. For each item: the exact text on the page, what you checked it against,
and one verdict: supported, unsupported, overstated, or could not verify. For anything
not supported, say what the data does support. Do not fix the page.
```

Then fix every item that is not *supported*, and say in the commit message what was wrong.
