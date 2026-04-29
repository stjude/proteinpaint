import type { RoutePayload } from './routeApi.js'

export type ProfileForms2ScoresRequest = {
	scoreTerms: { term: { id: string }; q: any }[]
	scScoreTerms?: { term: { id: string }; q: any }[]
	filter?: any
	filterByUserSites?: boolean
}

export type ProfileForms2ScoresResponse = {
	term2Score: { [termId: string]: { [category: string]: number } }
	sites: { label: string; value: string }[]
	n: number
}

export const ProfileForms2ScoresPayload: RoutePayload = {
	request: {
		typeId: 'ProfileForms2ScoresRequest'
	},
	response: {
		typeId: 'ProfileForms2ScoresResponse'
	}
}
