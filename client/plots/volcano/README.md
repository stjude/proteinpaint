# Volcano plot

The volcano plot is intended to be a reusable component. It was developed as a child component
of the differential analysis app which requires a termType in the config. Term types must be
added to the volcano as of this writing.

## Supported Term Types

- **Gene Expression**: Data points are genes. P-value table shows Gene Name column. Highlight key is `gene_name`.
- **DNA Methylation**: Data points are regulatory elements of whichever **element class** the run selected — NOT one fixed definition. P-value table shows separate element and Gene(s) columns; the element column's label comes from `elementNoun()` in `promoterLabel.ts`, so it reads "Promoter", "cCRE promoter", "eQTM block", etc. Highlight key is `promoter_id` (named before the plot became element-generic; it carries the element ID for every class). Tooltips show both the element ID and associated gene name(s).

  **"Promoter" is ambiguous and the UI must keep the two apart.** A dataset can offer both:

  | Element class | Definition | Count (mmrf) |
  | --- | --- | --- |
  | `promoter` | TSS −1500/+500 window, the 450K array's TSS1500+TSS200 categories | 114,875 |
  | `promoter_pls` | ENCODE cCRE promoter-like element, ~349 bp — the CpG-island core, no shores | 7,345 |

  These are different features and **hit counts are not comparable across classes**: the same contrast yields ~36,000 significant elements on `promoter` and ~2,300 on `promoter_pls`, because the wider window averages more CpGs and there are 15x as many of them. Any recorded result must name its element class or it cannot be reproduced — which is why the run provenance line records `element class:` first.

## Add a term type

Ensure the following are completed. This is not a comprehensive list. Modify as needed.

- Add control inputs in VolcanoControlsInputs.ts
- Add default and validation settings in `settings/defaults.ts`
- Add logic to the view model for the term type (columns, highlight key, row data)
- Add rows for the tooltip in the view (`VolcanoPlotView.ts` → `addTooltipRows` / `buildMultiHitTable`)
- Update interaction handlers if the data key differs (e.g. `promoter_id` vs `gene_name`)

### Version history

Last updated: 18 Aug 26
Authored: 13 Mar 25
