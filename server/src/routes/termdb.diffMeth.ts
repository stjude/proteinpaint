import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/termdb.diffMeth.ts'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.queries.dnaMethylation
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
	request: { typeId: 'DiffMethRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DiffMethResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/diffMeth',
	methods: {
		get: payload,
		post: payload
	}
}

/* also used by the other methylation routes (termdb.dmr*, termdb.geneBodyMeth) to decide if they are set up */
export function hasDnaMethylationDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.queries?.dnaMethylation)
	)
}
