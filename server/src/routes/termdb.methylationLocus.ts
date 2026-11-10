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
import { resolveGroups, buildGroupValues, readableSamples } from '#src/utils/sampleGroups.ts'
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
// largest q.region read; a wider one would pull every CpG of a chromosome arm for 40 columns
const MAX_REGION = 2_000_000
const MAX_BINS = 300
const emptyFilter = { type: 'tvslst', in: true, join: '', lst: [] }
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
	let gm, models, unit
	if (q.gene !== undefined) {
		if (typeof q.gene != 'string' || !q.gene) throw new Error('invalid gene')
		if (!ds.queries?.geneExpression) throw new Error('This dataset has no gene expression data')
		unit = ds.queries.geneExpression.unit || 'expression'
		models = genome.genedb.getjsonbyname
			.all(q.gene)
			.map(r => ({ ...JSON.parse(r.genemodel), isdefault: !!r.isdefault }))
		if (!models.length) throw new Error(`Unknown gene: ${q.gene}`)
		// the requested isoform, else the default one; expression stays gene-level either way
		gm = q.isoform ? models.find(g => g.isoform == q.isoform) : models.find(g => g.isdefault) || models[0]
		if (!gm) throw new Error(`Unknown isoform of ${q.gene}: ${q.isoform}`)
	} else if (!q.region) throw new Error('gene or region is required')
	const region = q.region
		? validateRegion(q.region, genome)
		: { chr: gm.chr, start: Math.max(0, gm.start - FLANK), stop: gm.stop + FLANK }
	const m = resolveMethylationMatrix(ds, region.chr, undefined)
	if (m.useElement) throw new Error(`No CpG-level methylation data on ${region.chr}`)
	const nbins = q.nbins === undefined ? NBINS : q.nbins
	if (!Number.isInteger(nbins) || nbins < 1 || nbins > MAX_BINS) throw new Error('invalid nbins')

	const sample2group = await getSampleGroups(q, ds, m.eligible)
	const samples: { name: string; value?: number; group?: string }[] = []
	const add = (name: string, value?: number) => {
		if (!m.eligible.has(name)) return
		const group = sample2group.get(name)
		samples.push({ name, ...(value === undefined ? {} : { value }), ...(group === undefined ? {} : { group }) })
	}
	if (q.gene) {
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
		for (const [sid, d] of Object.entries(data.samples as Record<string, any>)) {
			const value = d[exprTw.$id]?.value
			if (Number.isFinite(value)) add(ds.cohort.termdb.q.id2sampleName(Number(sid)), value)
		}
		samples.sort((a, b) => a.value! - b.value!)
	} else {
		/* no gene: the samples that pass the filter, listed as the samples of a group defined by a filter
		are, which works with and without a sample db and maps parents to children as above. isFilterGroup()
		needs a filter object, so a request with only a filter0 gets an empty one. */
		if (q.filter?.lst?.length || q.filter0) {
			const [all] = await resolveGroups(
				[{ name: 'all', filter: q.filter || emptyFilter, mapParent2Children: true }],
				q,
				ds
			)
			const { names } = await buildGroupValues(all.values, m.eligible, ds, null, null, null, null, q.__protected__)
			for (const n of names) add(n)
		} else {
			// nothing to filter by: every eligible sample that the request may read
			for (const n of await readableSamples(m.eligible, ds, q.__protected__)) add(n)
		}
	}
	if (samples.length < minArrayLength)
		throw new Error(`Too few samples with methylation${q.gene ? ' and expression' : ''} data`)

	const input = {
		h: m.matrixFile,
		s: samples.map(s => s.name).join(','),
		q: `${region.chr}:${region.start}-${region.stop}`,
		bins: nbins
	}
	let bins: MethylationLocusBin[]
	try {
		bins = JSON.parse(await run_python('query_beta_values.py', JSON.stringify(input))).bins
	} catch (e: any) {
		// the script exits with this when the range has no CpG, e.g. a view zoomed in between two
		if (!String(e?.message || e).includes('No DNA methylation data for the provided range')) throw e
		bins = []
	}

	if (!q.gene) return { region, samples, ...groupsOf(q, samples), bins }
	const withValue = samples as { value: number; group?: string }[]

	for (const [i, r] of (await correlateBins(bins, withValue, () => true)).entries()) {
		if (r) Object.assign(bins[i], r)
	}

	/* rho within each group as well: across all samples, a difference between the groups in both
	methylation and expression gives a strong rho in every bin even when neither moves with the
	other inside a group (e.g. NSD2 across t(4;14)), and the per-group rho tells the two apart */
	const { groups = [] } = groupsOf(q, samples)
	for (const group of groups) {
		const byBin = await correlateBins(bins, withValue, s => s.group === group)
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
		unit,
		samples,
		...groupsOf(q, samples),
		bins
	}
}

// the requested groups that have samples, in request order
function groupsOf(q: MethylationLocusRequest, samples: { group?: string }[]): { groups?: string[] } {
	const groups = [...new Set((groupOrder(q) || []).filter(g => samples.some(s => s.group === g)))]
	return groups.length ? { groups } : {}
}

// the chr goes into the python query string, so it must be one of the genome's
function validateRegion(r: { chr: string; start: number; stop: number }, genome: any) {
	const chr = typeof r?.chr == 'string' && genome.chrlookup[r.chr.toUpperCase()]?.name
	if (!chr) throw new Error('invalid region.chr')
	if (!Number.isInteger(r.start) || !Number.isInteger(r.stop) || r.start < 0 || r.stop <= r.start)
		throw new Error('invalid region start/stop')
	if (r.stop - r.start > MAX_REGION) throw new Error(`Zoom in to under ${MAX_REGION / 1e6} Mb to show methylation`)
	return { chr, start: r.start, stop: r.stop }
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
