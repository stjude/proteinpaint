import type { RoutePayload } from './routeApi.js'

export type ProfileImpressionDistributionRequest = {
	scTermId: string
	// Optional: omitted when the module has no POC term (e.g. Patients & Outcomes,
	// which is SC-only by design). When absent, the server returns pocTotal=0,
	// pocMedian=null, pocDistribution=[] and the client renders an SC-only thermometer.
	pocTermId?: string
	maxScore: number
	filter?: any
	filterByUserSites?: boolean
}

export type ProfileImpressionDistributionResponse = {
	scMedian: number | null
	scTotal: number
	pocMedian: number | null
	pocTotal: number
	pocDistribution: { rating: number; count: number; pct: number }[]
	sites: { label: string; value: string }[]
	n: number
}

export const ProfileImpressionDistributionPayload: RoutePayload = {
	request: {
		typeId: 'ProfileImpressionDistributionRequest'
	},
	response: {
		typeId: 'ProfileImpressionDistributionResponse'
	}
}
