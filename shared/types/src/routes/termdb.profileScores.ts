import type { RoutePayload } from './routeApi.js'

export type ProfileScoresRequest = {
	scoreTerms: { score: any; maxScore?: any }[]
	filter?: any
	isRadarFacility?: boolean
	userSites?: string[]
	sites?: string[]
	isAggregate?: boolean
	facilityTW?: any
}

export type ProfileScoresResponse = {
	term2Score: { [termId: string]: number }
	sites: { label: string; value: string }[]
	hospital?: string
	n: number
}

export const ProfileScoresPayload: RoutePayload = {
	request: {
		typeId: 'ProfileScoresRequest'
	},
	response: {
		typeId: 'ProfileScoresResponse'
	}
}
