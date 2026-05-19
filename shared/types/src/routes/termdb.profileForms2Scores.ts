export type ProfileForms2ScoresRequest = {
	// q is optional: term wrappers from getMultivalueTWs() carry no q field,
	// and JSON.stringify drops `q: undefined`, so the field may be absent on the wire.
	scoreTerms: { term: { id: string }; q?: any }[]
	scScoreTerms?: { term: { id: string }; q?: any }[]
	filter?: any
	filterByUserSites?: boolean
}

export type ProfileForms2ScoresResponse = {
	term2Score: { [termId: string]: { [category: string]: number } }
	sites: { label: string; value: string }[]
	n: number
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
