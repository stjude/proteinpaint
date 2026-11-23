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
import { get_samples, mayResolveSampleMapping } from '#src/termdb.sql.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
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
		let samples
		if (ds.cohort?.db) {
			samples = await get_samples(q, ds, true)
		} else {
			mayResolveSampleMapping(q, ds)
			const limitSamples = await mayLimitSamples(q, null, ds)
			samples = []
			for (const [name, id] of ds.sampleName2Id) {
				if (limitSamples && !limitSamples.has(id)) continue
				samples.push({ id, name })
			}
		}
		for (const sample of samples) {
			const refs = ds.cohort.termdb.q?.id2sampleRefs?.(sample.id)
			const ancestor_id = refs?.ancestors?.[0]?.ancestor_id
			const name = sample.name ?? ds.sampleId2Name?.get?.(sample.id)
			sampleName2Id.set(name, {
				id: sample.id,
				name,
				ancestor_id,
				ancestor_name: ds.sampleId2Name?.get?.(ancestor_id),
				sample_type: ds.sampleId2Type?.get?.(sample.id)
			})
		}
		const result: SamplesByName = Object.fromEntries(sampleName2Id)
		res.send(result)
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}
