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
import { get_samples } from '#src/termdb.sql.js'
import { resolveSampleMapping } from '#src/termdb.matrix.js'
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
			if (!authApi.canDisplaySampleIds(req, ds)) return res.send({})
			const result = await getSamplesByName(q, ds)
			res.send(result)
		} catch (e: any) {
			if (e?.stack) console.log(e.stack)
			const result: TermdbGetSamplesByNameResponse = { status: 400, error: e?.message || e }
			res.send(result)
		}
	}
}

/** returns samples by sample name; also called by relatedSamples and omnisearch */
export async function getSamplesByName(q: any, ds: any): Promise<SamplesByName> {
	let samples
	// map parents to children
	// if patient-level filter defined, then patients will
	// be filtered and then mapped to child samples,
	// parents of these child samples will then be added
	// by addParentSamples()
	resolveSampleMapping(Object.assign(q, { sampleMapping: 'parentToChildren' }), ds)
	if (ds.cohort?.db) {
		samples = await get_samples(q, ds, true)
	} else {
		const limitSamples = await mayLimitSamples(q, null, ds)
		samples = []
		for (const [name, id] of ds.sampleName2Id) {
			if (limitSamples && !limitSamples.has(id)) continue
			samples.push({ id, name })
		}
	}

	const sampleName2Id = new Map<string, SampleByName>()
	if (ds.cohort?.termdb?.hasSampleAncestry) {
		// ds has sample ancestry
		addParentSamples(samples, ds)
		for (const sample of samples) {
			const name = sample.name ?? ds.sampleId2Name?.get?.(sample.id)
			const refs = ds.cohort.termdb.q?.id2sampleRefs?.(sample.id)
			// nearest ancestor
			const ancestor_id = refs?.ancestors?.[0]?.ancestor_id
			sampleName2Id.set(name, {
				id: sample.id,
				name,
				ancestor_id,
				ancestor_name: ds.sampleId2Name?.get?.(ancestor_id),
				sample_type: ds.sampleId2Type?.get?.(sample.id)
			})
		}
	} else {
		// no sample ancestry
		for (const sample of samples) {
			const name = sample.name ?? ds.sampleId2Name?.get?.(sample.id)
			sampleName2Id.set(name, { id: sample.id, name })
		}
	}

	return Object.fromEntries(sampleName2Id)
}

export function addParentSamples(samples: any[], ds: any): void {
	if (!ds.cohort?.termdb?.hasSampleAncestry) return
	const ids = new Set(samples.map(sample => sample.id))
	for (let i = 0; i < samples.length; i++) {
		const sample = samples[i]
		const ancestors = ds.cohort.termdb.q?.id2sampleRefs?.(sample.id)?.ancestors
		if (!ancestors) continue
		for (const ancestor of ancestors) {
			const id = ancestor.ancestor_id
			if (id == null || ids.has(id)) continue
			ids.add(id)
			samples.push({ id, name: ds.sampleId2Name?.get?.(id) })
		}
	}
}
