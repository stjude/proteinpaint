import type { RouteApi, RoutePayload, TermdbMds3VariantDataRequest, TermdbMds3VariantDataResponse } from '#types'
import { get_mds3variantData } from '#src/mds3.variant.js'
import { genomes } from '#src/initGenomesDs.js'
import { validGenomeDs } from '#routes/common.ts'

export const payload: RoutePayload = {
	get init() {
		return hasMds3VariantDataDs(genomes) ? init : null
	},
	request: {
		typeId: 'TermdbMds3VariantDataRequest',
		checker: validTermdbMds3VariantDataRequest
	},
	response: { typeId: 'TermdbMds3VariantDataResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/mds3/variantData',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasMds3VariantDataDs(genomes) {
	return Object.values(genomes).some((genome: any) =>
		[...Object.values(genome.datasets || {}), ...Object.values(genome.termdbs || {})].some(
			(ds: any) => ds.queries?.snvindel?.details
		)
	)
}

export function validTermdbMds3VariantDataRequest(input): TermdbMds3VariantDataRequest {
	const ids = validGenomeDs(input)
	if (typeof input.chr != 'string' || !input.chr) throw 'q.chr missing'
	return { ...input, ...ids }
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		const q: TermdbMds3VariantDataRequest = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome name'
			const ds = genome.datasets?.[q.dslabel] || genome.termdbs?.[q.dslabel]
			if (!ds) throw 'invalid dataset name'
			if (!ds.cohort?.termdb) throw '.cohort.termdb not found on this dataset'
			await get_mds3variantData(q, res, ds, genome)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ status: e.status || 400, error: e.message || e } satisfies TermdbMds3VariantDataResponse)
		}
	}
}
