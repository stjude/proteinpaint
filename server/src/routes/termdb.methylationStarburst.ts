import type { RoutePayload, RouteApi, MethylationStarburstRequest, MethylationStarburstResponse } from '#types'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { getGeneBodyDeltas } from '#src/routes/termdb.geneBodyMeth.ts'
import { scanChromosomes } from '../../routes/termdb.diffMeth.ts'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { resolveGroups } from '#src/utils/sampleGroups.ts'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'

/* Methylation change against expression change, one point per gene, for the two groups of a volcano: the
starburst plot (Noushmehr 2010, PMID 20399149). Two regions per gene, the core promoter and the body, because
they relate to transcription in opposite ways.

Nothing here is new computation. Δβ per region is termdb/geneBodyMeth's mean delta over the region (raw, or its
excess over matched background), and the fold change is the DE run the volcano would make on the same patients:
both cached, so this joins them. The response holds gene-level values only. */

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
	const t0 = Date.now()

	/* Both axes from the same samples: each group cut to the samples that have methylation AND expression. Cut
	to methylation only (as termdb/dmrGeneDE does), DE drops the samples without RNA by itself while the methylation
	keeps them, which on MMRF is 312 vs 45 against 276 vs 41 for a t(4;14) contrast. */
	const rna: Set<string> | undefined = ds.queries?.rnaseqGeneCount?.allSampleSet
	if (!rna) throw new Error('This dataset has no gene expression counts.')
	const both = new Set([...eligibleMethylationSamples(ds, undefined)].filter(n => rna.has(n)))
	const samplelst = await matchedSamplelst({ groups: await resolveGroups(groups, q, ds) }, both, ds, q.__protected__)

	// major chromosomes less chrM, which has no CpG shard
	const chromosomes = scanChromosomes({ exclude_sex_chr: q.excludeSexChr } as any, genome)
	const deltas = (region?: 'promoter') =>
		getGeneBodyDeltas(
			{
				genome: q.genome,
				dslabel: q.dslabel,
				group1: samplelst.groups[0].values,
				group2: samplelst.groups[1].values,
				corrected: !!q.corrected,
				chromosomes,
				region,
				__protected__: q.__protected__
			},
			genomes
		)
	// one after the other: each is a genome-wide rust fit admitted against server memory
	const body = await deltas()
	const promoter = await deltas('promoter')

	const { result } = await getDeCacheResult(
		{
			genome: q.genome,
			dslabel: q.dslabel,
			samplelst,
			min_count: q.min_count ?? 10,
			min_total_count: q.min_total_count ?? 15,
			cpm_cutoff: q.cpm_cutoff,
			method: q.method,
			// part of the DE cache key: sent so this run and the volcano's are one entry
			filter: q.filter,
			filter0: q.filter0,
			__protected__: q.__protected__
		} as any,
		genomes
	)
	const out = {
		genes: [] as string[],
		log2fc: [] as number[],
		q: [] as number[],
		promoter: [] as (number | null)[],
		body: [] as (number | null)[]
	}
	for (const r of (result as any)?.geneRows || []) {
		const p = promoter[r.gene_name] ?? null
		const b = body[r.gene_name] ?? null
		if ((p == null && b == null) || !Number.isFinite(r.fold_change)) continue
		out.genes.push(r.gene_name)
		out.log2fc.push(r.fold_change)
		out.q.push(r.adjusted_p_value ?? r.original_p_value ?? 1)
		out.promoter.push(p)
		out.body.push(b)
	}
	if (!out.genes.length) throw new Error('No gene had both a methylation value and a fold change.')
	mayLog(`methylationStarburst: ${out.genes.length} genes,`, formatElapsedTime(Date.now() - t0))
	return {
		...out,
		sampleSize1: (result as any)?.sample_size1,
		sampleSize2: (result as any)?.sample_size2,
		deMethod: (result as any)?.method,
		corrected: !!q.corrected
	}
}
