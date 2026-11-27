# Driver knowledge base

The rules by which the server tags the driver events of a sample (`server/src/driverRank/`): the
`termdb/singleSampleMutation` route puts the driver events of a sample first, each with a `.driver` tag, and with
`drivers: 'only'` returns only them. A genome uses this kb with
`driverKb: { file: 'genome/driverKb/index.json', build: 'hg38' }`, whose build picks the coordinates of enhancer
rules; a dataset
may change it with `ds.driverKb` (see `DriverKbOverlay` in `shared/types/src/driverKb.ts`), or turn ranking off
with `ds.driverKb: false`.

## Files and licenses

The data files are under their own licenses, given in their `#license` lines, and not under the ProteinPaint
license.

| File | Source | License |
| --- | --- | --- |
| `cancerHotspot.txt` | [Cancer Hotspots](https://www.cancerhotspots.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| `civic.txt` | [CIViC](https://civicdb.org) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `curated.txt` | rules edited by hand, for drivers that the other sources lack | the ProteinPaint license |
| `index.json` | the list of source files, loci of gene names and matching parameters | the ProteinPaint license |

`cancerHotspot.txt` is an adapted version of the Cancer Hotspots database, which is available under the Open
Database License (ODbL) 1.0: each hotspot is reformatted as a row, and two columns are left out. The adapted
database is likewise under the ODbL 1.0. Any public use of it, or of a work produced from it, such as a view of
driver tags from its rules, must attribute Cancer Hotspots; a response with driver tags lists the sources of its
rules in `driverRank.sources`, for that attribution.

## Format

A kb file is tab-separated text: `#key=value` metadata lines (`format`, `source` and `license` are required), a
header line, then one rule per row. The server checks every row at launch, and fails to launch on an invalid row.

| Column | Meaning |
| --- | --- |
| id | unique, stable across refreshes, starting with the source id of index.json: `civic:87` |
| kind | `snv` `fs` `inframe` `exon` `gene` `fusion` `sv` `itd` `amp` `del` `deepDel` `enhancer` |
| gene | gene symbol; for fusion and sv, the 5' gene, or the first gene or locus; for enhancer, the gene that the locus activates; `*` is any gene |
| partner | fusion and sv: the 3' gene, or the second gene or locus; `*` is any gene; enhancer: the name of the locus, such as `N-Me` |
| start, end | protein residue, or range, of snv, fs and inframe |
| ref | reference amino acid at start: one letter, `X` for a splice site, `*` for a stop codon |
| alt | snv: comma-separated alt amino acids, `*` for nonsense, `sp` for splice, blank for any change; exon and gene: the kind of change, one of `any` `missense` `trunc` `fs` `inframe` `del` `ins` `dup` `splice`; enhancer: `gain` |
| exon | exon number or range of exon, and optionally of itd |
| isoform | the isoform that exon is numbered on; blank is the default RefSeq isoform of the gene |
| region | enhancer only: the coordinates of the locus in each build, comma-separated `<build>=<chr>:<start>-<stop>`, such as `hg19=chr8:130180065-130180972,hg38=chr8:129167819-129168726` |
| window | sv: the bp around the gene and the partner within which a breakpoint counts; a locus, such as IGH, counts by the span of its genes, without the window |
| tier | 1, a known driver alteration; 2, a likely driver |
| label | short display label |
| info | provenance, `;`-separated `key=value` pairs, not used for matching |

The rules name genes and protein residues, not genomic coordinates, so one kb serves every build of a genome. The
coordinates of the rules that match by position (exon, itd, cnv and sv rules, and the genes at the breakpoints of
an sv) come from the gene db of the genome at launch. An event's reference amino acid must equal the `ref` of an
snv rule, which guards against an event on an isoform that numbers residues differently.

`index.json` lists the source files, in the order that breaks a tie between rules; the loci; and the matching
parameters. A locus, such as `IGH`, is a group of genes that a rule names as one gene, as the gene db has no gene of
that name: the genes whose names fit its `genePattern`, on its `chr`. An event gene that fits the pattern, such as
`IGHM` or `IGH@`, is the locus for every rule, and a breakpoint within the span of its genes is in the locus. The
patterns of the immunoglobulin loci `IGH`, `IGK` and `IGL` take the V, D, J and constant segments, and leave out
other genes that start with the same letters, such as IGHMBP2, IGLL1 and IGLON5, and the orphons, such as
IGHV1OR15-1 and IGKV1OR2-108, which are elsewhere, even on the same chromosome; `chr` leaves out the alt contigs.

The `region` of an enhancer rule is the one exception to a kb free of genome builds, as its locus is not a gene:
take the coordinates from the source paper, map them to the other build, and give both, with their provenance in
`info`. A rule without coordinates in the build of the genome, or whose locus is more than 5 Mb from its gene, as
for coordinates of another build, is left out at launch.

An `enhancer` rule matches a gain over its locus that need not reach the gene, such as a focal duplication of the
N-Me enhancer 1.4 Mb from MYC in T-ALL: a focal cnv segment over the locus with a gain or amp call, or an sv of
`svtype` DUP whose breakpoints span it. An sv without a `svtype` does not match, as the breakpoints of a deletion
and a duplication look alike. Enhancers work in some lineages only, so their rules are tier 2; a dataset of that
lineage may disable the rule and add a tier 1 rule of its own in `ds.driverKb.file`.

The cnv thresholds of `match.cnv.calls` are starting values, to be calibrated per value type. Only enhancer rules
use the `gain` threshold, which is below `amp`, as enhancer duplications are often of one copy.

## Refresh

`cancerHotspot.txt` and `civic.txt` are written by the driverKb intake scripts, from the list downloaded from
cancerhotspots.org and from the CIViC nightly files. Their `#retrieved` and `#inputs` lines record the download
date and the checksum of each input. Review the diff, and the intake's list of CIViC variant names that it could
not parse, before committing a refresh.
