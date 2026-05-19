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

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
