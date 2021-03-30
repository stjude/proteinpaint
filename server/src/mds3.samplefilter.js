export function parsearg(q) {
	// q is client request
	if (q.samplefiltertemp) {
		const j = JSON.parse(q.samplefiltertemp)
		const key2values = new Map()
		for (const k in j) {
			const lst = j[k]
			if (lst.length) {
				key2values.set(k, new Set(lst))
			}
		}
		if (key2values.size) return key2values
	}
	return null
}

export function run(samples, filter) {
	// filter is samplefiltertemp
	const keep = []
	for (const sample of samples) {
		let hidden
		for (const [key, hiddencategories] of filter) {
			const value = sample[key]
			if (value != undefined && hiddencategories.has(value)) {
				hidden = true
				break
			}
		}
		if (!hidden) keep.push(sample)
	}
	return keep
}
