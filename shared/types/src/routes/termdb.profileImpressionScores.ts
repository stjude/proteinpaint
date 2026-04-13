import type { RoutePayload } from './routeApi.js'

export type ProfileImpressionScoresRequest = {
	impressionTerms: any[]
	filter?: any
	facilityTW?: any
	filterByUserSites?: boolean
	facilitySite?: string
}

export type ImpressionSiteValue = {
	siteId: string
	siteLabel: string
	value: number
}

export type ImpressionTermScore = {
	median: number
	distribution: Record<number, number>
	values: ImpressionSiteValue[]
}

export type ProfileImpressionScoresResponse = {
	term2Scores: { [termId: string]: ImpressionTermScore }
	sites: { label: string; value: string }[]
	hospital?: string
	n: number
}

export const ProfileImpressionScoresPayload: RoutePayload = {
	request: {
		typeId: 'ProfileImpressionScoresRequest'
	},
	response: {
		typeId: 'ProfileImpressionScoresResponse'
	}
}
