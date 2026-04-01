import type { RoutePayload } from './routeApi.ts'

export type TermdbIsoformAvailabilityRequest = {
	genome: string
	dslabel: string
	/** candidate ENST IDs to check */
	isoforms: string[]
}

export type TermdbIsoformAvailabilityResponse = {
	/** subset of input isoforms that have data in the HDF5 */
	available: string[]
}

export const TermdbIsoformAvailabilityPayload: RoutePayload = {
	request: {
		typeId: 'TermdbIsoformAvailabilityRequest'
	},
	response: {
		typeId: 'TermdbIsoformAvailabilityResponse'
	}
}
