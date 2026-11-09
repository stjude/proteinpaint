import type {
	RoutePayload,
	RouteApi,
	MethylationLocusRequest,
	MethylationLocusResponse,
	MethylationLocusBin
} from '#types'
import { getData } from '#src/termdb.matrix.js'
import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { resolveMethylationMatrix } from '#src/utils/methylationMatrix.ts'
import { resolveGroups, buildGroupValues } from '#src/utils/sampleGroups.ts'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { getStdDev } from './termdb.descrstats.ts'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'
import { genomes } from '#src/initGenomesDs.js'

/* Per-sample CpG methylation along one gene, next to that gene's expression in the same samples.

The locus is the requested isoform (default: the gene's default isoform) with FLANK bp on each side, cut into NBINS runs of equal CpG
count (query_beta_values.py, bins mode). A bin value is pooled methylated reads over pooled reads for
the sample, so a deeply covered CpG weighs more than a thin one. Each bin is then correlated with
expression across samples (Spearman, rust corr, BH-adjusted across bins).

Samples come from getData() with the request's filter, as for termdb/matrix, then are limited to the
ones eligible for CpG methylation. The response names samples, so it requires canDisplaySampleIds(). */

const FLANK = 5000
const NBINS = 40
// a bin needs this many samples with a value to be correlated, as in correlationVolcano
const minArrayLength = 3

export const payload: RoutePayload = {
	// only set up when at least one ds has ds.queries.dnaMethylation, see termdb.diffMeth.ts
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
	request: { typeId: 'MethylationLocusRequest' },
	response: { typeId: 'MethylationLocusResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/methylationLocus',
	middlewares: [protectedRoutes.termdb, protectedRoutes.samples, protectedRoutes.minSampleSize],
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: MethylationLocusRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid dslabel')
			if (!authApi.canDisplaySampleIds(req, ds)) throw new Error('Requires sign in to access the sample data')
			const result: MethylationLocusResponse = await getLocus(q, ds, genome)
			res.send(result)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.error(e)
		}
	}
}

async function getLocus(q: MethylationLocusRequest, ds: any, genome: any): Promise<MethylationLocusResponse> {
	const ge = ds.queries?.geneExpression
	if (!ge) throw new Error('This dataset has no gene expression data')
	if (typeof q.gene != 'string' || !q.gene) throw new Error('gene missing')
	const models = genome.genedb.getjsonbyname
		.all(q.gene)
		.map(r => ({ ...JSON.parse(r.genemodel), isdefault: !!r.isdefault }))
	if (!models.length) throw new Error(`Unknown gene: ${q.gene}`)
	// the requested isoform, else the default one; expression stays gene-level either way
	const gm = q.isoform ? models.find(g => g.isoform == q.isoform) : models.find(g => g.isdefault) || models[0]
	if (!gm) throw new Error(`Unknown isoform of ${q.gene}: ${q.isoform}`)
	const m = resolveMethylationMatrix(ds, gm.chr, undefined)
	if (m.useElement) throw new Error(`No CpG-level methylation data on ${gm.chr}`)
	const region = {
		chr: gm.chr,
		start: Math.max(0, gm.start - FLANK),
		stop: gm.stop + FLANK
	}

	const exprTw = {
		$id: 'expression',
		term: { type: 'geneExpression', gene: q.gene, name: q.gene },
		q: { mode: 'continuous' }
	}
	// true: map parent annotations to child samples, as the differential analyses do (resolveDaContext)
	const data = await getData(
		{
			filter: q.filter,
			filter0: q.filter0,
			terms: [exprTw],
			__protected__: q.__protected__
		},
		ds,
		true
	)
	if (data.error) throw new Error(data.error)
	const sample2group = await getSampleGroups(q, ds, m.eligible)

	const samples: { name: string; value: number; group?: string }[] = []
	for (const [sid, d] of Object.entries(data.samples as Record<string, any>)) {
		const value = d[exprTw.$id]?.value
		if (!Number.isFinite(value)) continue
		const name = ds.cohort.termdb.q.id2sampleName(Number(sid))
		if (!m.eligible.has(name)) continue
		const s: { name: string; value: number; group?: string } = { name, value }
		const group = sample2group.get(name)
		if (group !== undefined) s.group = group
		samples.push(s)
	}
	if (samples.length < minArrayLength) throw new Error(`Too few samples with both methylation and expression data`)
	samples.sort((a, b) => a.value - b.value)

	const input = {
		h: m.matrixFile,
		s: samples.map(s => s.name).join(','),
		q: `${region.chr}:${region.start}-${region.stop}`,
		bins: NBINS
	}
	const bins: MethylationLocusBin[] = JSON.parse(await run_python('query_beta_values.py', JSON.stringify(input))).bins

	for (const [i, r] of (await correlateBins(bins, samples, () => true)).entries()) {
		if (r) Object.assign(bins[i], r)
	}

	/* rho within each group as well: across all samples, a difference between the groups in both
	methylation and expression gives a strong rho in every bin even when neither moves with the
	other inside a group (e.g. NSD2 across t(4;14)), and the per-group rho tells the two apart */
	const groups = [...new Set((groupOrder(q) || []).filter(g => samples.some(s => s.group === g)))]
	for (const group of groups) {
		const byBin = await correlateBins(bins, samples, s => s.group === group)
		bins.forEach((b, i) => {
			if (!b.byGroup) b.byGroup = []
			b.byGroup.push({ group, ...(byBin[i] || {}) })
		})
	}

	// whole gene models, which the client draws (sketchGene) and lists (isoformSelect)
	return {
		gene: gm,
		isoforms: models,
		region,
		unit: ge.unit || 'expression',
		samples,
		...(groups.length ? { groups } : {}),
		bins
	}
}

/* Spearman rho of each bin's beta against expression, over the samples that pick() keeps, with BH
across the bins (rust corr). A bin without enough values or without variance gets undefined. */
async function correlateBins(
	bins: MethylationLocusBin[],
	samples: { value: number; group?: string }[],
	pick: (s: { value: number; group?: string }) => boolean
): Promise<({ rho: number; q: number } | undefined)[]> {
	const terms: { id: string; v1: number[]; v2: number[] }[] = []
	bins.forEach((b, i) => {
		const v1: number[] = [],
			v2: number[] = []
		b.beta.forEach((beta, j) => {
			if (beta === null || !pick(samples[j])) return
			v1.push(beta)
			v2.push(samples[j].value)
		})
		if (v1.length >= minArrayLength && getStdDev(v1) > 0 && getStdDev(v2) > 0) terms.push({ id: String(i), v1, v2 })
	})
	const result: ({ rho: number; q: number } | undefined)[] = bins.map(() => undefined)
	if (!terms.length) return result
	const out = JSON.parse(await run_rust('corr', JSON.stringify({ method: 'spearman', terms })))
	// corr gives null where R gives NA; the checks above should prevent it, and such a bin gets no rho
	for (const t of out)
		if (t.correlation !== null && t.adjusted_p_value !== null)
			result[Number(t.id)] = { rho: t.correlation, q: t.adjusted_p_value }
	return result
}

// group names in the order of the request's groups: the first is the reference of a two-group difference
function groupOrder(q: MethylationLocusRequest): string[] | undefined {
	const groups = (q.groupTw as any)?.q?.groups
	return Array.isArray(groups) ? groups.filter(g => g.in !== false).map(g => g.name) : undefined
}

/* Each sample's group, resolved as the two-group analyses resolve their groups: a group defined by
a filter is listed (resolveGroups), and on a dataset with sample ancestry a patient in a group stands
for its samples (buildGroupValues). Reading the samplelst term through getData() instead labels only
the ids the groups list, so groups of patients would label no sample. */
async function getSampleGroups(q: MethylationLocusRequest, ds: any, eligible: Set<string>) {
	const sample2group = new Map<string, string>()
	const groups = (q.groupTw as any)?.q?.groups
	if (!Array.isArray(groups)) return sample2group
	for (const g of await resolveGroups(groups, q, ds)) {
		if (g.in === false || !Array.isArray(g.values)) continue
		const { names } = await buildGroupValues(g.values, eligible, ds, null, null, null, null, q.__protected__)
		for (const n of names) if (!sample2group.has(n)) sample2group.set(n, g.name)
	}
	return sample2group
}
