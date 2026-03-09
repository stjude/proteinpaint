# Volcano plot
The volcano plot is intended to be a reusable component. It was developed as a child component
of the differential analysis app which requires a termType in the config. Term types must be
added to the volcano as of this writing.

## Supported Term Types
- **Gene Expression**: Data points are genes. P-value table shows Gene Name column. Highlight key is `gene_name`.
- **DNA Methylation**: Data points are promoters (ENCODE cCRE regions). P-value table shows separate Promoter and Gene(s) columns. Highlight key is `promoter_id`. Tooltips show both promoter ID and associated gene name(s).

## Add a term type
Ensure the following are completed. This is not a comprehensive list. Modify as needed.
- Add control inputs in VolcanoControlsInputs.ts
- Add default and validation settings in `settings/defaults.ts`
- Add logic to the view model for the term type (columns, highlight key, row data)
- Add rows for the tooltip in the view (`DataPointMouseEvents.ts`)
- Update interaction handlers if the data key differs (e.g. `promoter_id` vs `gene_name`)

### Version history
Last updated: 7 Mar 26
Authored: 13 Mar 25
