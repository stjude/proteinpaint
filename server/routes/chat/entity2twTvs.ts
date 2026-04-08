export function convert2TwTvs(
	match: { id: string; name: string; score: number }, // Dictionary match result
	type: string, // 'summary', 'de', or 'matrix'
	key: string, // tw1, tw2, tw3, or filter
	ds: any
) {
	if (type === 'summary') {
		const term = ds.cohort.termdb.q.termjsonByOneid(match.id)
		if (key === 'tw1' || key === 'tw2' || key === 'tw3') {
			// Generate tw object
			if (!term) throw new Error(`Invalid term id: ${match.id}`)
			const tw = { id: term.id }
			return tw
		} else if (key === 'filter') {
			// Generate tvslst object for filter
			if (!term) throw new Error(`Invalid filter term id: ${match.id}`)
			return {
				type: 'tvslst',
				in: true,
				lst: [{ type: 'tvs', tvs: { term } }]
			}
		} else {
			throw new Error(`Unknown key: ${key}`)
		}
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}
