# Omnisearch handlers

One file per **result key**: a field of the server's `OmnisearchResult` (`shared/types/src/routes/termdb.chat.ts`).

| File                 | Result                                    | Searched                                      |
| -------------------- | ----------------------------------------- | --------------------------------------------- |
| `dictionaryTerms.ts` | dictionary variables (clinical terms)     | typing (3-20 chars) or Enter                  |
| `genes.ts`           | genes, with buttons for each data type    | typing (2-20 chars) or Enter                  |
| `samples.ts`         | samples, matched by name                  | Enter only                                    |
| `coord.ts`           | one typed genomic region (`chr:start-stop`) | typing, when the text is a coordinate range |

The same key is used everywhere, so it is easy to find the code that belongs to a result:

- the handler's file name (`handlers/<key>.ts`)
- the handler's `key`
- the entry in the request's `include` list
- the result field in the server's response, and its entry in `totals`

A result kind is not a term type. A gene result can launch gene expression, variant and methylation plots; a sample or a region has no term type at all. Term-type differences therefore live inside the handler that needs them (`genes.ts`).

## What a handler file exports

```ts
/** Does this dataset have anything to show for this kind? Decided from termdbConfig. */
export function includeResult(termdbConfig): boolean

/** Same class name in every file; `key` matches the file name. */
export class SearchResultHandler implements OmnisearchHandler<Row> {
	readonly key = '<resultKey>' as const
	// heading, noun, label, hint?
	init(ctx) // once per dataset
	includeInSearch(input) // is this kind searched for the typed text?
	requestExtras?(input) // extra request fields (coord: coordCandidates)
	buildRows(data, earlier) // server response -> rows
	countReturned?(data) // matches the server returned, for the truncation note
	renderRow(tr, row, deps) // one row, including what a click does
}
```

The interface and the meaning of every member are in `../types.ts`.

## How handlers are loaded and used

1. `../loadHandlers.ts` imports `./handlers/<key>.ts` for each key in `RESULT_KEYS`, like `client/termdb/handlers` and `TermTypeSearch.ts`. A handler is created only if its `includeResult(termdbConfig)` is true, then `init()` runs. This happens once, when the component initializes; the order of `RESULT_KEYS` is the display order.
2. On each keystroke (debounced) or Enter, `../search.ts` `planSearch()` asks each handler `includeInSearch()` and sends **one** request whose `include` list holds the keys of those that said yes, plus any `requestExtras()`.
3. `../results.ts` `buildResultList()` calls `buildRows()` for each handler and adds the generic parts: a heading per kind and a "Displaying N out of M ... matches" note when the server capped a kind. Handlers never build headings or notes.
4. Each row is drawn by its handler's `renderRow()`.
5. The "Searchable: ..." note under the input is built from the loaded handlers' `label` and `hint`, so it cannot drift from what the search does.

Dataset-wide decisions (which buttons exist, which views are allowed) are made in `init()` or `includeResult()` and stored. Per-result decisions (does this gene or sample have this data) use the row the server returned. Nothing is re-derived per click.

Length gates and constants are in `../constants.ts`. Shared helpers: `../buttons.ts` (`addActionButton`), `../launcher.ts` (`launchPlot`, `launchGenomeBrowserView`), `../popup.ts` (`ResultsPopup`).

## Adding a result kind (e.g. genesets)

1. Add the result field to `OmnisearchResult` in `shared/types`, and the server code that fills it. On the server, a key only runs when it is in the request's `include` list (default when omitted: `dictionaryTerms` and `genes`).
2. Write `handlers/<key>.ts` with `includeResult` and `SearchResultHandler`.
3. Add `<key>` to `RESULT_KEYS` in `../loadHandlers.ts`.
4. Add `../test/<key>.unit.spec.ts`.

`OmnisearchResultKey` is derived from `OmnisearchResult`, so a handler cannot claim a result the server does not return.

## `genes.ts`: term types and plots

Selecting a gene shows one row of buttons per term type that this gene has.

- `TERM_TYPES`: how to get the gene's term (gene expression, gene variant, DNA methylation). A term type does not know about plots. Variant also has non-plot buttons: Protein view and Genome view.
- `PLOT_TYPES`: Summary and Survival, written once and chained onto every term type. Survival always receives the gene's term as `term2`. If the dataset has one survival term it is the outcome; otherwise the user picks one in the term tree.
- To add a term type (e.g. pseudobulk, not done yet: the server does not report it per gene), add one entry to `TERM_TYPES`; it gets every plot. To add a plot, add one entry to `PLOT_TYPES`.

When a button is shown (decided from `termdbConfig`):

- Survival, in any row: `allowedTermTypes` includes `survival`. The plot can also be launched from the data dictionary, so `supportedChartTypes` is not used.
- Variant Summary and Survival: `allowedTermTypes` includes `geneVariant`.
- Protein view / Genome view: if `queries.gbRestrictMode` is set, only the view it names (`protein` or `genomic`); if unset, both. Genome view also needs the gene's coordinate.

`gbRestrictMode` limits the genome browser only. The DNA methylation region picker embeds its own genome browser and does not read it, so a methylation gene still needs a coordinate when `gbRestrictMode` is `'protein'`. The server (`runOmnisearch()` in `server/src/chat/search.ts`) therefore always resolves `GeneMatch.coord` for genes with methylation data, and skips it for a gene that only has genome browser data when `gbRestrictMode` is `'protein'` (no genomic view to seed). If a methylation button reports "Could not resolve coordinates", the gene has no coordinate in the genome's gene db.

## Tests

Unit specs are in `../test/<key>.unit.spec.ts`, plus `results`, `search`, and the server-calling `search.integration.spec.ts`. Run in the browser with `dir=mass/chat&name=*`.
