import path from 'path'
import { read_file, file_is_readable } from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import type { TermdbSingleSampleMutationRequest, TermdbSingleSampleMutationResponse, RouteApi } from '#types'
import { termdbSingleSampleMutationPayload } from '#types/checkers'
import { gdcValidate_query_singleSampleMutation } from '#src/mds3.gdc.js'

export const api: RouteApi = {
	endpoint: 'termdb/singleSampleMutation',
	methods: {
		get: {
			...termdbSingleSampleMutationPayload,
			init
		}
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
	if (_q.src == 'gdcapi') {
		gdcValidate_query_singleSampleMutation(ds, genome)
	} else if (_q.src == 'native') {
		/* using a folder to store text files for individual samples
		file names are string sample name
		getter will throw on any error
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

			const file = path.join(serverconfig.tpmasterdir, _q.folder, sample)
			await file_is_readable(file)
			const data = await read_file(file)
			// object wraps around mlst[] so it's possible to add other attr e.g. total number of mutations that exceeds viewing limit
			return { mlst: JSON.parse(data) }
		}
	} else {
		throw 'unknown singleSampleMutation.src'
	}
}
