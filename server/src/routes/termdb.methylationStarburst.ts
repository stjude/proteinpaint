import type {
	RoutePayload,
	RouteApi,
	MethylationStarburstRequest,
	MethylationStarburstResponse,
	StarburstPathways
} from '#types'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { getGeneBodyDeltas, getGeneBodyTests, type GeneBodyTest } from '#src/routes/termdb.geneBodyMeth.ts'
import { layeredPathways } from '#src/utils/directionalPathways.ts'
import { validGeneSetGroup } from '#src/utils/genesetGroups.ts'
import { scanChromosomes } from '../../routes/termdb.diffMeth.ts'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { resolveGroups, samplesOfRequest } from '#src/utils/sampleGroups.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'
import { ISOFORM_EXPRESSION } from '#types'

/* Methylation change against expression change, one point per gene, for the two groups of a volcano: the
starburst plot (Noushmehr 2010, PMID 20399149). Two regions per gene, the core promoter and the body, because
they relate to transcription in opposite ways.

Nothing here is new computation. Δβ per region is termdb/geneBodyMeth's mean delta over the region (raw, or its
excess over matched background), and the fold change is the DE run the volcano would make on the same patients:
both cached, so this joins them. The response holds gene-level values only.

With byIsoform, one point per transcript instead: the fold change of the isoform DE run (ds.queries.isoformExpressionCount)
against the transcript's own core promoter and body (termdb/geneBodyMeth with isoforms). A gene with an alternative
promoter shows as several points, which the gene-level plot averages away. Gene sets are not tested then: they are
gene-level.

With a gene set group, it also tests gene sets on each layer and on the two merged, see getPathways(). */

export const payload: RoutePayload = {
	// only set up when at least one ds has ds.queries.dnaMethylation, see termdb.diffMeth.ts
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
	request: { typeId: 'MethylationStarburstRequest' },
	response: { typeId: 'MethylationStarburstResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/methylationStarburst',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			res.send(await getStarburst(req.query as MethylationStarburstRequest, genomes))
		} catch (e: any) {
			res.send({ error: e?.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function getStarburst(q: MethylationStarburstRequest, genomes: any): Promise<MethylationStarburstResponse> {
	const genome = genomes[q.genome]
	if (!genome) throw new Error('unknown genome')
	const ds = genome.datasets?.[q.dslabel]
	if (!ds) throw new Error('unknown dataset')
	const groups = q.samplelst?.groups
	if (groups?.length != 2) throw new Error('Two sample groups are required.')
	const byIsoform = !!q.byIsoform
	if (byIsoform && !ds.queries?.isoformExpressionCount)
		throw new Error('This dataset has no transcript expression counts.')
	if (byIsoform && q.geneSetGroup) throw new Error('Gene sets are tested by gene, not by isoform.')
	// before the genome-wide runs below
	if (q.geneSetGroup) validGeneSetGroup(genome, q.geneSetGroup)
	const t0 = Date.now()

	/* Both axes from the same samples: each group cut to the samples that have methylation AND expression. Cut
	to methylation only (as termdb/dmrGeneDE does), DE drops the samples without RNA by itself while the methylation
	keeps them, which on MMRF is 312 vs 45 against 276 vs 41 for a t(4;14) contrast. */
	const rna: Set<string> | undefined = (byIsoform ? ds.queries.isoformExpressionCount : ds.queries?.rnaseqGeneCount)
		?.allSampleSet
	if (!rna) throw new Error('This dataset has no gene expression counts.')
	const eligible = new Set([...eligibleMethylationSamples(ds, undefined)].filter(n => rna.has(n)))
	// of those, the samples that the request's filter leaves, as the methylation track shows them
	const both = new Set(await samplesOfRequest(q, ds, eligible))
	const samplelst = await matchedSamplelst({ groups: await resolveGroups(groups, q, ds) }, both, ds, q.__protected__)

	// major chromosomes less chrM, which has no CpG shard
	const chromosomes = scanChromosomes({ exclude_sex_chr: q.excludeSexChr } as any, genome)
	const groupArgs = {
		genome: q.genome,
		dslabel: q.dslabel,
		group1: samplelst.groups[0].values,
		group2: samplelst.groups[1].values,
		chromosomes,
		__protected__: q.__protected__
	}
	const { result } = await getDeCacheResult(
		{
			genome: q.genome,
			dslabel: q.dslabel,
			samplelst,
			min_count: q.min_count ?? 10,
			min_total_count: q.min_total_count ?? 15,
			cpm_cutoff: q.cpm_cutoff,
			method: q.method,
			// transcripts instead of genes; left out for genes, so the gene run's cache key is unchanged
			termType: byIsoform ? ISOFORM_EXPRESSION : undefined,
			// part of the DE cache key: sent so this run and the volcano's are one entry
			filter: q.filter,
			filter0: q.filter0,
			__protected__: q.__protected__
		} as any,
		genomes
	)
	// with byIsoform, the transcripts the DE run tested, without the version suffix the gene table leaves out
	const rows: any[] = (result as any)?.geneRows || []
	const idOf = (r: any) => (byIsoform ? String(r.gene_name).replace(/\.\d+$/, '') : r.gene_name)
	const isoforms = byIsoform ? rows.map(idOf) : undefined
	const deltas = (region?: 'promoter') =>
		getGeneBodyDeltas({ ...groupArgs, corrected: !!q.corrected, region, isoforms }, genomes)
	// one after the other: each is a genome-wide rust run admitted against server memory
	const body = await deltas()
	const promoter = await deltas('promoter')
	const tests = q.geneSetGroup ? await getGeneBodyTests(groupArgs, genomes) : null

	const out = {
		genes: [] as string[],
		// with byIsoform, the transcript of each point; genes[] then holds its gene
		isoforms: byIsoform ? ([] as string[]) : undefined,
		log2fc: [] as number[],
		q: [] as number[],
		promoter: [] as (number | null)[],
		body: [] as (number | null)[]
	}
	for (const r of rows) {
		const p = promoter[idOf(r)] ?? null
		const b = body[idOf(r)] ?? null
		if ((p == null && b == null) || !Number.isFinite(r.fold_change)) continue
		// a transcript the gene annotation does not name keeps its id as its gene
		out.genes.push(byIsoform ? r.gene || idOf(r) : r.gene_name)
		out.isoforms?.push(idOf(r))
		out.log2fc.push(r.fold_change)
		out.q.push(r.adjusted_p_value ?? r.original_p_value ?? 1)
		out.promoter.push(p)
		out.body.push(b)
	}
	if (!out.genes.length)
		throw new Error(`No ${byIsoform ? 'transcript' : 'gene'} had both a methylation value and a fold change.`)
	const pathways = tests ? getPathways(genome, q.geneSetGroup!, rows, tests) : undefined
	mayLog(
		`methylationStarburst: ${out.genes.length} ${byIsoform ? 'transcripts' : 'genes'},`,
		formatElapsedTime(Date.now() - t0)
	)
	return {
		...out,
		sampleSize1: (result as any)?.sample_size1,
		sampleSize2: (result as any)?.sample_size2,
		deMethod: (result as any)?.method,
		corrected: !!q.corrected,
		pathways
	}
}

/** genes at or below this p enter each layer's ranked list, as main H of the MMRF subtype figure; ActivePathways
 * defaults to 0.1 */
const PATHWAY_CUTOFF = 0.05
const PATHWAY_SIZES: [number, number] = [10, 500]

/* Gene sets tested on expression alone, on gene-body methylation alone, and on the two merged per gene by directional
P-value merging with the constraint that they move the same way, as gene-body methylation follows transcription
(Köhnke et al. 2026 drew ActivePathways' three this way; they merged promoter DMRs with the opposite constraint).
Expression: the DE p and the sign of the fold change. Gene body: the per-patient test of termdb/geneBodyMeth
(getGeneBodyTests: each patient's gene-body beta, centered on their median body, Welch's t between the groups), its p
and the sign of t. Genes without both are left out of every layer, so the three share one background. */
function getPathways(
	genome: any,
	geneSetGroup: string,
	deRows: any[],
	meth: Record<string, GeneBodyTest>
): StarburstPathways {
	const db = genome.termdbs.msigdb.cohort.db.connection
	const genesOf = db.prepare('select genes from term2genes where id=?')
	const sets: Record<string, string[]> = {}
	for (const { id } of db.prepare('select id from terms where parent_id=?').all(geneSetGroup)) {
		const row = genesOf.get(id)
		if (row) sets[id] = JSON.parse(row.genes).map((g: any) => g.symbol)
	}
	const genes: string[] = []
	const p: number[][] = []
	const direction: number[][] = []
	for (const r of deRows) {
		const m = meth[r.gene_name]
		if (!m || !Number.isFinite(r.original_p_value) || !Number.isFinite(r.fold_change)) continue
		genes.push(r.gene_name)
		p.push([r.original_p_value, m.p])
		direction.push([Math.sign(r.fold_change), Math.sign(m.t)])
	}
	if (!genes.length) throw new Error('No gene had both a gene-body p-value and an expression p-value.')
	const r = layeredPathways({
		genes,
		p,
		direction,
		constraints: [1, 1],
		sets,
		cutoff: PATHWAY_CUTOFF,
		sizeRange: PATHWAY_SIZES
	})
	const sig = Math.log10(0.05)
	return {
		geneSetGroup,
		genes: genes.length,
		tested: r.sets.length,
		passing: r.passing as [number, number, number],
		brown: r.brown,
		sets: r.sets
			.filter(s => s.layers.some(l => l.log10q < sig))
			.map(s => ({ ...s, layers: s.layers as StarburstPathways['sets'][0]['layers'], genes: s.genes.slice(0, 30) }))
	}
}
