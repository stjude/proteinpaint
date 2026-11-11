import { run_python } from '@sjcrh/proteinpaint-python'
import { nearestGene, type GeneIndex } from './dmrGenes.ts'

/* Which DMRs sit on, or next to, a gene that either group expresses.

Most methylation change on a cohort with a genome-wide shift lands where nothing is transcribed: on MMRF t(4;14),
the hyper DMRs with the most evidence are long blocks in silent genes (FGFR2, median 0.004 TPM) and gene deserts.
A change there may be real, but it says nothing about any gene, and a reader looking for regulation needs to set
it aside. This links each DMR to genes and asks whether either group expresses one of them.

Linking: a DMR overlapping genes (its `genes`, which include a promoter it clips) is linked to those. A DMR
overlapping none is linked to the nearest gene within LINK_MAX_BP, measured to the nearer end of the gene since the
gene table carries no strand. Nearest-gene assignment is the usual first approximation for a distal element (GREAT,
McLean 2010 Nat Biotechnol, doi 10.1038/nbt.1630) and is often wrong: an enhancer regulates its nearest gene in
roughly half of the CRISPRi-tested pairs (Fulco 2019 Nat Genet, doi 10.1038/s41588-019-0538-0), so a DMR linked by
distance carries the distance, for the reader to weigh. Among several linked genes the most expressed is kept. */

/** Median expression, in either group, at or above which a gene counts as expressed; in the dataset's unit (TPM on
 * MMRF). 1 TPM is the usual floor for "detected" in bulk RNA-seq. */
export const MIN_EXPRESSION = 1
/** How far a DMR overlapping no gene looks for one. GREAT reaches 1 Mb, which links nearly everything to something;
 * most enhancer-promoter contacts lie within 100 kb. */
export const LINK_MAX_BP = 100_000

export type DmrExpressionLink = {
	gene: string
	/** bp from the DMR to the gene; 0 when it overlaps the gene */
	distance: number
	/** median expression of the gene in group 1 and group 2; null when the gene is not in the expression file */
	group1: number | null
	group2: number | null
	/** linked by correlation: the within-group Spearman rho and its pair FDR (dmrGeneCorrelation.ts) */
	rho?: number
	q?: number
}

/** Each gene's median expression in each of the two groups, from the dataset's gene expression HDF5. Only the
 * samples of a group that the file has are used; their counts come back in `samples`. */
export async function groupExpressionMedians(
	ds: any,
	group1: string[],
	group2: string[]
): Promise<{ medians: Map<string, [number | null, number | null]>; samples: [number, number]; unit?: string }> {
	const q = ds.queries?.geneExpression
	// a dataset-supplied getter (e.g. GDC) has no file to read the whole matrix from
	if (!q?.file || typeof q.file != 'string' || !q.file.endsWith('.h5'))
		throw new Error('This dataset has no gene expression file to tell expressed genes by.')
	// the script skips names the file lacks, and fails on a group left with none
	const out = JSON.parse(
		await run_python('groupGeneMedians.py', JSON.stringify({ input_file: q.file, groups: [group1, group2] }))
	)
	const medians = new Map<string, [number | null, number | null]>()
	out.genes.forEach((g: string, i: number) => medians.set(g, [out.medians[0][i], out.medians[1][i]]))
	return { medians, samples: out.samples, unit: q.unit }
}

/** The gene a DMR is judged by: the most expressed of the genes it overlaps, else its nearest gene within
 * LINK_MAX_BP; null when it has neither. */
export function linkDmr(
	d: { chr: string; start: number; stop: number; genes?: string[] },
	idx: GeneIndex | null,
	medians: Map<string, [number | null, number | null]>
): DmrExpressionLink | null {
	const near = !d.genes?.length && idx ? nearestGene(idx, d.chr, d.start, d.stop, LINK_MAX_BP) : null
	const candidates = d.genes?.length
		? d.genes.map(gene => ({ gene, distance: 0 }))
		: near
		? [{ gene: near.name, distance: near.distance }]
		: []
	let best: DmrExpressionLink | null = null
	for (const { gene, distance } of candidates) {
		const [group1, group2] = medians.get(gene) ?? [null, null]
		const link = { gene, distance, group1, group2 }
		if (!best || peak(link) > peak(best)) best = link
	}
	return best
}

/** The higher of a link's two group medians; -1 when neither group has a value, so any measured gene wins */
function peak(l: DmrExpressionLink): number {
	return Math.max(l.group1 ?? -1, l.group2 ?? -1)
}

export function isExpressed(l: DmrExpressionLink | null | undefined): boolean {
	return !!l && peak(l) >= MIN_EXPRESSION
}
