import type { RouteApi, RoutePayload, TermdbFacetRequest, TermdbFacetResponse } from '#types'
import { getData } from '#src/termdb.matrix.js'
import { getTermSampleTypeIds, mapParent2ChildrenWithSampleTypes } from '#src/utils/sampleTypes.ts'
import { mayLimitSamples } from '#src/mds3.filter.js'
import type { ReqQueryAddons } from './types.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'TermdbFacetRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbFacetResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/facet',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbFacetRequest & ReqQueryAddons = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'

			const facet = ds.queries?.trackLst?.facets?.find(i => i.name == q.facetname)
			if (!facet) throw 'invalid facetname'
			if (!Array.isArray(facet.tracks)) throw 'facet.tracks[] missing'

			let tracks = facet.tracks
			if (q.filter) {
				/* the samples of the filter, its cases mapped to their samples as for the other tracks of the genome
				browser. The chosen sample types are kept below, so that none of them leaves no track */
				const param: any = { filter: q.filter, __protected__: q.__protected__ }
				mapParent2ChildrenWithSampleTypes(param, ds)
				// undefined for a filter that limits nothing
				const samples = await mayLimitSamples(param, null, ds)
				if (samples) tracks = facet.tracks.filter(track => samples.has(ds.cohort.termdb.q.sampleName2id(track.sample)))
			}
			// chosen in the sample type row of the genome browser
			const sampleTypes = getTermSampleTypeIds(q, ds)
			if (sampleTypes)
				tracks = tracks.filter(track =>
					sampleTypes.includes(ds.sampleId2Type?.get(ds.cohort.termdb.q.sampleName2id(track.sample)))
				)

			const response: TermdbFacetResponse = { tracks }
			if (q.twLst) {
				if (!Array.isArray(q.twLst)) throw 'twLst must be an array'
				if (q.twLst.length) {
					const data = await getData(
						{ terms: q.twLst, filter: q.filter, __protected__: q.__protected__, __abortSignal: q.__abortSignal },
						ds
					)
					if (data.error) throw new Error(data.error)
					response.samples = getResponseSamples(tracks, q.twLst, data)
				}
			}

			res.send(response)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

function getResponseSamples(tracks: any[], twLst: any[], data: any) {
	const trackSampleNames = new Set(tracks.map(track => track.sample).filter(Boolean))
	const samples: { [sampleId: string]: { [twId: string]: string | number } } = {}

	for (const [sampleId, sampleData] of Object.entries((data.samples || {}) as { [sampleId: string]: any })) {
		const sampleName = data.refs?.bySampleId?.[sampleId]?.label || sampleData.sampleName || sampleData.name || sampleId
		if (!trackSampleNames.has(sampleName)) continue

		samples[sampleName] = {}
		for (const tw of twLst) {
			const annotation = sampleData[tw.$id]
			if (annotation?.key !== undefined) samples[sampleName][tw.$id] = annotation.key
		}
	}

	return samples
}
