import type {
	RoutePayload,
	RouteApi,
	DataAvailabilityAssay,
	DataAvailabilityDataType,
	DataAvailabilityGroup,
	DataAvailabilityGroupCounts,
	DataAvailabilityRequest,
	DataAvailabilityResponse,
	DataAvailabilitySurvival,
	DataAvailabilityType
} from '#types'
import {
	buildGroupValues,
	isFilterGroup,
	maxFilterGroups,
	resolveGroups,
	samplelstFilter
} from '#src/utils/sampleGroups.ts'
import { filterTerms } from '#src/termdb.server.init.ts'
import { eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { getImagingSampleNames } from '#src/brainImaging/brainImagingSamples.ts'
import { getSwimmerLanes } from './termdb.swimmer.ts'
import { mayLog } from '#src/helpers.ts'
import { dt2label } from '#shared/common.js'
import { termType2label } from '#shared/terms.js'
import { TermTypes } from '#types'
import { validGenomeDs } from './common.ts'

/*
how many samples of each sample group have each kind of data of the dataset: gene expression (the
samples of expression plots), the rnaseq counts of differential expression, DNA methylation, splicing
junctions and brain imaging. A group is defined by a filter, as the groups of a custom variable and a
sunburst selection are, or lists its samples. A sample counts for a kind of data when the plot or analysis
of that data would use it, i.e. it is in the data's samples, and the request may read it; for rnaseq
counts, methylation and splicing these are the counts that the pre-analysis of their differential
analysis gives for two groups. Also counted: the patients of a group with longitudinal data (the lanes
of the swimmer plot of its samples), and the samples of a group that were assayed for each kind of mutation
data (ds.assayAvailability), which may be child samples of the group's samples, and, for each survival term of
the request's cohort, the patients or samples of a group with a value for it.

Only counts are returned. A kind of data, or a survival term, that the dataset does not have or that the
request may not read is left out of every group.
*/

/** the label of each kind of data, which the client shows */
const dataTypeLabels: { [dataType in DataAvailabilityType]: string } = {
	geneExpression: termType2label(TermTypes.GENE_EXPRESSION),
	rnaseqGeneCount: 'RNA-seq gene counts',
	dnaMethylation: termType2label(TermTypes.DNA_METHYLATION),
	junction: termType2label(TermTypes.JUNCTION),
	NIdata: 'Brain imaging',
	longitudinal: 'Longitudinal data'
}

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DataAvailabilityRequest' },
	response: { typeId: 'DataAvailabilityResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/dataAvailability',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: DataAvailabilityRequest = { ...req.query, ...validGenomeDs(req.query) }
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw 'invalid genome or dataset name'
			if (!ds.cohort?.termdb) throw 'dataset has no termdb'
			res.send(await getDataAvailability(q, ds))
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e?.message || e })
		}
	}
}

async function getDataAvailability(q: DataAvailabilityRequest, ds: any): Promise<DataAvailabilityResponse> {
	const groups = validateGroups(q.groups)
	const cohort = validateCohort(q.cohort, ds)
	const eligible = await getEligibleSampleSets(q, ds)
	const assays = getAssays(ds)
	let survivalTerms: SurvivalTerm[] = []
	try {
		survivalTerms = getSurvivalTerms(q, ds, cohort)
	} catch (e: any) {
		// so that the counts of the other kinds of data are given
		mayLog(`[dataAvailability] survival terms of ${ds.label}:`, e?.message || e)
	}
	const lanes = await getLongitudinalLanes(q, ds)
	const dataTypes: DataAvailabilityDataType[] = [...eligible.keys()].map(type => ({
		type,
		label: dataTypeLabels[type]
	}))
	if (lanes) {
		// a lane is of a patient
		const unit = rootSampleTypeName(ds)
		dataTypes.push({ type: 'longitudinal', label: dataTypeLabels.longitudinal, ...(unit ? { unit } : {}) })
	}
	// nothing to count, so the groups are not resolved
	if (!dataTypes.length && !assays.length && !survivalTerms.length)
		return { dataTypes, groups: groups.map(g => ({ name: g.name, data: {} })) }

	/* each group is given the samples that its filter selects for this request, with the dataset's
	sample filter for the session; a group that lists its samples is resolved by a filter of its list,
	so that it also has only the samples that the request may read */
	const filterGroups = groups.map(asFilterGroup)
	const resolved = await resolveGroups(filterGroups, q, ds)
	// an assay, or a survival value, may be of samples, which a group of patients has as its child samples
	const resolvedToSamples =
		assays.length || survivalTerms.length
			? await resolveGroups(
					filterGroups.map(g => ({ ...g, mapParent2Children: true })),
					q,
					ds
			  )
			: []
	const result: DataAvailabilityResponse = { dataTypes, groups: [] }
	for (const [i, g] of resolved.entries()) {
		const values = Array.isArray(g.values) ? g.values : []
		const data: { [dataType in DataAvailabilityType]?: number } = {}
		for (const [dataType, sampleSet] of eligible) {
			const { names } = await buildGroupValues(values, sampleSet, ds, null, null, [], [], q.__protected__)
			data[dataType] = names.length
		}
		if (lanes) data.longitudinal = countLanes(ds, lanes, values)
		const counts: DataAvailabilityGroupCounts = { name: groups[i].name, data }
		if (assays.length) {
			const ids = new Set<number | string>((resolvedToSamples[i]?.values || []).map((v: any) => v.sampleId))
			counts.assays = assays.map(a => {
				let count = 0
				for (const id of ids) if (a.yesSamples.has(id)) count++
				return { key: a.key, label: a.label, count }
			})
		}
		if (survivalTerms.length) {
			// the group's samples and their child samples; a survival value is of a patient or of a sample
			const ids = new Set<number>([...values, ...(resolvedToSamples[i]?.values || [])].map((v: any) => v.sampleId))
			const { id2descendantIds } = ds.cohort.termdb.q
			counts.survival = survivalTerms.map(t => {
				let count = 0
				for (const id of t.sampleIds) if (ids.has(id) || id2descendantIds(id).some((d: number) => ids.has(d))) count++
				return { termid: t.termid, name: t.name, count, ...(t.unit ? { unit: t.unit } : {}) }
			})
		}
		result.groups.push(counts)
	}
	return result
}

/** the plural name of the top sample type, e.g. "patients"; undefined for a dataset with one sample type */
function rootSampleTypeName(ds: any): string | undefined {
	if (!ds.cohort.termdb.hasSampleAncestry) return
	const types = Object.values(ds.cohort.termdb.sampleTypes || {}) as any[]
	return types.find(t => t.parent_id == null)?.plural_name
}

/** the lanes of the swimmer plot that the request may see, of all patients; undefined without longitudinal
 *  data, or when the request may not read it */
async function getLongitudinalLanes(q: DataAvailabilityRequest, ds: any): Promise<{ sampleId: number }[] | undefined> {
	const sq = ds.queries?.swimmer
	if (!sq?.data || (sq.checkDataAccess && !sq.checkDataAccess(q))) return
	try {
		const { lanes } = await getSwimmerLanes(
			{ genome: q.genome, dslabel: q.dslabel, __protected__: q.__protected__ } as any,
			ds
		)
		return lanes
	} catch (e: any) {
		mayLog(`[dataAvailability] longitudinal data of ${ds.label}:`, e?.message || e)
	}
}

/** the lanes of a group, as the swimmer plot of the group's samples has them: a lane is of a patient, which is
 *  in the group, or one of whose samples is */
function countLanes(ds: any, lanes: { sampleId: number }[], values: { sampleId: any }[]): number {
	const ids = new Set(values.map(v => v.sampleId))
	const { id2descendantIds } = ds.cohort.termdb.q
	return lanes.filter(l => ids.has(l.sampleId) || id2descendantIds(l.sampleId).some((d: number) => ids.has(d))).length
}

type SurvivalTerm = Omit<DataAvailabilitySurvival, 'count'> & { sampleIds: number[] }

/** the survival terms of the request's cohort that the request may see, as the term tree lists them, each
 *  with the ids of the patients or samples with a value for it */
function getSurvivalTerms(q: DataAvailabilityRequest, ds: any, cohort: string): SurvivalTerm[] {
	if (!ds.cohort?.db?.connection) return []
	const terms = filterTerms({ query: q }, ds, ds.cohort.termdb.q.getTermsByTermType('survival', cohort))
	return terms.map((term: any) => {
		// the unit of the count where the dataset has several sample types, e.g. "patients"
		const unit = ds.cohort.termdb.hasSampleAncestry
			? ds.cohort.termdb.sampleTypes?.[ds.cohort.termdb.term2SampleType.get(term.id)]?.plural_name
			: undefined
		return { termid: term.id, name: term.name, ...(unit ? { unit } : {}), sampleIds: survivalSampleIds(ds, term.id) }
	})
}

/** the ids of the patients or samples with a value for a survival term; read once per term */
const survivalSampleIdsByDs = new WeakMap<object, Map<string, number[]>>()
function survivalSampleIds(ds: any, termid: string): number[] {
	let byTerm = survivalSampleIdsByDs.get(ds)
	if (!byTerm) survivalSampleIdsByDs.set(ds, (byTerm = new Map()))
	const cached = byTerm.get(termid)
	if (cached) return cached
	const sql = ds.cohort.db.connection.prepare('SELECT DISTINCT sample FROM survival WHERE term_id=?')
	const ids: number[] = sql.all(termid).map((r: any) => r.sample)
	byTerm.set(termid, ids)
	return ids
}

type Assay = Omit<DataAvailabilityAssay, 'count'> & { yesSamples: Set<number | string> }

/** the kinds of mutation data that the dataset tells the assayed samples of (ds.assayAvailability.byDt), one
 *  per data type and origin; the assayed samples of an origin are those of all its sample types */
function getAssays(ds: any): Assay[] {
	const byDt = ds.assayAvailability?.byDt
	if (!byDt) return []
	const assays: Assay[] = []
	const union = (leaves: any[]) => {
		const s = new Set<number | string>()
		for (const l of leaves) for (const id of l.yesSamples || []) s.add(id)
		return s
	}
	for (const [key, entry] of Object.entries<any>(byDt)) {
		const dt = Number(key)
		// mds3.init.js rejects a dt without a label
		const label = dt2label[dt]
		if (entry.byOrigin) {
			for (const [origin, o] of Object.entries<any>(entry.byOrigin)) {
				const leaves = o.bySampleType ? Object.values(o.bySampleType) : [o]
				assays.push({
					key: `${dt}.${origin}`,
					label: `${label} (${o.label || origin})`,
					yesSamples: union(leaves)
				})
			}
		} else if (entry.bySampleType) {
			assays.push({ key: String(dt), label, yesSamples: union(Object.values(entry.bySampleType)) })
		} else if (entry.yesSamples) {
			assays.push({ key: String(dt), label, yesSamples: entry.yesSamples })
		}
	}
	return assays
}

function validateGroups(groups: any) {
	if (!Array.isArray(groups) || !groups.length) throw 'groups[] must be a non-empty array'
	if (groups.length > maxFilterGroups) throw `at most ${maxFilterGroups} groups are supported`
	for (const g of groups) {
		if (!g || typeof g != 'object' || typeof g.name != 'string') throw 'each group must have a name'
		if (!isFilterGroup(g) && !Array.isArray(g.values)) throw `group "${g.name}" has neither filter nor values[]`
	}
	return groups
}

/** the cohort string of the request, '' for none; it must be a cohort of the dataset, as selectCohort lists them
 *  (its keys sorted and joined with a comma, as mds3.init.js makes them) */
function validateCohort(cohort: any, ds: any): string {
	if (cohort === undefined || cohort === '') return ''
	if (typeof cohort != 'string') throw 'cohort must be a string'
	const values = ds.cohort.termdb.selectCohort?.values || []
	if (!values.some((v: any) => [...v.keys].sort().join(',') == cohort)) throw 'invalid cohort'
	return cohort
}

/** a group as one defined by a filter: its own filter, else a filter of the samples that it lists. A group with
 *  both is resolved by its filter alone */
function asFilterGroup(g: DataAvailabilityGroup): DataAvailabilityGroup {
	return {
		name: g.name,
		filter: g.filter || samplelstFilter(g.values!),
		filter0: g.filter0,
		mapParent2Children: g.mapParent2Children
	}
}

/** the samples that each kind of data of the dataset has, by kind, for the kinds that the request may
 *  read. A kind whose samples cannot be listed is left out and logged, so that it does not fail the
 *  counts of the others */
async function getEligibleSampleSets(
	q: DataAvailabilityRequest,
	ds: any
): Promise<Map<DataAvailabilityType, Set<string>>> {
	const sets = new Map<DataAvailabilityType, Set<string>>()
	const getters: [DataAvailabilityType, () => Promise<Set<string> | undefined> | Set<string> | undefined][] = [
		['geneExpression', () => sampleNames(ds, ds.queries?.geneExpression?.samples)],
		// allSampleSet may be a getter on api-backed datasets, so it is read here
		['rnaseqGeneCount', () => ds.queries?.rnaseqGeneCount?.allSampleSet],
		['dnaMethylation', () => (ds.queries?.dnaMethylation ? eligibleMethylationSamples(ds, undefined) : undefined)],
		['junction', () => ds.queries?.junction?.cluster?.allSampleSet],
		['NIdata', () => getImagingSamples(q, ds)]
	]
	for (const [dataType, get] of getters) {
		try {
			const s = await get()
			if (s instanceof Set) sets.set(dataType, s)
		} catch (e: any) {
			mayLog(`[dataAvailability] ${dataType} samples of ${ds.label}:`, e?.message || e)
		}
	}
	return sets
}

/** the names of a query's samples, which it lists by termdb sample id; undefined when it lists none, such
 *  as the query of an api-backed dataset */
function sampleNames(ds: any, ids: any): Set<string> | undefined {
	if (!Array.isArray(ids) || !ids.length) return
	const names = new Set<string>()
	for (const id of ids) {
		const n = ds.cohort.termdb.q?.id2sampleName?.(id)
		if (n) names.add(n)
	}
	return names
}

/** the samples with an image on any reference of the dataset; undefined without imaging data or when the
 *  request may not read it */
async function getImagingSamples(q: DataAvailabilityRequest, ds: any): Promise<Set<string> | undefined> {
	const NIdata = ds.queries?.NIdata
	if (!NIdata) return
	// dataset-level access rule (e.g. sign-in required), as for termdb/brainImagingSamples
	if (NIdata.checkDataAccess && !NIdata.checkDataAccess(q)) return
	const names = new Set<string>()
	for (const ref of Object.values(NIdata.references || {}) as any[]) {
		if (!ref.referenceFile || !ref.samples) continue
		try {
			for (const n of await getImagingSampleNames(ref)) names.add(n)
		} catch (e: any) {
			mayLog(`[dataAvailability] imaging reference of ${ds.label}:`, e?.message || e)
		}
	}
	return names
}
