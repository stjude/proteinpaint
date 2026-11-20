import type { RouteApi, RoutePayload, ActivePathwaysRequest, ActivePathwaysResponse } from '#types'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { formatElapsedTime } from '#shared'
import { mayLog } from '#src/helpers.ts'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { scanBodyDeltas, datasetGeneMedians, levelResiduals } from '#src/routes/genesetEnrichment.ts'
import { layeredPathways, chiSquareLogSf } from '#src/utils/directionalPathways.ts'
import { validGeneSetGroup } from '#src/utils/genesetGroups.ts'

/* ActivePathways on two groups: gene sets tested on expression alone, on gene-body methylation alone, and on the two
merged per gene by directional P-value merging (DPM, Slobodyanyuk et al. 2024) with the constraint that they move the
same way, as gene-body methylation follows transcription; ranked hypergeometric enrichment and BH as ActivePathways
(Paczkowska et al. 2020). See server/src/utils/directionalPathways.ts.

Nothing is fitted here that is not already cached: the expression layer is the DE run of the request's deRequest (its
p-value and the sign of its fold change), and the gene-body layer the DMR scan's gene-body delta-beta (dmRequest, see
scanBodyDeltas). A gene-body delta has no p-value of its own, so the layer's p is how far the gene stands out from the
other genes: its z-score among genes of the same expression level (levelResiduals; with adjust_expression_level off,
among all genes), two-sided. Genes without both layers are left out of every layer, so the three share one background. */

const payload: RoutePayload = {
	init,
	request: { typeId: undefined },
	response: { typeId: undefined }
} as any as RoutePayload

export const api: RouteApi = {
	endpoint: 'termdb/activePathways',
	methods: {
		get: payload,
		post: payload
	}
}

/** genes at or below this p enter each layer's ranked list (ActivePathways' default is 0.1) */
const CUTOFF = 0.05
const SIZES: [number, number] = [10, 500]
/** sets listed: q below this in some layer */
const LIST_Q = 0.05

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			res.send(await getActivePathways(req.query as ActivePathwaysRequest, genomes))
		} catch (e: any) {
			// code: CACHE_BUSY when a run it needs is underway, which the client retries
			res.send({ error: e?.message || String(e), code: e?.code })
			if (e?.stack) console.log(e.stack)
		}
	}
}

async function getActivePathways(q: ActivePathwaysRequest, genomes: any): Promise<ActivePathwaysResponse> {
	const t0 = Date.now()
	const genome = genomes[q.genome]
	if (!genome) throw new Error('unknown genome')
	if (!genome.datasets?.[q.dslabel]) throw new Error('unknown ds')
	validGeneSetGroup(genome, q.geneSetGroup)
	if (q.dmRequest?.element_type !== DMR_SCAN_ELEMENT_TYPE) throw new Error('dmRequest must be a DMR scan')
	// both analyses run on this request's dataset, whatever their own requests name
	const own = { genome: q.genome, dslabel: q.dslabel, __protected__: q.__protected__ }
	const { result } = await getDeCacheResult({ ...q.deRequest, ...own } as any, genomes)
	const deltas = await scanBodyDeltas({ ...q.dmRequest, ...own }, genomes)

	const names = Object.keys(deltas)
	const meth = levelResiduals(
		names,
		names.map(g => deltas[g]),
		await datasetGeneMedians(q, genomes),
		q.adjust_expression_level ? undefined : 1
	)
	const zOf = new Map(meth.genes.map((g, i) => [g, meth.z[i]]))
	const genes: string[] = []
	const p: number[][] = []
	const direction: number[][] = []
	for (const r of (result as any)?.geneRows || []) {
		const z = zOf.get(r.gene_name)
		if (z == undefined || !Number.isFinite(r.original_p_value) || !Number.isFinite(r.fold_change)) continue
		genes.push(r.gene_name)
		// two-sided normal p of z, as z^2 is chi-square with 1 df
		p.push([r.original_p_value, Math.exp(chiSquareLogSf(z * z, 1))])
		direction.push([Math.sign(r.fold_change), Math.sign(z)])
	}
	if (!genes.length) throw new Error('No gene had both an expression and a gene-body methylation value.')
	const r = layeredPathways({
		genes,
		p,
		direction,
		constraints: [1, 1],
		sets: geneSets(genome, q.geneSetGroup),
		cutoff: CUTOFF,
		sizeRange: SIZES
	})
	const sig = Math.log10(LIST_Q)
	mayLog(`activePathways: ${genes.length} genes, ${r.sets.length} sets,`, formatElapsedTime(Date.now() - t0))
	return {
		geneSetGroup: q.geneSetGroup,
		genes: genes.length,
		tested: r.sets.length,
		passing: r.passing as [number, number, number],
		brown: r.brown,
		sets: r.sets
			.filter(s => s.layers.some(l => l.log10q < sig))
			.map(s => ({ ...s, layers: s.layers as any, genes: s.genes.slice(0, 30) }))
	}
}

/** the gene symbols of every set of an msigdb group */
function geneSets(genome: any, group: string): Record<string, string[]> {
	const db = genome.termdbs.msigdb.cohort.db.connection
	const genesOf = db.prepare('select genes from term2genes where id=?')
	const sets: Record<string, string[]> = {}
	for (const { id } of db.prepare('select id from terms where parent_id=?').all(group)) {
		const row = genesOf.get(id)
		if (row) sets[id] = JSON.parse(row.genes).map((g: any) => g.symbol)
	}
	return sets
}
