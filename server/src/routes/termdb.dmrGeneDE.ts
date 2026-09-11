import type { RoutePayload, RouteApi } from '#types'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { lengthStratifiedDE, type GeneFC } from '#src/utils/dmrGeneDE.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'

/* Do the genes losing gene-body methylation also lose expression?

Gene-body methylation tracks transcription, so a scan finding methylation loss concentrated in
gene bodies predicts those genes are expressed lower in the same patients. This route runs that
test: it takes the gene set from a background-corrected scan, runs differential expression on the
SAME two groups through the existing DE machinery (cached, so a repeat is free), and compares hit
genes to non-hit genes within length strata.

Length control is not optional. The most frequently hit genes on this cohort -- VPS13B, LRBA,
ZBTB20, CNTNAP2 -- are all 1-2Mb, because a long gene collects more DMRs simply by being long, and
length also predicts expression level and variance. Comparing hits to all other genes would
recover gene length. See utils/dmrGeneDE.ts for the stratification and its permutation null. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrGeneDE',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

/** Individual genes returned. Enough to scan and export, far short of a table nobody reads --
 * the aggregate is the result, these are for following it up. */
const MAX_TOP_GENES = 500

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			if (!Array.isArray(q.genes) || !q.genes.length) throw new Error('No genes supplied.')
			if (!q.samplelst?.groups?.length) throw new Error('Two sample groups are required.')
			const t0 = Date.now()

			/* Reuses the DE route's cache: the same contrast run for the volcano is not recomputed
			here, and running this twice is free. */
			const { result } = await getDeCacheResult(
				{
					genome: q.genome,
					dslabel: q.dslabel,
					samplelst: q.samplelst,
					min_count: q.min_count ?? 10,
					min_total_count: q.min_total_count ?? 15,
					method: q.method
				} as any,
				genomes
			)
			// DeCacheResult.geneRows -- GeneDEEntry[] with gene_name and fold_change
			const rows: any[] = (result as any)?.geneRows || []
			if (!rows.length) throw new Error('Differential expression returned no genes for these groups.')

			/* Gene lengths from the genome's own gene2coord, the same table the scan annotates DMRs
			from -- so a gene's length here and its DMR assignment there cannot disagree. */
			const g2c = genome?.genedb?.db?.prepare('select name, start, stop from gene2coord').all() || []
			const lenOf = new Map<string, number>()
			for (const r of g2c) {
				const len = r.stop - r.start
				// a symbol can appear on more than one contig; keep the longest span
				if (len > 0 && len > (lenOf.get(r.name) || 0)) lenOf.set(r.name, len)
			}
			const genes: GeneFC[] = []
			for (const r of rows) {
				const len = lenOf.get(r.gene_name)
				if (!len || !Number.isFinite(r.fold_change)) continue
				genes.push({ gene: r.gene_name, fc: r.fold_change, len })
			}
			const hitSet = new Set<string>(q.genes)
			const out = lengthStratifiedDE(genes, hitSet, 1)

			/* The individual genes, not just the aggregate. The stratified difference says the SET
			moves; a reader then wants to know which members of it moved, and by how much, with DE's
			own p rather than the permutation p (which is a property of the set). Sorted by DE
			significance and capped, with the full count reported so the cap cannot be mistaken for
			the total. */
			const byName = new Map<string, any>()
			for (const r of rows) if (hitSet.has(r.gene_name)) byName.set(r.gene_name, r)
			const pOf = (r: any) => r.adjusted_p_value ?? r.original_p_value ?? 1
			const hitRows = [...byName.values()]
				.filter(r => Number.isFinite(r.fold_change))
				.map(r => ({
					gene: r.gene_name,
					fc: r.fold_change,
					p: pOf(r),
					adjusted: r.adjusted_p_value != null,
					len: lenOf.get(r.gene_name) ?? null
				}))
			const sigHits = hitRows.filter(r => r.p < 0.05)
			const downSig = sigHits.filter(r => r.fc < 0).length

			mayLog(
				`dmrGeneDE: ${hitSet.size} hit genes, ${genes.length} with length+fold change,`,
				formatElapsedTime(Date.now() - t0)
			)
			res.send({
				status: 'ok',
				...out,
				deMethod: (result as any)?.method,
				sampleSize1: (result as any)?.sample_size1,
				sampleSize2: (result as any)?.sample_size2,
				genesTested: genes.length,
				genesRequested: hitSet.size,
				/* Genes named by a DMR that DE never reported -- filtered out for low count, or absent
				from the expression matrix. Reported so a null result cannot be read as "no effect"
				when it was really "most of the set was never tested". */
				genesNotInDE: [...hitSet].filter(g => !lenOf.has(g) || !genes.some(x => x.gene == g)).length,
				/** hit genes reaching DE significance on their own, and how many of those went down */
				sigCount: sigHits.length,
				sigDown: downSig,
				/** the most significant of them, capped; sigCount carries the true total */
				topGenes: sigHits.sort((a, b) => a.p - b.p || a.fc - b.fc).slice(0, MAX_TOP_GENES)
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
