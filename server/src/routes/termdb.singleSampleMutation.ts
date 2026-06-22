import path from 'path'
import { read_file, file_is_readable, fileurl, illegalpath } from '#src/utils.js'
import type {
	TermdbSingleSampleMutationRequest,
	TermdbSingleSampleMutationResponse,
	RouteApi,
	RoutePayload
} from '#types'
import { gdcValidate_query_singleSampleMutation } from '#src/mds3.gdc.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbSingleSampleMutationRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSingleSampleMutationResponse' }
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
export async function validate_query_singleSampleMutation(ds: any, genome: any) {
	const _q = ds.queries.singleSampleMutation
	if (!_q) return
	if (typeof _q.get == 'function') {
		// ds supplied
	} else if (_q.src == 'gdcapi') {
		gdcValidate_query_singleSampleMutation(ds, genome)
	} else if (_q.src == 'native') {
		/* using a folder to store text files for individual samples
		file names are string sample name
		throws on any error
		*/
		_q.get = async (q: TermdbSingleSampleMutationRequest) => {
			let sample: string
			{
				const vt = typeof q.sample // to only compute value type once
				if (vt == 'string') {
					if (q.sample == '') throw 'sample is blank string'
					sample = q.sample as string // accepted
				} else if (vt == 'number') {
					// termdbtest and possibly other ds may use integer as sample name, which is not allowed by path.join(), thus need to call toString()
					sample = q.sample.toString()
				} else {
					throw 'sample value is not string or number'
				}
			}

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
	} else {
		throw 'unknown singleSampleMutation.src'
	}
}
