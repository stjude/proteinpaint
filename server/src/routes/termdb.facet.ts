import type { RouteApi, RoutePayload, TermdbFacetRequest, TermdbFacetResponse } from '#types'
import { get_samples } from '#src/termdb.sql.js'
import { getData } from '#src/termdb.matrix.js'
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
				const samples = await get_samples({ filter: q.filter }, ds, true)
				const sampleNames = new Set(samples.map(i => i.name))
				tracks = facet.tracks.filter(track => sampleNames.has(track.sample))
			}

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
