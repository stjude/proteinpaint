import fs from 'fs'
import path from 'path'
import { read_file } from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
import type { TermdbSingleSampleMutationRequest, TermdbSingleSampleMutationResponse, RouteApi } from '#types'
import { termdbSingleSampleMutationPayload } from '#types'
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
		// using a folder to store text files for individual samples
		// file names are integer sample id
		_q.get = async (q: TermdbSingleSampleMutationRequest) => {
			/* as mds3 client may not be using integer sample id for now,
			the argument is string id and has to be mapped to integer id
			*/
			let fileName = q.sample
			if (ds.cohort?.termdb?.q?.sampleName2id) {
				// has name-to-id converter
				fileName = ds.cohort.termdb.q.sampleName2id(q.sample)
				if (fileName == undefined) {
					// unable to convert string id to integer
					return []
				}
			}

			const file = path.join(serverconfig.tpmasterdir, _q.folder, fileName.toString())
			try {
				await fs.promises.stat(file)
			} catch (e: any) {
				if (e.code == 'EACCES') throw 'cannot read file, permission denied'
				if (e.code == 'ENOENT') throw 'no data for this sample'
				throw 'failed to load data'
			}

			const data = await read_file(file)
			// object wraps around mlst[] so it's possible to add other attr e.g. total number of mutations that exceeds viewing limit
			return { mlst: JSON.parse(data) }
		}
	} else {
		throw 'unknown singleSampleMutation.src'
	}
}
