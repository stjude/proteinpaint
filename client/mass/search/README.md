# mass/search

The mass **SEARCH** tab: omnisearch (search as you type). It finds dictionary variables, genes, samples and a typed genomic region, and launches plots from the results.

## Files

| File               | Role                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `loadHandlers.ts`  | `initHandlers()`: loads one handler per result key, once per dataset. `RESULT_KEYS` is the display order.                           |
| `handlers/`        | One file per result kind. See `handlers/_README.md`.                                                                                |
| `search.ts`        | The `MassSearch` component (`type: 'search'`, exported as `searchInit`): builds the input, wires typing (debounced) and Enter, renders the popup. Also `planSearch()` (which kinds to search for this text, one request), `fetchOmnisearch()` (the server call) and the debounce delay. |
| `results.ts`       | Generic list: headings, truncation notes, and the "Searchable: ..." note. Knows nothing about a particular result kind.             |
| `popup.ts`         | `ResultsPopup`: the menu holding the results, and the inline picker used by the DNA methylation region.                             |
| `launcher.ts`      | `Launcher`: `launchPlot` and `launchGenomeBrowserView`, shared by the handlers.                                                     |
| `buttons.ts`       | `addActionButton`: the one button style used for row actions.                                                                       |
| `constants.ts`     | Prompt length gates.                                                                                                                |
| `types.ts`         | `OmnisearchHandler` and the types shared by the handlers.                                                                           |
| `test/`            | Unit specs per file, and `search.integration.spec.ts` for the server route.                                                         |

## What happens when the user types

1. Each keystroke restarts a 250 ms debounce (`SEARCH_DEBOUNCE_MS`). Enter searches right away.
2. `planSearch()` asks each loaded handler whether it searches this text. Typing is gated by length (`constants.ts`: genes from 2 characters, dictionary from 3, nothing over 20). Enter ignores the length gates, and is the only way samples are searched. A typed coordinate range adds the region.
3. One request goes to `termdb/chat` with `omnisearch: true` and an `include` list of the result keys to search. If no handler wants the text, the popup is cleared and nothing is sent.
4. A newer search aborts the previous request (`AbortController`), so a slow old response cannot replace newer results.
5. `buildResultList()` turns the response into rows, grouped under a heading per kind with a "Displaying N out of M" note when the server capped a kind. Each row is drawn and handled by its handler.

The server side is `runOmnisearch()` in `server/src/chat/search.ts`. The request and result types are `OmnisearchRequest` and `OmnisearchResult` in `shared/types/src/routes/termdb.chat.ts`.

## What is searched for a dataset

Decided once, in `init()`, from `termdbConfig` (each handler's `includeResult()`), and shown to the user in the "Searchable: ..." note:

- Dictionary variables: always.
- Genes: the dataset has gene expression, DNA methylation, or SNV/indel, CNV or SV/fusion data.
- Samples: the dataset allows displaying sample ids (`displaySampleIds`).
- Genomic region: the dataset has genomic-alteration data, and `gbRestrictMode` is not `'protein'`.

## Tests

Unit specs (`test/*.unit.spec.ts`) cover the small functions: handler gating and rows, `planSearch`, the result list. They need no server. The integration spec calls the real route on TermdbTest.

In the browser, open the unit test page with `dir=mass/search&name=*`. From the command line, from `client/`:

```bash
npx tsx --conditions=sjpp/dev mass/search/test/genes.unit.spec.ts
```

## Not done yet

- A pseudobulk row for genes: needs server work first (see `handlers/genes.ts`).
- A search filter, and readability of the popup.
