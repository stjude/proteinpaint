# Volcano plot

The volcano plot is intended to be a reusable component. It was developed as a child component
of the differential analysis app which requires a termType in the config. Term types must be
added to the volcano as of this writing.

## Supported Term Types

- **Gene Expression**: Data points are genes. P-value table shows Gene Name column. Highlight key is `gene_name`.
- **DNA Methylation**: Data points are regulatory elements of whichever **element class** the run selected — NOT one fixed definition. P-value table shows separate element and Gene(s) columns; the element column's label comes from `elementNoun()` in `promoterLabel.ts`, so it reads "Promoter", "cCRE promoter", "eQTM block", etc. Highlight key is `promoter_id` (named before the plot became element-generic; it carries the element ID for every class). Tooltips show both the element ID and associated gene name(s).

  **"Promoter" is ambiguous and the UI must keep the two apart.** A dataset can offer both:

  | Element class  | Definition                                                                  | Count (mmrf) |
  | -------------- | --------------------------------------------------------------------------- | ------------ |
  | `promoter`     | TSS −1500/+500 window, the 450K array's TSS1500+TSS200 categories           | 114,875      |
  | `promoter_pls` | ENCODE cCRE promoter-like element, ~349 bp — the CpG-island core, no shores | 7,345        |

  These are different features and **hit counts are not comparable across classes**: the same contrast yields ~36,000 significant elements on `promoter` and ~2,300 on `promoter_pls`, because the wider window averages more CpGs and there are 15x as many of them. Any recorded result must name its element class or it cannot be reproduced — which is why the run provenance line records `element class:` first.

## Add a term type

Ensure the following are completed. This is not a comprehensive list. Modify as needed.

- Add a handler in `handlers/` and register it in `handlers/index.ts`. A handler holds everything
  that differs by data type, so the volcano asks it instead of testing `config.termType`. See
  `handlers/types.ts` for every field; in short:
  - the request: route, request body, whether the analysis compares `config.samplelst` groups, and
    the effect size on the x axis
  - the labels: what a row is called, the caption of the significant count, the words for the two
    directions, whether the p-value is a lone FDR, the group labels above the plot, the sample size
    rows, and the provenance line of a download
  - the buttons of the action bar and the ones a run hides, and whether the differential analysis
    offers GSEA
  - the rows: the key of a row (`getRowKey`), the columns that name it, the p-value table's
    effect-size and extra columns, the tooltip of one dot, and its click actions. A column holds
    its header and its cell together. The hover table of several dots is built from the naming
    columns and the plotted effect size.
  - the settings: defaults, validation, the controls of the data type and the shared controls it
    leaves out, and the plot config
  - the pre-analysis panel of `mass/groups.js`: the methods to choose from, the method the dataset
    prefers, the element classes, and the settings that follow from the samples with data
- Add the type's settings to `settings/Settings.ts`

### Version history

Last updated: 18 Nov 26
Authored: 13 Mar 25
