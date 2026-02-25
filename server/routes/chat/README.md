# Chat LLM Pipeline — Dataset Configuration Guide

## Overview

The chat pipeline uses a hybrid classifier to route user queries to the correct visualization agent (summary plots, differential gene expression, survival analysis, etc.). The classifier operates in three tiers:

1. **Explicit override** — regex patterns detect unambiguous keywords (e.g. "UMAP", "heatmap", "volcano plot") and route immediately.
2. **Embedding classifier** — a sentence-embedding kNN model compares the user query against labeled training examples and picks the category with the most votes.
3. **LLM fallback** — triggered when the embedding confidence is too low or the vote is tied. A small classifier LLM breaks the ambiguity.

Downstream of classification, each plot type has its own agent that also calls an LLM to extract structured parameters (terms, filters, groups, etc.) from the query.

**Every LLM call in this pipeline relies on training examples and context provided through a dataset-specific AI configuration file.** Without dataset-specific configuration, the models are working from generic, placeholder examples that do not know your variable names, subtype labels, drug names, or domain terminology. This leads to misclassification, hallucinated term IDs, and failed plot attempts.

---

## Why Dataset-Specific Configuration Matters

The generic fallback examples in `dataset/ai/defaultClassifierExamples.json` use placeholder language like "subtype A", "subtype B", and "drug A". These are intentionally broad. They keep the classifier functional across any dataset but they do not teach the LLM anything about your specific data.

When a user asks *"Which genes are upregulated in KMT2A vs DUX4?"*, the generic examples cannot help the downstream DE agent know that `KMT2A` and `DUX4` are valid values of the `Molecular subtype` field. Without a concrete training example that pairs this kind of query with the correct structured output, the LLM must guess — and will frequently produce invalid term IDs or wrong filter structures.

Dataset-specific configuration provides:
- **Classifier examples** using your actual subtype names, gene names, and clinical variables — improving embedding similarity and reducing LLM fallback rate.
- **Agent training examples** (`TrainingData`) that show the LLM exactly how to map your domain language into the structured JSON each plot type requires.
- **System prompt context** (`DatasetPrompt`, per-chart `SystemPrompt`) that gives the LLM domain-specific rules it cannot infer from the query alone.

---

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

Only declare chart types your dataset actually supports. The `charts` array drives both the classifier (which categories are valid for this dataset) and the downstream agents (which training examples to use). Declaring a chart type with no `TrainingData` is valid but will reduce LLM accuracy for that plot type.

---

## Full Structure Reference

```json
{
  "hasGeneExpression": true,
  "hasDE": true,
  "db": "path/to/clinical.db",
  "genedb": "path/to/genes.db",

  "DatasetPrompt": "...",

  "classifierExamples": {
    "summary":       ["...", "..."],
    "dge":           ["...", "..."],
    "survival":      ["...", "..."],
    "matrix":        ["...", "..."],
    "sampleScatter": ["...", "..."],
    "resource":      ["...", "..."]
  },

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

| Field | Required | Description |
|---|---|---|
| `charts` | **Yes** | Declares which plot types the dataset supports. The pipeline throws if this is missing or empty. |
| `hasGeneExpression` | If using gene expression | Enables gene name extraction and geneExpression term type. |
| `hasDE` | If using DE | Enables the differential expression agent. |
| `db` | Yes | Path to the clinical SQLite database. |
| `genedb` | If using gene expression | Path to the gene symbol SQLite database. |
| `DatasetPrompt` | Recommended | Free-text appended to every agent system prompt. Use this for dataset-specific terminology disambiguation (e.g. what "LC50" means, naming conventions for clinical variables). |
| `classifierExamples` | Strongly recommended | Dataset-specific embedding classifier training examples. See below. |
| `resources` | If using Classification chart | Links and publications returned when a user asks about the dataset. |
| `prebuiltPlots` | If using sampleScatter | Names of available pre-built scatter plots (t-SNE, UMAP). |
| `TestData` | Recommended | Ground-truth Q&A pairs used by the automated test suite. |

---

## classifierExamples

This is the most impactful field for classification accuracy. It provides labeled training sentences using your actual domain vocabulary. These are merged with the generic defaults from `dataset/ai/defaultClassifierExamples.json`.

Each key is a classifier category name. Only include categories that your `charts` array declares.

```json
"classifierExamples": {
  "summary": [
    "Show CDKN2A expression for KMT2A and DUX4 patients",
    "Compare Bortezomib LC50 between molecular subtypes",
    "How many patients have the DUX4 subtype"
  ],
  "dge": [
    "Which genes are upregulated in KMT2A vs DUX4",
    "Show volcano plot for male vs female patients in the DUX4 subtype"
  ],
  "survival": [
    "Compare survival rates between KMT2A and DUX4",
    "What is the hazard ratio for KMT2A vs DUX4"
  ],
  "matrix": [
    "Show TP53 and PAX5 for KMT2A and DUX4 subtypes in a matrix"
  ],
  "sampleScatter": [
    "Show the t-SNE for just the KMT2A samples",
    "Show t-SNE with Bortezomib LC50 as color"
  ],
  "resource": [
    "Show publications for this dataset",
    "Where can I get the data?"
  ]
}
```

**Tips:**
- Aim for at least 10–20 examples per category.
- Use your real subtype names, drug names, and variable names — not placeholders.
- Include examples of queries that are easy to confuse across categories (e.g. summary vs. matrix for single-gene expression).

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
