# Chat LLM Pipeline — Dataset Configuration Guide

## Overview

The chat pipeline uses a multi-stage LLM classifier to route user queries to the correct visualization agent (summary plots, differential gene expression, survival analysis, etc.).

**Stage 1 — Top-level classification (`classify1.ts`):** A small LLM classifies the query into one of two categories:

- `plot` — the query requests a data visualization or analysis
- `notplot` — the query is not asking to visualize or analyze dataset values

**Stage 2a — Not-plot routing (`classify2.ts`):** If the query is classified as `notplot`, classify2 checks whether the dataset has resources configured. If resources exist, it delegates to `resource.ts` which asks the LLM to match the query to a resource. If no resources exist or no match is found, the query is classified as `none`.

**Stage 2b — Plot type classification (`plot.ts`):** If the query is classified as `plot`, a second small LLM call determines the specific plot type: `summary`, `dge`, `survival`, `matrix`, or `sampleScatter`.

Downstream of classification, each plot type has its own agent that calls an LLM to extract structured parameters (terms, filters, groups, etc.) from the query.

## Classification Flow

```
User query
    │
    ▼
┌──────────────────────────────────┐
│  classify1.ts — Stage 1 LLM call │
│  "Is this plot or notplot?"      │
└──────────────────────────────────┘
    │
    ├─── notplot
    │        │
    │        ▼
    │   ┌───────────────────────────────────────┐
    │   │  classify2.ts — Stage 2a               │
    │   │  "Does dataset have resources?"        │
    │   └───────────────────────────────────────┘
    │        │
    │        ├─── no resources ────▶  "Query not related to data" (text response)
    │        │
    │        └─── has resources
    │                  │
    │                  ▼
    │             ┌──────────────────────────────────┐
    │             │  resource.ts — LLM call           │
    │             │  "Which resource matches?"        │
    │             └──────────────────────────────────┘
    │                  │
    │                  ├─── match ────▶  returns pre-authored HTML
    │                  │
    │                  └─── no match ─▶  "Query not related to data" (text response)
    │
    └─── plot
              │
              ▼
         ┌─────────────────────────────────────────┐
         │  plot.ts — Stage 2b LLM call             │
         │  "Which plot type does this query need?" │
         └─────────────────────────────────────────┘
              │
              ├─── summary ──────▶  summaryagent.ts
              │                       └─ LLM extracts term, term2, simpleFilter
              │
              ├─── dge ──────────▶  DEagent.ts
              │                       └─ LLM extracts group1, group2, method
              │
              ├─── survival ─────▶  (not yet implemented)
              │
              ├─── matrix ───────▶  matrixagent.ts
              │                       └─ LLM extracts geneNames, terms
              │
              └─── sampleScatter ▶  samplescatteragent.ts
                                      └─ LLM extracts plotName, colorTW, shapeTW
```

## File Location

Each dataset's AI configuration is a JSON file referenced by the dataset's main config. By convention these live in:

```
dataset/ai/<dataset-label>.json
```

---

## Minimum Required Structure

The following fields are the bare minimum. The server will throw an error if `charts` is missing or empty.

```json
{
	"charts": [
		{
			"type": "Summary",
			"TrainingData": []
		}
	]
}
```

Only declare chart types your dataset actually supports. The `charts` array drives the downstream agents (which training examples to use). Declaring a chart type with no `TrainingData` is valid but will reduce LLM accuracy for that plot type.

---

## Full Structure Reference

```json
{
  "db": "path/to/clinical.db",
  "genedb": "path/to/genes.db",

  "DatasetPrompt": "...",

  "resources": [
    { "label": "Primary publication", "html": "<a href='...'>...</a>" },
    { "label": "Data access",         "html": "..." }
  ],

  "charts": [
    { "type": "Classification", "SystemPrompt": "...", "TrainingData": [...] },
    { "type": "Summary",        "SystemPrompt": "...", "TrainingData": [...] },
    { "type": "DE",                                    "TrainingData": [...] },
    { "type": "Matrix",         "SystemPrompt": "...", "TrainingData": [...] },
    { "type": "sampleScatter",  "SystemPrompt": "...", "TrainingData": [...] },
    { "type": "survival",                              "TrainingData": [...] }
  ],

  "prebuiltPlots": [
    { "name": "Transcriptome t-SNE",  "chartType": "sampleScatter" },
    { "name": "Transcriptome UMAP",   "chartType": "sampleScatter" }
  ],

  "TestData": [...]
}
```

### Top-level fields

| Field                          | Required                      | Description                                                                                                                                                                    |
|--------------------------------|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `charts`                       | **Yes**                       | Declares which plot types the dataset supports. The pipeline throws if this is missing or empty.                                                                               |
| `ds?.queries?.geneExpression`  | If using gene expression      | Enables gene name extraction and geneExpression term type.                                                                                                                     |
| `ds?.queries?.rnaseqGeneCount` | If using DE                   | Enables the differential expression agent.                                                                                                                                     |
| `db`                           | Yes                           | Path to the clinical SQLite database.                                                                                                                                          |
| `genedb`                       | If using gene expression      | Path to the gene symbol SQLite database.                                                                                                                                       |
| `DatasetPrompt`                | Recommended                   | Free-text appended to every agent system prompt. Use this for dataset-specific terminology disambiguation (e.g. what "LC50" means, naming conventions for clinical variables). |
| `resources`                    | If using Classification chart | Links and publications returned when a user asks about the dataset.                                                                                                            |
| `prebuiltPlots`                | If using sampleScatter        | Names of available pre-built scatter plots (t-SNE, UMAP).                                                                                                                      |
| `TestData`                     | Recommended                   | Ground-truth Q&A pairs used by the automated test suite.                                                                                                                       |

---

## charts[].TrainingData

Each chart entry in `charts` can have a `TrainingData` array of `{ question, answer }` pairs. These are used as few-shot examples in the agent system prompt for that chart type.

The `answer` format is specific to each chart type:

### Classification (resource routing)

```json
{
	"question": "Show publications for ALL pharmacotyping",
	"answer": { "type": "resource", "idx": 0 }
}
```

`idx` refers to the index in the top-level `resources` array.

### Summary

```json
{
	"question": "Compare TP53 expression between genders",
	"answer": {
		"term": "Sex",
		"term2": "TP53",
		"simpleFilter": []
	}
}
```

`term` and `term2` must be exact field names from the dataset's SQLite DB or gene names (if the dataset has gene expression). `simpleFilter` is an optional array of categorical or numeric filter terms.

### DE

```json
{
	"question": "Show DE between KMT2A and DUX4",
	"answer": {
		"group1": [{ "term": "Molecular subtype", "category": "KMT2A" }],
		"group2": [{ "term": "Molecular subtype", "category": "DUX4" }],
		"method": "edgeR"
	}
}
```

`method` can be `"edgeR"`, `"limma"`, or `"wilcoxon"`.

### Matrix

```json
{
	"question": "Show TP53 and RB1 with molecular subtype in a matrix",
	"answer": {
		"geneNames": ["TP53", "RB1"],
		"terms": ["Molecular subtype"]
	}
}
```

### sampleScatter

```json
{
	"question": "Color the t-SNE by molecular subtype",
	"answer": {
		"plotName": "Transcriptome t-SNE",
		"colorTW": "Molecular subtype"
	}
}
```

`plotName` must match an entry in `prebuiltPlots`. `colorTW` (color), `shapeTW` (shape), and `term0` (Z-divide/panel split) are optional overlays. Set to `null` to remove an overlay.

### survival

```json
{
	"question": "Compare survival rates between KMT2A and DUX4",
	"answer": {
		"group1": [{ "term": "Molecular subtype", "category": "KMT2A" }],
		"group2": [{ "term": "Molecular subtype", "category": "DUX4" }]
	}
}
```

---

## charts[].SystemPrompt

An optional string appended to the agent system prompt for that chart type. Use this for chart-specific rules the LLM should follow for your dataset, such as:

- Available pre-built plot names for sampleScatter
- Column name mappings or naming conventions
- Domain rules (e.g. what constitutes a "sensitive" vs "resistant" threshold for a drug)

---

## Enabling Chat Verbose Logging

To see the classification pipeline logs during development, add `"chatVerbose": true` inside the `features` block of your `serverconfig.json`:

```json
"features": {
  "chatVerbose": true
}
```

This is independent of `debugmode` so that other developers can disable chat logs without losing other debug output.

## Testing chatbot

The chatbot prompts can be tested for each dataset using the [URL](http://localhost:3000/testchat). Select datasets (for e.g. TermdbTest)  can be run using the [URL](http://localhost:3000/testchat?dslabel=TermdbTest). It is recommended before merging a PR pertaining to the chatbot or changing a model used by the chatbot, all datasets are tested so that no prompt output drifts away from expected results. 

In addition to using the script, please test presence/absence of gene expression in various agents (summary, matrix etc.) by commenting out ds?.queries?.geneExpression.
