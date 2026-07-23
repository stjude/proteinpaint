export type ProfileImpressionDistributionRequest = {
	scTermId: string
	// Optional: omitted when the module has no POC term (e.g. Patients & Outcomes,
	// which is SC-only by design). When absent, the server returns responders: []
	// and the client renders a single SC-only thermometer.
	pocTermId?: string
	/*
	Responder-level multivalue impression terms (POCFimpression_mod*) under the same
	__Impression domain. A module may carry several (e.g. PHO, Nurses, Clinicians).
	When present, the server builds one responders[] entry per term (median/total/distribution
	per responder group) instead of a single per-site aggregate. When absent and pocTermId is
	provided, the server falls back to a single per-site POC entry in responders[].
	*/
	pocResponderTermIds?: string[]
	maxScore: number
	filter?: any
	filterByUserSites?: boolean
}

// One thermometer per responder group (POCFimpression_* term) under the domain.
export type ProfileImpressionResponderDistribution = {
	termId: string
	// Display label for the responder group (term name, with a leading "Impression " stripped),
	// e.g. "PHO & Nurses" / "Clinicians".
	label: string
	median: number | null
	total: number
	distribution: { rating: number; count: number; pct: number }[]
}

export type ProfileImpressionDistributionResponse = {
	scMedian: number | null
	scTotal: number
	/*
	Site-Coordinator frequency distribution: one count per integer rating 1..maxScore, built
	from the per-site SC values. Shared across every responder group (the SC series is the same
	in each chart pair), and drives the SC line on the response-distribution chart.
	*/
	scDistribution: { rating: number; count: number; pct: number }[]
	// One entry per responder group, each rendered as its own thermometer (side by side).
	// Empty for SC-only modules (e.g. Patients & Outcomes) → a single SC-only thermometer.
	responders: ProfileImpressionResponderDistribution[]
	sites: { label: string; value: string }[]
	n: number
}
