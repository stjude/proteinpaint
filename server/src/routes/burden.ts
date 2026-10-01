import type { RoutePayload, RouteApi } from '#types'
import { init } from '../../routes/burden.ts'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.cohort.cumburden
	get init() {
		return hasCumburdenDs(genomes) ? init : null
	},
	request: { typeId: 'BurdenRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'BurdenResponse' }
}

export const api: RouteApi = {
	endpoint: 'burden',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasCumburdenDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.cohort?.cumburden)
	)
}
