import type {
	RouteApi,
	RoutePayload,
	SampleByName,
	SamplesByName,
	TermdbGetSamplesByNameRequest,
	TermdbGetSamplesByNameResponse
} from '#types'
import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { get_ds_tdb } from '#src/termdb.js'
import { get_samples, get_samples_ancestry } from '#src/termdb.sql.js'
import serverconfig from '#src/serverconfig.js'

/*
termdb/getSamplesByName: the samples of a dataset by sample name, for the sample search of the scatter plot
and the sample picker of the sample view. Only the samples passing q.filter are given, or all samples of the
dataset when there is no filter. Empty when the request may not read sample names.
*/

export const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_getSamplesByName
	get init() {
		return serverconfig.features.disableFeature_getSamplesByName ? null : init
	},
	request: { typeId: 'TermdbGetSamplesByNameRequest' },
	response: { typeId: 'TermdbGetSamplesByNameResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/getSamplesByName',
	// the handler calls authApi.canDisplaySampleIds()
	middlewares: [protectedRoutes.samples],
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: TermdbGetSamplesByNameRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			await getSamplesByName(q, req, res, ds)
		} catch (e: any) {
			if (e?.stack) console.log(e.stack)
			const result: TermdbGetSamplesByNameResponse = { status: 400, error: e?.message || e }
			res.send(result)
		}
	}
}

/** sends the samples by sample name with res.send(); also called by the omnisearch of termdb/chat,
 *  with a res stub that captures the response */
export async function getSamplesByName(q: any, req: any, res: any, ds: any): Promise<void> {
	if (!authApi.canDisplaySampleIds(req, ds)) return res.send({})

	try {
		const sampleName2Id = new Map<string, SampleByName>()
		if (q.filter) {
			q.ds = ds
			const filteredSamples = ds.cohort.termdb.hasSampleAncestry
				? await get_samples_ancestry(q.filter, q.ds, true)
				: await get_samples(q, q.ds, true)
			for (const sample of filteredSamples) {
				const name = ds.sampleId2Name.get(sample.id)
				sampleName2Id.set(name, {
					id: sample.id,
					name,
					ancestor_id: sample.ancestor_id,
					ancestor_name: ds.sampleId2Name.get(sample.ancestor_id),
					sample_type: ds.sampleId2Type.get(sample.id)
				})
			}
		} else {
			for (const [name, id] of ds.sampleName2Id) sampleName2Id.set(name, { id })
		}
		const result: SamplesByName = Object.fromEntries(sampleName2Id)
		res.send(result)
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}
