# DNA methylation on arrays

The methylation track (`tk.ts`), the locus view (methylation & expression at a gene) and the starburst
(methylation vs expression by gene) were built on sequencing data (WGBS, EM-seq), and also run on
Illumina arrays (450K, EPIC, EPIC v2), such as panMB's `queries.dnaMethylation.file`. This page says how
the two differ.

## How a dataset is read as an array

The server reads a CpG matrix as an array when it has no read depth: `resolveMethylationMatrix()` in
`server/src/utils/methylationMatrix.ts` sets `hasDepth` only for a CpG matrix of a dataset declaring
`platform: 'wgbs'`. Without depth:

- **Locus view and track.** `query_beta_values.py` counts each probe once, so a bin's value for a
  sample is the mean of that sample's betas in the bin. With depth it is pooled methylated reads over
  pooled reads, and a bin under 5 reads has no value.
- **Starburst and gene-body test.** Rust dmrcate takes the betas alone (`betas: true`) and works on
  their M-values.

## Fewest probes per gene

A gene body or core promoter needs this many CpGs for a value (`minProbes()` in
`server/src/routes/termdb.geneBodyMeth.ts`):

| Data       | Fewest CpGs | Why |
| ---------- | ----------- | --- |
| Sequencing | 5           | the DMR scan's own minimum, so the two analyses agree on what is measurable |
| Array      | 2           | an EPIC core promoter (TSS -2 kb to +500 bp) holds a median of one probe |

On panMB chr21 (EPIC), 5 kept 329 of the 651 promoters with a value and 149 of 213 gene bodies; 2 keeps
529 and 183. One probe is not enough: it would let a single probe decide a gene.

## "no data" in the track

A bin with no value for a sample is drawn in the missing color and labelled "no data", in the legend and
the tooltip. On sequencing data that means too few reads; on an array, that the sample has no probe in the
bin, for instance one that its array type does not carry.

## Known limitation: mixed array types

A matrix can hold samples from several array types; panMB has 305 on 450K, 1,234 on EPIC and 5 on EPIC
v2. The types carry different probes, so a bin or gene mean averages different probes for samples of
different types, and two samples can differ only because of their array. The views with expression
(locus view at a gene, starburst) take only samples with RNA, which on panMB are all EPIC or EPIC v2. The
track and the locus view of a region take every sample.
