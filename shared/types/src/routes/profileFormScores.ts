import type { RoutePayload } from './routeApi.js'

export type ProfileFormScoresRequest = {
	scoreTerms: any[]
	scScoreTerms?: any[]
	filter?: any
	userSites?: string[]
	site?: string
	isAggregate?: boolean
}

export type ProfileFormScoresResponse = {
	term2Score: { [termId: string]: { [key: string]: number } }
	sites: { label: string; value: string }[]
	hospital?: string
	n: number
}

export const ProfileFormScoresPayload: RoutePayload = {
	request: {
		typeId: 'ProfileFormScoresRequest'
	},
	response: {
		typeId: 'ProfileFormScoresResponse'
	}
}
