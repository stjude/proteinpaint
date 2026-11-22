import type {
	RoutePayload,
	RouteApi,
	MethylationLocusRequest,
	MethylationLocusResponse,
	MethylationLocusBin,
	MethylationLocusSample
} from '#types'
import { getData } from '#src/termdb.matrix.js'
import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { resolveMethylationMatrix } from '#src/utils/methylationMatrix.ts'
import { resolveGroups, buildGroupValues, samplesOfRequest } from '#src/utils/sampleGroups.ts'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { readTabixLines } from '#src/utils.js'
import { chiSquareLogSf, logBH } from '#src/utils/pValues.ts'
import { getStdDev } from './termdb.descrstats.ts'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'
import { genomes } from '#src/initGenomesDs.js'

/* Per-sample CpG methylation along one gene, next to that gene's expression in the same samples.

The locus is the requested isoform (default: the gene's default isoform) with FLANK bp on each side, cut into NBINS runs of equal CpG
count (query_beta_values.py, bins mode). A bin value is pooled methylated reads over pooled reads for
the sample, so a deeply covered CpG weighs more than a thin one. Each bin is then correlated with
expression across samples (Spearman, rust corr, BH-adjusted across bins). With groups, each group's rho is also
pooled into one rho within the groups (poolWithinGroups). On a dataset with isoform expression, each sample also has
the expression of each of the gene's isoforms, for the makeup of the gene's expression by isoform.

Samples come from getData() with the request's filter, as for termdb/matrix, then are limited to the
ones eligible for CpG methylation. The response names samples, so it requires canDisplaySampleIds(). */

const FLANK = 5000
const NBINS = 40
// largest q.region read; a wider one would pull every CpG of a chromosome arm for 40 columns
const MAX_REGION = 2_000_000
const MAX_BINS = 300
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
	const samples: MethylationLocusSample[] = []
	// the sample types chosen in the genome browser, when the dataset has sample types
	if (q.sampleTypes != null && !Array.isArray(q.sampleTypes)) throw new Error('sampleTypes must be an array')
	const types = ds.sampleId2Type?.size && q.sampleTypes?.length ? new Set(q.sampleTypes.map(Number)) : undefined
	const add = (name: string, value?: number) => {
		if (!m.eligible.has(name)) return
		if (types && !types.has(ds.sampleId2Type.get(ds.cohort.termdb.q.sampleName2id(name)))) return
		const group = sample2group?.get(name)
		// with groups, the view is their comparison: a sample in none of them is left out
		if (sample2group && group === undefined) return
		samples.push({ name, ...(value === undefined ? {} : { value }), ...(group === undefined ? {} : { group }) })
	}
	let expressed: string[] | undefined
	let junctions: { keys: [number, number][]; first: (number | null)[]; reference: number } | undefined
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
				__protected__: q.__protected__,
				sampleMapping: 'parentToChildren'
			},
			ds
		)
		if (data.error) throw new Error(data.error)
		const name2id = new Map<string, string>()
		for (const [sid, d] of Object.entries(data.samples as Record<string, any>)) {
			const value = d[exprTw.$id]?.value
			if (!Number.isFinite(value)) continue
			const name = ds.cohort.termdb.q.id2sampleName(Number(sid))
			add(name, value)
			name2id.set(name, sid)
		}
		if (q.annotationTw) await annotateSamples(q, ds, samples, name2id)
		const isoforms = await getIsoformValues(ds, models, gm.chr, new Set(samples.map(s => name2id.get(s.name)!)))
		if (isoforms) {
			expressed = isoforms.ids
			for (const s of samples) s.isoformValues = isoforms.values(name2id.get(s.name)!)
			// the junction reads of the isoforms: evidence of their starts that does not depend on assigning reads to
			// transcripts that share most of their exons
			const j = await getJunctionReads(
				ds,
				models,
				expressed,
				samples.map(s => name2id.get(s.name)!)
			)
			if (j) {
				junctions = j.junctions
				samples.forEach((s, i) => (s.junctionReads = j.reads[i]))
			}
		}
		samples.sort((a, b) => a.value! - b.value!)
	} else {
		// no gene: every eligible sample that the request may read and that its filter leaves
		for (const n of await samplesOfRequest(q, ds, m.eligible)) add(n)
	}
	const what = `methylation${q.gene ? ' and expression' : ''} data`
	if (samples.length < minArrayLength) throw new Error(`Too few samples with ${what}`)
	// a comparison of groups needs every group asked for
	const empty = groupOrder(q)?.find(g => !samples.some(s => s.group === g))
	if (empty !== undefined) throw new Error(`No sample of group "${empty}" has ${what}`)

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
		/* the script exits with one of these when the range has no CpG: a view zoomed in between two, or one before
		the chromosome's first CpG or after its last */
		const msg = String(e?.message || e)
		if (
			!msg.includes('No DNA methylation data for the provided range') &&
			!msg.includes('not within the genomic bounds')
		)
			throw e
		bins = []
	}

	if (!q.gene) return { region, samples, ...groupsOf(q), bins }
	const withValue = samples as { value: number; group?: string }[]

	for (const [i, r] of (await correlateBins(bins, withValue, () => true)).entries()) {
		if (r) Object.assign(bins[i], r)
	}

	/* rho within each group as well: across all samples, a difference between the groups in both
	methylation and expression gives a strong rho in every bin even when neither moves with the
	other inside a group (e.g. NSD2 across t(4;14)), and the per-group rho tells the two apart */
	const { groups = [] } = groupsOf(q)
	for (const group of groups) {
		const byBin = await correlateBins(bins, withValue, s => s.group === group)
		bins.forEach((b, i) => {
			if (!b.byGroup) b.byGroup = []
			b.byGroup.push({ group, ...(byBin[i] || {}) })
		})
	}
	if (groups.length) poolWithinGroups(bins)

	// the gene models as the genome's gene db stores them
	return {
		gene: gm,
		isoforms: models,
		region,
		unit,
		...(expressed?.length
			? { expressedIsoforms: expressed, isoformUnit: ds.queries.isoformExpression.unit || 'expression' }
			: {}),
		...(junctions ? { junctions } : {}),
		samples,
		...groupsOf(q),
		bins
	}
}

/* Sets samples[].annotation, the value of q.annotationTw, e.g. a breakpoint class: read with the request's filters, so
through the same access checks and parent-to-child mapping as the expression, but in a getData() of its own, as a
term of some sample types only (e.g. one that describes a patient's baseline sample) narrows the samples of the terms
read with it, which would drop rows. A sample without a value has none. */
async function annotateSamples(
	q: MethylationLocusRequest,
	ds: any,
	samples: MethylationLocusSample[],
	name2id: Map<string, string>
) {
	const tw = { ...(q.annotationTw as any), $id: 'annotation' }
	if (typeof tw.term?.id != 'string' && typeof tw.term?.type != 'string') throw new Error('invalid annotationTw')
	const data = await getData(
		{ filter: q.filter, filter0: q.filter0, terms: [tw], __protected__: q.__protected__ },
		ds,
		true
	)
	if (data.error) throw new Error(data.error)
	const byId = data.samples as Record<string, any>
	for (const s of samples) {
		const a = byId[name2id.get(s.name)!]?.annotation
		const v = a?.key ?? a?.value
		if (v !== undefined && v !== null) s.annotation = v
	}
}

/* The junction keys of a gene model, as a junction file has them: from the end of an exon to the start of the next,
with the file's start one base before the model's intron start (570 of 572 NSD2 model introns of MMRF match so) */
export function junctionKeysOf(model: { exon: [number, number][] }): [number, number][] {
	const ex = [...model.exon].sort((a, b) => a[0] - b[0])
	return ex.slice(1).map((e, i) => [ex[i][1] - 1, e[0]])
}

/* Of the junctions with reads, each isoform's first one, at its start (the 5' end, by strand), and the reference: the
junction in the most isoforms, then with the most reads, a body junction nearly every transcript of the gene has. A
first junction's reads over the reference's are the share of the gene's transcripts that start where the isoform
starts. keys[reference] is the reference; first[i] the index in keys of isoform i's first junction, null for none
with reads. undefined when the isoforms have no junction with reads. */
export function pickJunctions(
	models: { strand: string; exon: [number, number][] }[],
	totals: Map<string, number>
): { keys: [number, number][]; first: (number | null)[]; reference: number } | undefined {
	const key = (j: [number, number]) => `${j[0]}.${j[1]}`
	const ofModel = models.map(m => junctionKeysOf(m).filter(j => totals.has(key(j))))
	const inModels = new Map<string, number>()
	for (const l of ofModel) for (const j of l) inModels.set(key(j), (inModels.get(key(j)) || 0) + 1)
	if (!inModels.size) return
	const ref = [...inModels.keys()].sort(
		(a, b) => inModels.get(b)! - inModels.get(a)! || totals.get(b)! - totals.get(a)!
	)[0]
	const keys: [number, number][] = [ref.split('.').map(Number) as [number, number]]
	const first = ofModel.map((l, i) => {
		const j = models[i].strand == '-' ? l[l.length - 1] : l[0]
		if (!j) return null
		let k = keys.findIndex(x => key(x) == key(j))
		if (k == -1) k = keys.push(j) - 1
		return k
	})
	return { keys, first, reference: 0 }
}

/* The reads of pickJunctions() per sample (sampleIds, as getData() gives them), from the dataset's junction file; the
first value of a cell is its read count, as server/src/j2/validate.ts reads it. undefined without a junction file. */
async function getJunctionReads(
	ds: any,
	allModels: any[],
	ids: string[],
	sampleIds: string[]
): Promise<{ junctions: NonNullable<ReturnType<typeof pickJunctions>>; reads: number[][] } | undefined> {
	const jq = ds.queries?.junction
	if (!jq?.file || !Array.isArray(jq.samples)) return
	const models = ids.map(id => allModels.find(m => m.isoform == id)).filter(Boolean)
	if (!models.length) return
	const strand = models[0].strand
	const wanted = new Set(models.flatMap(m => junctionKeysOf(m).map(j => `${j[0]}.${j[1]}`)))
	// the file column of each sample: jq.samples[i].name is the sample id of column i + 5
	const colOf = new Map<string, number>(jq.samples.map((s: any, i: number) => [String(s.name), i + 5]))
	const cols = sampleIds.map(id => colOf.get(String(id)))
	const byKey = new Map<string, number[]>()
	const chr = models[0].chr
	await readTabixLines({
		file: jq.file,
		regions: [
			{
				chr: jq.nochr ? chr.replace('chr', '') : chr,
				start: Math.min(...models.map(m => m.start)),
				stop: Math.max(...models.map(m => m.stop))
			}
		],
		callback: (line: string) => {
			const l = line.split('\t')
			const k = `${l[1]}.${l[2]}`
			if (l[3] != strand || !wanted.has(k)) return
			byKey.set(
				k,
				cols.map(c => (c === undefined ? 0 : Number(l[c]?.split(';')[0]) || 0))
			)
		}
	})
	const totals = new Map([...byKey].map(([k, v]) => [k, v.reduce((a, b) => a + b, 0)]))
	const junctions = pickJunctions(models, totals)
	if (!junctions) return
	return {
		junctions,
		reads: sampleIds.map((_, i) => junctions.keys.map(j => byKey.get(`${j[0]}.${j[1]}`)![i]))
	}
}

/* Each of the gene's isoforms' expression in the given samples, the ids of getData() above: which samples the request
may read is decided there, with its filters, so the isoforms are read for all samples in one call of the dataset's
getter and kept for these only. The candidates are the gene's isoforms on the chromosome of the locus (a gene db lists an
isoform once per place it maps to), those of an expression file's items when it lists them; an isoform with no value
in any of the samples is left out. values() of a sample has null for an isoform it has no value of. undefined without
isoform expression, or when none of the isoforms has any, e.g. the getter found none of them. */
async function getIsoformValues(
	ds: any,
	models: any[],
	chr: string,
	sampleIds: Set<string>
): Promise<{ ids: string[]; values: (sampleId: string) => (number | null)[] } | undefined> {
	const query = ds.queries?.isoformExpression
	if (typeof query?.get != 'function') return
	const items = Array.isArray(query.availableItems) ? new Set<string>(query.availableItems) : undefined
	const candidates = [...new Set<string>(models.filter(g => g.chr == chr).map(g => g.isoform))].filter(
		id => !items || items.has(id)
	)
	if (!candidates.length) return
	const terms = candidates.map(id => ({
		$id: id,
		term: { type: 'isoformExpression', isoform: id, name: id },
		q: { mode: 'continuous' }
	}))
	let term2sample2value: Map<string, Record<string, number>>
	try {
		term2sample2value = (await query.get({ genome: ds.genomename, dslabel: ds.label, terms }, ds)).term2sample2value
	} catch (e: any) {
		// the share column is an extra of the view: without isoform values the rest of it still shows
		console.error(`methylationLocus: no isoform expression for the isoforms of the locus: ${e?.message || e}`)
		return
	}
	const ids = candidates.filter(id => {
		const s2v = term2sample2value.get(id)
		return s2v && [...sampleIds].some(sid => Number.isFinite(s2v[sid]))
	})
	if (!ids.length) return
	return {
		ids,
		values: sid =>
			ids.map(id => {
				const v = term2sample2value.get(id)![sid]
				return Number.isFinite(v) ? Number(v) : null
			})
	}
}

// the requested groups, in request order; each has samples, see above
function groupsOf(q: MethylationLocusRequest): { groups?: string[] } {
	const groups = [...new Set(groupOrder(q) || [])]
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
): Promise<({ rho: number; q: number; n: number } | undefined)[]> {
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
	const result: ({ rho: number; q: number; n: number } | undefined)[] = bins.map(() => undefined)
	const nOf = new Map(terms.map(t => [t.id, t.v1.length]))
	if (!terms.length) return result
	const out = JSON.parse(await run_rust('corr', JSON.stringify({ method: 'spearman', terms })))
	// corr gives null where R gives NA; the checks above should prevent it, and such a bin gets no rho
	for (const t of out)
		if (t.correlation !== null && t.adjusted_p_value !== null)
			result[Number(t.id)] = { rho: t.correlation, q: t.adjusted_p_value, n: nOf.get(t.id)! }
	return result
}

/* One rho per bin within the groups, pooled: does methylation move with expression from patient to patient inside a
group? Across all samples, a difference between the groups in both gives a strong rho by itself. Each group's Spearman
rho goes to Fisher's z, weighted by its n - 3 (the inverse of z's variance, inflated 1.06 times for Spearman, Fieller et
al. 1957), and the pooled z is tested against 0, with BH across the bins. Sets rhoWithin and qWithin on the bins with a
rho in some group. */
export function poolWithinGroups(bins: MethylationLocusBin[]) {
	const pooled: { b: MethylationLocusBin; rho: number; logP: number }[] = []
	for (const b of bins) {
		let zw = 0,
			w = 0
		for (const g of b.byGroup || []) {
			if (g.rho === undefined || !g.n || g.n <= 3) continue
			// clamped, so that a rho of exactly ±1 in a small group stays finite
			const r = Math.max(-0.999999, Math.min(0.999999, g.rho))
			zw += (g.n - 3) * Math.atanh(r)
			w += g.n - 3
		}
		if (!w) continue
		const z = zw / w
		const stat = z * Math.sqrt(w / 1.06)
		pooled.push({ b, rho: Math.tanh(z), logP: chiSquareLogSf(stat * stat, 1) })
	}
	const logQ = logBH(pooled.map(x => x.logP))
	pooled.forEach((x, i) => {
		x.b.rhoWithin = x.rho
		x.b.qWithin = Math.exp(logQ[i])
	})
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
	const groups = (q.groupTw as any)?.q?.groups
	// undefined: no groups asked for. An empty map: groups asked for, with no sample that has methylation
	if (!Array.isArray(groups)) return
	const sample2group = new Map<string, string>()
	for (const g of await resolveGroups(groups, q, ds)) {
		if (g.in === false || !Array.isArray(g.values)) continue
		const { names } = await buildGroupValues(g.values, eligible, ds, null, null, null, null, q.__protected__)
		for (const n of names) if (!sample2group.has(n)) sample2group.set(n, g.name)
	}
	return sample2group
}
