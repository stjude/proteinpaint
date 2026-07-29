import path from 'path'
import { read_file, file_is_readable, fileurl, illegalpath } from '#src/utils.js'
import { validGenomeDs } from '#routes/common.ts'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse,
	RouteApi,
	RoutePayload
} from '#types'

export const payload: RoutePayload = {
	init,
	request: {
		typeId: 'TermdbSingleSampleMutationRequest',
		checker: validTermdbSingleSampleMutationRequest
	},
	response: { typeId: 'TermdbSingleSampleMutationResponse' }
}

/* q.skipDt and (for gdc) q.cnvType are server-internal, set only by callers that invoke the getter
directly (GRIN2); they never arrive over http, and the middleware merges this return onto req.query
rather than replacing it, so not listing them here does not drop them. */
function validTermdbSingleSampleMutationRequest(input): TermdbSingleSampleMutationRequest {
	// sample is typed string|number -- termdbtest and possibly other ds use integer sample names.
	// normalize to string, which is what every getter and path.join() actually needs. rejects a
	// missing sample and the array express yields for a repeated ?sample=
	const vt = typeof input.sample
	if (vt != 'string' && vt != 'number') throw 'sample must be a string or number'
	const sample = String(input.sample)
	if (!sample) throw 'sample is blank'
	return { ...validGenomeDs(input), sample }
}

export const api: RouteApi = {
	endpoint: 'termdb/singleSampleMutation',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermdbSingleSampleMutationRequest = req.query
		let result
		try {
			const g = genomes[q.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.queries?.singleSampleMutation) throw 'not supported on this dataset'
			result = await ds.queries.singleSampleMutation.get(q)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = {
				status: e.status || 400,
				error: e.message || e
			}
		}
		res.send(result satisfies TermdbSingleSampleMutationResponse)
	}
}

/////////////////// ds query validator
export async function validate_query_singleSampleMutation(ds: any, _genome: any) {
	const _q = ds.queries.singleSampleMutation
	if (!_q) return
	// a ds either supplies get(), or gets the built-in folder-based getter added here
	if (typeof _q.get != 'function') {
		// folder is optional on the type, since a ds supplying get() has no use for it. without a
		// getter it is required, so enforce here
		if (!_q.folder) throw 'singleSampleMutation.folder missing'
		/* using a folder to store text files for individual samples
		file names are string sample name
		throws on any error
		*/
		_q.get = async (q: TermdbSingleSampleMutationRequest) => {
			// the route checker already normalizes sample to a non-empty string, but GRIN2 calls this
			// getter directly and bypasses it, so normalize here too
			const sample = typeof q.sample == 'number' ? String(q.sample) : q.sample
			if (typeof sample != 'string' || !sample) throw 'sample must be a non-empty string or number'

			// *pre* screening of file name. in case sample name has "../" to traverse back on dir structure, this will be allowed by path.join() resulting in unauthorized access, thus must be screened outside of fileurl()
			if (illegalpath(sample)) throw 'invalid sample name'
			// simulate a req obj as fileurl() input; MUST run this to guard against sample=../../../xx
			const tmp: any = fileurl({
				query: {
					file: path.join(_q.folder, sample)
				}
			})
			if (tmp[0]) throw tmp[0]
			const file: string = tmp[1]
			if (!file) throw 'no file returned'
			await file_is_readable(file)
			const data = await read_file(file)
			let mlst = JSON.parse(data)
			// caller (e.g. GRIN2) may only want a subset of dt; drop the rest before returning.
			// skipDt is a server-internal Set; guard with instanceof so a malformed client-sent value
			// (POST bodies merge into req.query) can't reach .has() and turn into a 500
			if (q.skipDt instanceof Set && q.skipDt.size && Array.isArray(mlst)) {
				mlst = mlst.filter((m: any) => !q.skipDt!.has(m.dt))
			}
			// object wraps around mlst[] so it's possible to add other attr e.g. total number of mutations that exceeds viewing limit
			return { mlst }
		}
	}
}
