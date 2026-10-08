import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type {
	RoutePayload,
	RouteApi,
	SwimmerRequest,
	SwimmerResponse,
	SwimmerLane,
	SwimmerRange,
	SwimmerPoint,
	SwimmerTimeReference
} from '#types'
import { filterSampleNamesByAccess } from '#src/termdb.sql.js'
import { getData } from '#src/termdb.matrix.js'
import { genomes } from '#src/initGenomesDs.js'

/*
returns swimmer plot lanes (per-patient time intervals and point events) for the patients passing
the termdb filter and access control. a lane is always a patient (a sample of a root sample type, e.g.
"patient"). data is parsed from the dataset's tsv file(s) at server
launch (validate_query_swimmer, called from mds3.init.js) and kept in ds.queries.swimmer.data
*/

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.queries.swimmer
	get init() {
		return hasSwimmerDs(genomes) ? init : null
	},
	request: { typeId: 'SwimmerRequest' },
	response: { typeId: 'SwimmerResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/swimmer',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasSwimmerDs(genomes) {
	return Object.values(genomes).some((g: any) => Object.values(g.datasets || {}).some((ds: any) => ds.queries?.swimmer))
}

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: SwimmerRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			validateSwimmerRequest(q)
			const result: SwimmerResponse = await getSwimmerLanes(q, ds)
			const lanes = result.lanes
			if (q.term0) result.divideByOrder = await mayDivideLanes(q, ds, lanes)
			if (q.pointTerm) result.pointCategoryOrder = await markPoints(q, ds, lanes)
			res.send(result)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.status(404).send(typeof e == 'string' ? e : 'Cannot get swimmer plot data')
		}
	}
}

/** checks of the optional request fields, as the route has no generated request checker */
function validateSwimmerRequest(q: SwimmerRequest) {
	if (q.samples !== undefined && (!Array.isArray(q.samples) || q.samples.some(s => typeof s != 'string')))
		throw 'samples must be an array of sample names'
	if (q.timeReference !== undefined && typeof q.timeReference != 'string') throw 'timeReference must be a string'
	for (const key of ['term0', 'pointTerm']) {
		const tw = q[key]
		if (tw === undefined) continue
		if (!tw || typeof tw != 'object' || typeof tw.$id != 'string' || typeof tw.term != 'object')
			throw `${key} must be a term wrapper`
	}
}

async function getSwimmerLanes(q: SwimmerRequest, ds: any): Promise<SwimmerResponse> {
	const sq = ds.queries?.swimmer
	if (!sq?.data) throw 'swimmer plot not supported by this dataset'
	if (sq.checkDataAccess && !sq.checkDataAccess(q)) throw 'no access'
	const ref = getTimeReference(sq.timeReferences, q.timeReference)
	// restrict to patients passing the termdb filter (global + local) and the ds access rule.
	// the filter resolves to leaf samples, so a patient lane passes when the patient or any of its samples does
	const { id2sampleName: id2name, id2descendantIds } = ds.cohort.termdb.q
	const candidates = new Set<string>()
	for (const [sample, d] of sq.data) {
		candidates.add(sample)
		for (const id of id2descendantIds(d.sampleId)) candidates.add(id2name(id))
	}
	const allowed = new Set(await filterSampleNamesByAccess(q, ds, [...candidates]))
	// optional sample list (e.g. from sample view): keep the lanes of these patients or of the patients of these
	// samples, so a patient's lane is found from any sample of the patient
	// an empty list returns no lanes
	const requested = q.samples ? new Set(q.samples) : null
	const lanes: SwimmerLane[] = []
	const linked = new Set<string>()
	for (const [sample, d] of sq.data) {
		const descendantIds: number[] = id2descendantIds(d.sampleId)
		if (!allowed.has(sample) && !descendantIds.some(id => allowed.has(id2name(id)))) continue
		if (requested && !isLaneRequested(requested, sample, descendantIds.map(id2name))) continue
		// a patient without the event of the time reference is left out
		const timeline = shiftTimeline(d, ref?.event)
		if (!timeline) continue
		lanes.push({ sample, sampleId: d.sampleId, ...timeline })
		for (const p of d.points) {
			if (p.sample) linked.add(p.sample)
		}
	}
	if (linked.size) {
		// a point's own sample (e.g. CSF) is vetted by the access rule only, not by the user's filter:
		// the filter selects lanes, and a lane's CSF dot stays visible and clickable whatever the filter
		// says about CSF samples. a denied sample keeps its dot but loses the link
		const allowedPointSamples = new Set(await filterSampleNamesByAccess({ ...q, filter: undefined }, ds, [...linked]))
		for (const lane of lanes) {
			if (lane.points.every(p => !p.sample || allowedPointSamples.has(p.sample))) continue
			lane.points = lane.points.map(p => {
				if (!p.sample || allowedPointSamples.has(p.sample)) return p
				return { event: p.event, time: p.time }
			})
		}
	}
	return ref ? { lanes, timeReference: ref.key } : { lanes }
}

/** the time reference of the given key, else the default one (isDefault, else the first). undefined when the
ds has none */
export function getTimeReference(
	refs: SwimmerTimeReference[] | undefined,
	key?: string
): SwimmerTimeReference | undefined {
	if (!refs?.length) return undefined
	if (key !== undefined) {
		const ref = refs.find(r => r.key == key)
		if (!ref) throw `unknown timeReference '${key}'`
		return ref
	}
	return refs.find(r => r.isDefault) || refs[0]
}

/** ranges and points of a lane with time 0 moved to the time of its first `event` point (the time reference),
or as they are without event. null when the lane has no such point. new objects are returned, as the parsed
data is kept for the server lifetime */
export function shiftTimeline(
	d: { ranges: SwimmerRange[]; points: SwimmerPoint[] },
	event?: string
): { ranges: SwimmerRange[]; points: SwimmerPoint[] } | null {
	if (!event) return { ranges: d.ranges, points: d.points }
	const origin = d.points.find(p => p.event == event)?.time
	if (origin === undefined) return null
	return {
		ranges: d.ranges.map(r => ({ ...r, start: r.start - origin, end: r.end == null ? null : r.end - origin })),
		points: d.points.map(p => ({ ...p, time: p.time - origin }))
	}
}

/** whether a lane is asked for: its patient or one of the patient's samples is in the list */
export function isLaneRequested(requested: Set<string>, sample: string, relatedNames: string[]): boolean {
	return requested.has(sample) || relatedNames.some(n => requested.has(n))
}

/** set lane.divideBy[] from the patient's value(s) for q.term0 and return the category order.
getData() runs in its default mode, keyed by the term's own sample level (e.g. patient for "Age", primary
sample for a primary-sample term), since forcing mapParent2Children computes numeric bins over the child
samples, which lack the values of a patient-level term, and yields a single bin. a lane's categories then
come from getLaneValues() */
async function mayDivideLanes(q: SwimmerRequest, ds: any, lanes: SwimmerLane[]): Promise<string[]> {
	const tw = q.term0
	const data = await getData({ terms: [tw], filter: q.filter, __protected__: q.__protected__ }, ds)
	if (data.error) throw data.error
	const id2descendantIds = ds.cohort.termdb.q.id2descendantIds
	const seen = new Set<string>()
	for (const lane of lanes) {
		const values = getLaneValues(id => data.samples?.[id]?.[tw.$id], lane.sampleId, id2descendantIds(lane.sampleId))
		if (!values.length) continue
		lane.divideBy = [...new Set(values.flatMap(v => getDivideCategories(tw, v)))]
		for (const c of lane.divideBy) seen.add(c)
	}
	return orderDivideCategories(tw, data.refs?.byTermId?.[tw.$id]?.bins, seen)
}

/** set point.category of the linked points of markBy events (those with a sampleId, already vetted by the access rule)
from their sample's value for q.pointTerm, and return the category order. the user filter is not applied,
as it selects lanes, not the points on them. lane.points are replaced, not edited, since they are shared
with the parsed data kept for the server lifetime */
async function markPoints(q: SwimmerRequest, ds: any, lanes: SwimmerLane[]): Promise<string[]> {
	const tw = q.pointTerm
	const markEvents = new Set<string>(ds.queries.swimmer.pointSampleEvents || [])
	if (!markEvents.size) throw 'swimmer: marking points by a term is not enabled for this dataset'
	const marked = (p: SwimmerPoint) => p.sampleId !== undefined && markEvents.has(p.event)
	if (!lanes.some(l => l.points.some(marked))) return []
	const data = await getData({ terms: [tw], __protected__: q.__protected__ }, ds)
	if (data.error) throw data.error
	const seen = new Set<string>()
	for (const lane of lanes) {
		lane.points = lane.points.map(p => {
			if (!marked(p)) return p
			const v = data.samples?.[p.sampleId!]?.[tw.$id]
			const category = v ? getDivideCategories(tw, v)[0] : undefined
			if (!category) return p
			seen.add(category)
			return { ...p, category }
		})
	}
	return orderDivideCategories(tw, data.refs?.byTermId?.[tw.$id]?.bins, seen)
}

/** term value(s) of a patient lane: of the patient (a patient-level term), else of all its annotated samples
(e.g. a primary- or PDX-sample term; samples in different categories put the lane in each of them) */
export function getLaneValues(getValue: (id: number) => any, patientId: number, descendantIds: number[] = []): any[] {
	const v = getValue(patientId)
	if (v) return [v]
	return descendantIds.map(getValue).filter(v => v)
}

/** category label(s) of one sample value from getData. a multivalue term returns {values:[{key},..]};
for numeric terms the key is the bin label, for geneVariant terms the group name */
export function getDivideCategories(tw: any, value: any): string[] {
	const keys: string[] = value.values ? value.values.map(v => v.key) : [value.key]
	return keys.filter(k => k !== undefined && k !== null).map(k => tw.term?.values?.[k]?.label || String(k))
}

/** display order of the categories found: bins, then term.values, then the rest alphabetically */
export function orderDivideCategories(tw: any, bins: any[] | undefined, seen: Set<string>): string[] {
	const order: string[] = []
	const add = (label?: string) => {
		if (label && seen.has(label) && !order.includes(label)) order.push(label)
	}
	for (const b of bins || []) add(b.label)
	if (tw.term?.values) {
		const vals = Object.entries(tw.term.values as { [k: string]: any })
		vals.sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
		for (const [k, v] of vals) add(v.label || k)
	}
	for (const label of [...seen].sort((a, b) => a.localeCompare(b))) add(label)
	return order
}

type ParsedSwimmerData = {
	/** keyed by patient name as found in the files */
	bySample: Map<string, { ranges: SwimmerRange[]; points: SwimmerPoint[] }>
	/** counts of dropped rows, for a launch-time warning */
	skipped: { badRange: number; badPoint: number }
}

/** parse the range and point tsv contents.
columns are positional: range = patient, category, start, end; point = patient, event, time, and an
optional 4th column with a sample the event refers to (blank when none).
a range row without a numeric start, or a point row without a numeric time, is dropped and counted.
a range end that is blank or non-numeric (e.g. NA) is kept as null */
export function parseSwimmerFiles(rangeText: string, pointText: string): ParsedSwimmerData {
	const bySample: ParsedSwimmerData['bySample'] = new Map()
	const skipped = { badRange: 0, badPoint: 0 }
	const get = (sample: string) => {
		let d = bySample.get(sample)
		if (!d) {
			d = { ranges: [], points: [] }
			bySample.set(sample, d)
		}
		return d
	}
	for (const line of splitLines(rangeText)) {
		const [sample, category, startStr, endStr] = line.split('\t').map(s => s.trim())
		const start = Number(startStr)
		if (!sample || !category || !startStr || !Number.isFinite(start)) {
			skipped.badRange++
			continue
		}
		const end = Number(endStr)
		get(sample).ranges.push({ category, start, end: endStr && Number.isFinite(end) ? end : null })
	}
	for (const line of splitLines(pointText)) {
		const [sample, event, timeStr, pointSample] = line.split('\t').map(s => s.trim())
		const time = Number(timeStr)
		if (!sample || !event || !timeStr || !Number.isFinite(time)) {
			skipped.badPoint++
			continue
		}
		const point: SwimmerPoint = { event, time }
		if (pointSample) point.sample = pointSample
		get(sample).points.push(point)
	}
	for (const d of bySample.values()) {
		d.ranges.sort((a, b) => a.start - b.start)
		d.points.sort((a, b) => a.time - b.time)
	}
	return { bySample, skipped }
}

/** data lines without the header, blank lines dropped */
function splitLines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.slice(1)
		.filter(l => l.trim())
}

/** keys of SwimmerLegendItem in shared/types dataset.ts */
const legendItemKeys = new Set(['label', 'color', 'shape', 'sampleTerms', 'markBy', 'size', 'clipBeforeOrigin'])

/** called at server launch from mds3.init.js. reads and parses the tsv file(s), drops lane samples absent
from the db or not of a root sample type (lanes are patients), and keeps the result in q.data for the route */
export async function validate_query_swimmer(ds: any) {
	const q = ds.queries?.swimmer
	if (!q) return
	if (q.checkDataAccess && typeof q.checkDataAccess != 'function') throw 'swimmer.checkDataAccess is not a function'
	// either file may be left out (intervals only, or events only), not both
	if (!q.rangeFile && !q.pointFile) throw 'swimmer needs rangeFile, pointFile or both'
	// id2descendantIds() gives the route a patient's samples (e.g. primary/PDX/CSF), so a patient lane passes the
	// leaf-level filter and gets the divide-by values of its samples. both are set with the termdb sampleidmap
	const sampleName2id = ds.cohort?.termdb?.q?.sampleName2id
	if (!sampleName2id || !ds.cohort.termdb.q.id2descendantIds) throw 'swimmer requires a termdb with sampleidmap'
	for (const [key, items] of [
		['categories', q.categories],
		['events', q.events]
	]) {
		if (items === undefined) continue
		if (typeof items != 'object') throw `swimmer.${key} must be an object`
		for (const [k, v] of Object.entries(items as any)) {
			if (!v || typeof v != 'object') throw `swimmer.${key}['${k}'] must be an object`
			const unknownKeys = Object.keys(v).filter(o => !legendItemKeys.has(o))
			if (unknownKeys.length)
				console.warn(`${ds.label} swimmer: ${key}['${k}'] unknown keys: ${unknownKeys.join(', ')}`)
			if ((v as any).shape !== undefined && typeof (v as any).shape != 'string')
				throw `swimmer.${key}['${k}'].shape must be a string`
			if ((v as any).markBy !== undefined && typeof (v as any).markBy != 'boolean')
				throw `swimmer.${key}['${k}'].markBy must be true or false`
			const size = (v as any).size
			if (size !== undefined && !(typeof size == 'number' && size > 0))
				throw `swimmer.${key}['${k}'].size must be a positive number`
			const st = (v as any).sampleTerms
			if (st !== undefined) {
				if (!Array.isArray(st) || st.some(id => typeof id != 'string'))
					throw `swimmer.${key}['${k}'].sampleTerms must be an array of term ids`
				const unknownTerms = st.filter(id => !ds.cohort.termdb.q.termjsonByOneid(id))
				if (unknownTerms.length) {
					console.warn(
						`${ds.label} swimmer: ${key}['${k}'].sampleTerms not in termdb, dropped: ${unknownTerms.join(', ')}`
					)
					;(v as any).sampleTerms = st.filter(id => !unknownTerms.includes(id))
				}
			}
		}
	}
	validateTimeReferences(q.timeReferences)
	const [rangeText, pointText] = await Promise.all(
		[q.rangeFile, q.pointFile].map(f => (f ? fs.promises.readFile(path.join(serverconfig.tpmasterdir, f), 'utf8') : ''))
	)
	const { bySample, skipped } = parseSwimmerFiles(rangeText, pointText)
	q.data = new Map()
	// a lane must be a patient: its sample type has no parent. without sample types every sample is a root
	const sampleTypes = ds.cohort.termdb.sampleTypes
	const id2sampleType = ds.cohort.termdb.q.id2sampleType
	const unknown: string[] = []
	const notPatient: string[] = []
	const unknownPointSamples: string[] = []
	// sample types and events of the point samples of markBy events, for the client's "mark by" term picker
	const pointSampleTypes = new Set<string>()
	const pointSampleEvents = new Set<string>()
	for (const [sample, d] of bySample) {
		const sampleId = sampleName2id(sample)
		if (sampleId === undefined) {
			unknown.push(sample)
			continue
		}
		const laneType = id2sampleType(sampleId)
		if (laneType != null && sampleTypes[laneType]?.parent_id != null) {
			notPatient.push(sample)
			continue
		}
		for (const p of d.points) {
			if (!p.sample) continue
			const id = sampleName2id(p.sample)
			if (id === undefined) {
				// keep the event, drop the link
				unknownPointSamples.push(p.sample)
				delete p.sample
			} else {
				p.sampleId = id
				if (q.events?.[p.event]?.markBy) {
					const type = id2sampleType(id)
					if (type != null) pointSampleTypes.add(String(type))
					pointSampleEvents.add(p.event)
				}
			}
		}
		q.data.set(sample, { sampleId, ...d })
	}
	const list = (a: string[]) => (a.length ? `: ${a.slice(0, 5).join(', ')}${a.length > 5 ? ', ...' : ''}` : '')
	if (skipped.badRange || skipped.badPoint || unknown.length || unknownPointSamples.length) {
		console.warn(
			`${ds.label} swimmer: dropped ${skipped.badRange} range rows and ${skipped.badPoint} point rows with invalid values; ${unknown.length} samples not in db` +
				list(unknown) +
				`; ${unknownPointSamples.length} point samples not in db (event kept, not clickable)` +
				list(unknownPointSamples)
		)
	}
	if (notPatient.length)
		console.warn(
			`${ds.label} swimmer: dropped ${notPatient.length} lanes of non-patient samples (sample type has a parent)` +
				list(notPatient)
		)
	if (!q.data.size) throw 'swimmer: no patients with data found in db'
	for (const ref of q.timeReferences || []) {
		if (!ref.event) continue
		let missing = 0
		for (const d of q.data.values()) if (!d.points.some(p => p.event == ref.event)) missing++
		// e.g. a misspelled event, which would leave the view empty
		if (missing == q.data.size) throw `swimmer.timeReferences['${ref.key}']: no patient has a '${ref.event}' point`
		if (missing)
			console.warn(
				`${ds.label} swimmer: ${missing} patients have no '${ref.event}' point, not shown with time reference '${ref.key}'`
			)
	}
	if (pointSampleTypes.size) q.pointSampleTypes = [...pointSampleTypes]
	if (pointSampleEvents.size) q.pointSampleEvents = [...pointSampleEvents]
}

function validateTimeReferences(refs: any) {
	if (refs === undefined) return
	if (!Array.isArray(refs) || !refs.length) throw 'swimmer.timeReferences must be a non-empty array'
	const keys = new Set<string>()
	for (const r of refs) {
		if (!r || typeof r != 'object') throw 'swimmer.timeReferences[] must be objects'
		if (typeof r.key != 'string' || !r.key) throw 'swimmer.timeReferences[].key must be a non-empty string'
		if (keys.has(r.key)) throw `swimmer.timeReferences: duplicate key '${r.key}'`
		keys.add(r.key)
		if (typeof r.timeLabel != 'string') throw `swimmer.timeReferences['${r.key}'].timeLabel must be a string`
		if (r.event !== undefined && (typeof r.event != 'string' || !r.event))
			throw `swimmer.timeReferences['${r.key}'].event must be a non-empty string`
		if (r.label !== undefined && typeof r.label != 'string')
			throw `swimmer.timeReferences['${r.key}'].label must be a string`
		if (r.isDefault !== undefined && typeof r.isDefault != 'boolean')
			throw `swimmer.timeReferences['${r.key}'].isDefault must be a boolean`
	}
	if (refs.filter(r => r.isDefault).length > 1) throw 'swimmer.timeReferences: more than one isDefault'
}
