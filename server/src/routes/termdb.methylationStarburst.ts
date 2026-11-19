import type { RoutePayload, RouteApi, MethylationStarburstRequest, MethylationStarburstResponse } from '#types'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { getGeneBodyDeltas } from '#src/routes/termdb.geneBodyMeth.ts'
import { scanChromosomes } from '../../routes/termdb.diffMeth.ts'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { resolveGroups, samplesOfRequest } from '#src/utils/sampleGroups.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime, stripAccessionVersion } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'
import { ISOFORM_EXPRESSION } from '#types'

/* Methylation change against expression change, one point per transcript, for the two groups of a volcano: the
starburst plot (Noushmehr 2010, PMID 20399149). Two regions per transcript, its own core promoter and its own body,
because they relate to transcription in opposite ways, and a gene with an alternative promoter shows as several points.

Nothing here is new computation. Δβ per region is termdb/geneBodyMeth's mean delta over the transcript's region, and the fold change is the isoform DE run (ds.queries.isoformExpressionCount)
the isoform volcano would make on the same patients: both cached, so this joins them. Only for a dataset with
transcript counts: there is no gene-level version. */

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
	if (!ds.queries?.isoformExpressionCount) throw new Error('This dataset has no transcript expression counts.')
	const t0 = Date.now()

	/* Both axes from the same samples: each group cut to the samples that have methylation AND expression. Cut
	to methylation only, DE drops the samples without RNA by itself while the methylation keeps them, which on MMRF is
	312 vs 45 against 276 vs 41 for a t(4;14) contrast. */
	const rna: Set<string> | undefined = ds.queries.isoformExpressionCount.allSampleSet
	if (!rna) throw new Error('This dataset has no transcript expression samples.')
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
			termType: ISOFORM_EXPRESSION,
			// part of the DE cache key: sent so this run and the volcano's are one entry
			filter: q.filter,
			filter0: q.filter0,
			__protected__: q.__protected__
		} as any,
		genomes
	)
	const rows: any[] = (result as any)?.geneRows || []
	// the methylation side is keyed by unversioned upper-case id (termdb/geneBodyMeth isoformLoci); the response keeps the
	// DE run's own id
	const idOf = (r: any) => stripAccessionVersion(String(r.gene_name)).toUpperCase()
	// the transcripts the DE run tested; the gene-body cache key includes this list
	const isoforms = rows.map(idOf)
	const deltas = (region?: 'promoter') => getGeneBodyDeltas({ ...groupArgs, region, isoforms }, genomes)
	// one after the other: each is a genome-wide rust run admitted against server memory
	const body = await deltas()
	const promoter = await deltas('promoter')

	const out = {
		genes: [] as string[],
		// the transcript of each point; genes[] holds its gene
		isoforms: [] as string[],
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
		out.genes.push(r.gene || idOf(r))
		// as the DE run reports it, with any version suffix: the isoform expression term of the volcano's rows uses the same
		out.isoforms.push(r.gene_name)
		out.log2fc.push(r.fold_change)
		out.q.push(r.adjusted_p_value ?? r.original_p_value ?? 1)
		out.promoter.push(p)
		out.body.push(b)
	}
	if (!out.genes.length) throw new Error('No transcript had both a methylation value and a fold change.')
	mayLog(`methylationStarburst: ${out.genes.length} transcripts,`, formatElapsedTime(Date.now() - t0))
	return {
		...out,
		sampleSize1: (result as any)?.sample_size1,
		sampleSize2: (result as any)?.sample_size2,
		deMethod: (result as any)?.method
	}
}
