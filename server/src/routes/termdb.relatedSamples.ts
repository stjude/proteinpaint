import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { get_samples } from '#src/termdb.sql.js'
import { ROOT_SAMPLE_TYPE } from '#shared/terms.js'
import { validGenomeDs } from '#routes/common.ts'
import type {
	RelatedSample,
	RouteApi,
	RoutePayload,
	TermdbRelatedSamplesRequest,
	TermdbRelatedSamplesResponse
} from '#types'

/*
 termdb/relatedSamples — the samples related to a sample, for the sample view: the samples under its root sample
 (e.g. a patient's primary, PDX and CSF samples), and the root sample. Only the samples passing q.filter are
 included, as the sample list of termdb/getSamplesByName gives them, so that both list the same samples.
*/

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbRelatedSamplesRequest', checker: validRequest },
	response: { typeId: 'TermdbRelatedSamplesResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/relatedSamples',
	middlewares: [protectedRoutes.termdb, protectedRoutes.samples],
	methods: { get: payload, post: payload }
}

/** a sample passing the filter, with the id of its parent sample */
export type SampleRow = { id: number; ancestor_id?: number | null }

export function validRequest(input): TermdbRelatedSamplesRequest {
	// a GET request carries the id as a string
	const sampleId = Number(input.sampleId)
	if (input.sampleId === '' || input.sampleId == null || !Number.isInteger(sampleId))
		throw 'sampleId must be an integer'
	return { ...validGenomeDs(input), sampleId }
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		let result: TermdbRelatedSamplesResponse
		try {
			const q = req.query
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw 'invalid genome or dataset'
			if (!authApi.canDisplaySampleIds(req, ds)) throw { status: 401, message: 'Requires sign in to access samples' }
			result = await getRelatedSamples(q, ds)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = { status: e.status || 400, error: e.message || e }
		}
		res.send(result)
	}
}

async function getRelatedSamples(q: TermdbRelatedSamplesRequest, ds: any): Promise<TermdbRelatedSamplesResponse> {
	const samples = await get_samples(q, ds)
	const rows: SampleRow[] = samples.map(({ id }) => ({
		id,
		ancestor_id: ds.cohort.termdb.q?.id2sampleRefs?.(id)?.ancestors?.[0]?.ancestor_id
	}))
	const tdbq = ds.cohort.termdb.q
	return relateSamples(
		rows,
		q.sampleId,
		id => tdbq.id2sampleName(id),
		id => tdbq.id2sampleType(id)
	)
}

/** the samples under the root of sampleId among rows, in tree order with children sorted by name, and the root */
export function relateSamples(
	rows: SampleRow[],
	sampleId: number,
	getName: (id: number) => string,
	getType: (id: number) => number | null | undefined
): TermdbRelatedSamplesResponse {
	// the parent of each sample; a root sample is listed with no parent, and may be listed twice: once as a sample
	// passing the filter, once as the root of one
	const parentOf = new Map<number, number | null>()
	for (const r of rows) {
		const parent = r.ancestor_id ?? null
		if (parent != null || !parentOf.has(r.id)) parentOf.set(r.id, parent)
	}
	if (!parentOf.has(sampleId)) return { samples: [] }

	// the nearest ancestor without a parent passing the filter; seen guards against a cycle in malformed data
	let rootId = sampleId
	const seen = new Set([rootId])
	for (let p = parentOf.get(rootId); p != null && parentOf.has(p) && !seen.has(p); p = parentOf.get(rootId)) {
		rootId = p
		seen.add(p)
	}

	const children = new Map<number, number[]>()
	for (const [id, parent] of parentOf) {
		if (parent == null) continue
		if (!children.has(parent)) children.set(parent, [])
		children.get(parent)!.push(id)
	}
	const toSample = (id: number): RelatedSample => ({ sampleId: id, sampleName: getName(id) })
	const byName = (a: RelatedSample, b: RelatedSample) => {
		const na = Number(a.sampleName)
		const nb = Number(b.sampleName)
		return !isNaN(na) && !isNaN(nb) ? na - nb : a.sampleName.localeCompare(b.sampleName)
	}

	const samples: RelatedSample[] = []
	const root = toSample(rootId)
	// a root of the root sample type with children only groups them, e.g. a patient without data of its own
	if (getType(rootId) !== ROOT_SAMPLE_TYPE || !children.get(rootId)?.length) samples.push(root)
	const listed = new Set([rootId])
	const visit = (id: number) => {
		for (const kid of (children.get(id) || []).map(toSample).sort(byName)) {
			if (listed.has(kid.sampleId)) continue
			listed.add(kid.sampleId)
			samples.push(kid)
			visit(kid.sampleId)
		}
	}
	visit(rootId)
	return { samples, root }
}
