import { createHash } from 'crypto'
import { run_python } from '@sjcrh/proteinpaint-python'
import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { mayCheckSampleAccess } from '#src/termdb.sampleAccess.ts'
import { getFilterSampleIdSet } from '#src/termdb.sql.js'
import { genomes } from '#src/initGenomesDs.js'
import { validGenomeDs } from '#routes/common.ts'
import type {
	RouteApi,
	RoutePayload,
	SampleOutlierBox,
	SampleOutlierRow,
	SampleOutliersKind,
	SampleOutliersReference,
	TermdbSampleOutliersRequest,
	TermdbSampleOutliersResponse
} from '#types'

/*
 termdb/sampleOutliers — the genes (ds.queries.geneExpression) or gene sets (ds.queries.ssGSEA) whose value
 in a sample is unusually high or low against a reference group of samples, by z-score, for the sample view
 tiles. Configured by ds.cohort.termdb.sampleView.outliers (see the SampleViewOutliers type).

 The reference group is all samples of the file, the other samples sharing the sample's value of a configured
 term (e.g. same diagnosis; a sample without a value takes its root sample's, e.g. its patient's), or a custom
 group of the samples passing a filter the user built. The sample is left out of a group it is in: its z-score is
 against the others. Expression values are on the log2(value+1) scale for the z-score, with a least sd per gene.

 Each row also has the group's boxplot values, so that the sample's value can be shown against the group's
 distribution and not only as a z-score. The box is of all samples of the group, the sample too when it is a
 member: unlike the mean and sd, the quartiles of the others cannot be had from the group's. Expression boxes are
 computed on the log2(value+1) scale, as the z-score, and given back in the file's unit: the quartiles and range
 are the same either way, while the whiskers are within 1.5 IQR on the log scale.

 The count, mean, sd and box of each row over a group cost one pass over the file (python/src/sampleOutliers.py);
 they are kept in memory per dataset, data kind and group, so a later sample of the same group only reads its
 own column.
*/

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module is
	// evaluated; the route is only set up when at least one ds has ds.cohort.termdb.sampleView.outliers
	get init() {
		return hasSampleOutliersDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbSampleOutliersRequest', checker: validRequest },
	response: { typeId: 'TermdbSampleOutliersResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/sampleOutliers',
	middlewares: [protectedRoutes.termdb, protectedRoutes.samples],
	methods: { get: payload, post: payload }
}

export function hasSampleOutliersDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.cohort?.termdb?.sampleView?.outliers)
	)
}

const kinds = new Set<SampleOutliersKind>(['ssGSEA', 'geneExpression'])
/** default of SampleViewOutliers.minGroupSize */
const MIN_GROUP_SIZE = 20
/** default of SampleViewOutliers.geneExpression.minValue */
const MIN_EXPRESSION = 5
/** default of SampleViewOutliers.ssGSEA.geneSetCollection */
const GENE_SET_COLLECTION = 'H: hallmark gene sets'
/** gene sets below this sd in the reference group have no z-score */
const MIN_SD = 1e-6
/** least sd of a gene in the reference group, on the log2(value+1) scale: a gene that hardly varies in the group,
 * e.g. 0 in all of its samples, would otherwise get an unbounded z-score from its sd of about 0. Nearly all genes of
 * at least 5 FPKM or TPM have an sd above 0.4 over a cohort (ash, aml, sjatrt, sjmb12, peddep) */
const MIN_EXPRESSION_SD = 0.25
/** most custom groups kept per ds and kind, the least recently used dropped: unlike the configured groups,
 * users can make any number of them */
const MAX_CUSTOM_GROUPS = 20

export function validRequest(input): TermdbSampleOutliersRequest {
	const vt = typeof input.sample
	if (vt != 'string' && vt != 'number') throw 'sample must be a string or number'
	const sample = String(input.sample)
	if (!sample) throw 'sample is blank'
	if (!kinds.has(input.kind)) throw 'invalid kind'
	if (input.reference != null && typeof input.reference != 'string') throw 'reference must be a string'
	// a GET request carries the filter as a JSON string
	let f = input.referenceFilter
	if (typeof f == 'string') {
		try {
			f = JSON.parse(f)
		} catch {
			throw 'referenceFilter is not valid JSON'
		}
	}
	if (input.reference == 'custom' && (typeof f != 'object' || !Array.isArray(f?.lst) || !f.lst.length))
		throw 'referenceFilter must be a filter with at least one item'
	let limit: number | undefined
	if (input.limit != null) {
		limit = Number(input.limit)
		if (!Number.isInteger(limit) || limit < 1) throw 'limit must be a positive integer'
	}
	return {
		...validGenomeDs(input),
		sample,
		kind: input.kind,
		reference: input.reference,
		referenceFilter: input.reference == 'custom' ? f : undefined,
		limit
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		let result: TermdbSampleOutliersResponse
		try {
			const q = req.query
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw 'invalid genome or dataset'
			// the response has the values of a sample, as termdb singleSampleData
			if (!authApi.canDisplaySampleIds(req, ds)) throw 'Requires sign in to access the sample data'
			result = await getSampleOutliers(q, ds, genomes[q.genome])
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = { status: e.status || 400, error: e.message || e }
		}
		res.send(result)
	}
}

type Stats = {
	n: number[]
	mean: (number | null)[]
	sd: (number | null)[]
	/** each boxplot value of every row, null or NaN for a row of too few values; kept as float32 once cached, as
	they are only shown, and a whole-transcriptome group has some 60k rows of them */
	box?: { [K in keyof SampleOutlierBox]: ArrayLike<number | null> }
}
type FileData = { items: string[]; value: (number | null)[]; group?: Stats }

/** per ds and kind: the statistics by group key, as promises so that concurrent requests of the same group
 * share one computation; the configured groups and the custom groups are kept apart, as only the latter are
 * limited in number */
const caches = new WeakMap<object, Map<string, Map<string, Promise<Stats>>>>()

async function getSampleOutliers(q: any, ds: any, genome: any): Promise<TermdbSampleOutliersResponse> {
	const so = ds.cohort?.termdb?.sampleView?.outliers
	const dq = ds.queries?.[q.kind]
	if (!so || so[q.kind] === false || !dq?.file) throw 'not supported on this dataset'
	const tdbq = ds.cohort.termdb.q
	const sampleId = tdbq.sampleName2id(q.sample)
	if (sampleId != undefined) mayCheckSampleAccess(q, ds, [{ sampleIds: [sampleId] }])
	// the samples of the file, as sample ids, set by the query validator
	const fileSamples: number[] = dq.samples || []
	// 404: the sample view leaves out the tile
	if (sampleId == undefined || !fileSamples.includes(sampleId))
		throw { status: 404, message: 'no data for this sample' }

	// !!! CRITICAL !!!
	// must always call authApi.mayAdjustFilter(), dataset-specific logic exceptions must be coded inside a
	// ds.cohort.termdb.getAdditionalFilter() option. A filter sent by the client is not used: the samples are
	// all samples of the file, or the reference group. Without route terms, the strictest auth filter applies
	const authQ: any = { __protected__: q.__protected__ }
	authApi.mayAdjustFilter(authQ, ds, undefined)
	let allowed: Set<number> | undefined
	if (authQ.filter?.lst?.length) {
		allowed = await getFilterSampleIdSet(authQ, ds)
		if (!allowed.has(sampleId)) throw 'no access'
	}
	const samples = allowed ? fileSamples.filter(id => allowed!.has(id)) : fileSamples

	const references = getReferences(so, samples, sampleId, tdbq)
	let reference: Reference | undefined
	let members: number[]
	let groupKey: string
	if (q.reference == 'custom') {
		// the samples of the file passing the user's filter, the sample left out of the count
		const passing = await getFilterSampleIdSet(
			{ filter: structuredClone(q.referenceFilter), __protected__: q.__protected__ },
			ds
		)
		members = samples.filter(id => passing.has(id))
		const n = members.filter(id => id != sampleId).length
		reference = { id: 'custom', label: 'Custom group', n }
		if (n < (so.minGroupSize ?? MIN_GROUP_SIZE)) reference.unavailable = `only ${n} other samples in the group`
		// a group is identified by its samples, so the same samples reached by two filters are computed once
		groupKey = 'custom\t' + createHash('sha1').update(members.join(',')).digest('hex')
	} else {
		reference = q.reference
			? references.find(r => r.id == q.reference)
			: references.find(r => r.id != 'all' && !r.unavailable) || references[0]
		if (!reference) throw 'invalid reference'
		const values = reference.values
		members = values ? samples.filter(id => getValue(values, id, tdbq) == reference!.rawValue) : samples
		groupKey = reference.id == 'all' ? 'all' : `${reference.id}\t${reference.rawValue}`
	}
	if (reference.unavailable) throw `reference group unavailable: ${reference.unavailable}`
	// a custom group may not contain the sample; the other groups always do
	const isMember = members.includes(sampleId)
	const items =
		q.kind == 'ssGSEA' ? getGeneSets(so.ssGSEA?.geneSetCollection || GENE_SET_COLLECTION, genome, q) : undefined

	// statistics of a restricted sample set are not kept, as they are of that user's samples only
	const cacheKey = q.kind + (q.reference == 'custom' ? '\tcustom' : '')
	let cache: Map<string, Promise<Stats>> | undefined
	if (!allowed) {
		if (!caches.has(ds)) caches.set(ds, new Map())
		const byKind = caches.get(ds)!
		if (!byKind.has(cacheKey)) byKind.set(cacheKey, new Map())
		cache = byKind.get(cacheKey)
	}
	const cached = cache?.get(groupKey)
	if (cached && q.reference == 'custom') {
		// most recently used last, so that the first is the one dropped
		cache!.delete(groupKey)
		cache!.set(groupKey, cached)
	}
	const input = {
		hdf5_file: dq.file,
		sample: q.sample,
		items,
		log2: q.kind == 'geneExpression',
		group: cached ? undefined : members.map(id => tdbq.id2sampleName(id)),
		box: true
	}
	const file: Promise<FileData> = run_python('sampleOutliers.py', JSON.stringify(input)).then(out => {
		const data = JSON.parse(out as string)
		if (data.status == 'error') throw data.message
		return data
	})
	let stats: Promise<Stats> = cached || file.then(d => compactBox(d.group!))
	if (cache && !cached) {
		const kept = stats
		cache.set(groupKey, kept)
		if (q.reference == 'custom' && cache.size > MAX_CUSTOM_GROUPS) cache.delete(cache.keys().next().value!)
		// a failed computation is made again on the next request; the key may have been dropped and computed again
		// meanwhile
		stats = stats.catch(e => {
			if (cache!.get(groupKey) === kept) cache!.delete(groupKey)
			throw e
		})
	}
	const [data, s] = await Promise.all([file, stats])

	const rows = getRows(data, s, q.kind, so, isMember)
	rows.sort((a, b) => b.z - a.z)
	const limit = q.limit || rows.length
	return {
		reference: publicReference(reference),
		references: references.map(publicReference),
		high: rows.filter(r => r.z >= 0).slice(0, limit),
		low: rows
			.filter(r => r.z < 0)
			.reverse()
			.slice(0, limit),
		total: rows.length,
		unit: q.kind == 'geneExpression' ? dq.unit : undefined
	}
}

/** with the sample's value of the term and every sample's value, for the group's samples */
type Reference = SampleOutliersReference & { rawValue?: string; values?: Map<number, any> }

/** all samples, and each configured term group of the sample: the other samples with its value of the term */
function getReferences(so: any, samples: number[], sampleId: number, tdbq: any): Reference[] {
	const minSize = so.minGroupSize ?? MIN_GROUP_SIZE
	const refs: Reference[] = [{ id: 'all', label: 'All samples', n: samples.length - 1 }]
	for (const g of so.referenceGroups || []) {
		const values = tdbq.getAllValues4term(g.termId)
		const rawValue = values && getValue(values, sampleId, tdbq)
		const ref: Reference = { id: g.termId, label: g.label, n: 0 }
		if (rawValue == undefined) {
			ref.unavailable = 'the sample has no value'
		} else {
			ref.rawValue = rawValue
			ref.values = values
			ref.value = tdbq.termjsonByOneid(g.termId)?.values?.[rawValue]?.label || rawValue
			ref.n = samples.filter(id => id != sampleId && getValue(values, id, tdbq) == rawValue).length
			if (ref.n < minSize) ref.unavailable = `only ${ref.n} other samples of ${ref.value}`
		}
		refs.push(ref)
	}
	if (refs[0].n < minSize) refs[0].unavailable = `only ${refs[0].n} other samples`
	return refs
}

/** a sample's value of a term: its own, else its root sample's, e.g. the patient-level subtype of a diagnosis
 * sample whose expression is in the file */
function getValue(values: Map<number, any>, id: number, tdbq: any) {
	return values.get(id) ?? values.get(tdbq.id2rootSampleId(id))
}

function publicReference(r: Reference): SampleOutliersReference {
	const ref: SampleOutliersReference = { id: r.id, label: r.label, n: r.n }
	if (r.value != undefined) ref.value = r.value
	if (r.unavailable) ref.unavailable = r.unavailable
	return ref
}

/** the gene sets of a collection term of the genome gene set db, e.g. the Hallmark gene sets of msigdb */
function getGeneSets(collection: string, genome: any, req: any): string[] {
	for (const tdb of Object.values(genome.termdbs || {}) as any[]) {
		const tq = tdb.cohort?.termdb?.q
		if (!tq?.termjsonByOneid?.(collection)) continue
		const children = tq.getTermChildren({ query: req }, collection) || []
		if (children.length) return children.map(t => t.id)
	}
	throw `gene set collection not found: ${collection}`
}

/** each row with a z-score of the sample against its reference group, the sample left out of the group when it
 * is a member (always, for all samples and its own term value; maybe, for a custom group), and the group's box
 * when there is one */
export function getRows(
	data: FileData,
	s: Stats,
	kind: SampleOutliersKind,
	so: any,
	isMember: boolean
): SampleOutlierRow[] {
	const minExp = so.geneExpression?.minValue ?? MIN_EXPRESSION
	const rows: SampleOutlierRow[] = []
	for (const [i, name] of data.items.entries()) {
		const x = data.value[i]
		const mean = s.mean[i]
		const sd = s.sd[i]
		if (x == null || mean == null || sd == null) continue
		// with the sample in the group, leave it out: the count, mean and variance of the other samples
		const n = isMember ? s.n[i] - 1 : s.n[i]
		if (n < 2) continue
		const m = isMember ? (s.n[i] * mean - x) / n : mean
		const v = isMember ? (s.n[i] * (sd * sd + mean * mean) - x * x) / n - m * m : sd * sd
		let sd1 = Math.sqrt(Math.max(v, 0))
		let value = x
		if (kind == 'geneExpression') {
			// back from log2(value+1); a gene of low value in the sample and the group is not ranked
			value = 2 ** x - 1
			if (Math.max(value, 2 ** m - 1) < minExp) continue
			sd1 = Math.max(sd1, MIN_EXPRESSION_SD)
		} else if (sd1 < MIN_SD) continue
		const row: SampleOutlierRow = {
			name,
			value: Math.round(value * 1000) / 1000,
			z: Math.round(((x - m) / sd1) * 100) / 100
		}
		const box = s.box && getBox(s.box, i, kind)
		if (box) row.box = box
		rows.push(row)
	}
	return rows
}

/** the boxplot values of row i, when it has them, on the scale of the row's value: expression back from
 * log2(value+1) to the file's unit */
function getBox(b: NonNullable<Stats['box']>, i: number, kind: SampleOutliersKind): SampleOutlierBox | undefined {
	const box: any = {}
	for (const k of Object.keys(b)) {
		const v = b[k][i]
		if (v == null || !Number.isFinite(v)) return
		box[k] = kind == 'geneExpression' ? Math.round((2 ** v - 1) * 1000) / 1000 : Math.round(v * 100000) / 100000
	}
	return box
}

/** the group statistics with the box as float32, NaN for a missing value */
function compactBox(s: Stats): Stats {
	if (!s.box) return s
	const box: any = {}
	for (const [k, values] of Object.entries(s.box)) box[k] = Float32Array.from(values, v => v ?? NaN)
	return { ...s, box }
}
