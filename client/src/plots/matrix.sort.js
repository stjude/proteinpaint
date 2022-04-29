/*
	Sorting code are
*/

export function getSampleSorter(self, s, rows) {
	if (s.sortSamplesBy == 'asListed') {
		//no additional logic required
		return (a, b) => {
			for (const s of self.sampleOrder) {
				if (s.row.sample === a.sample) return -1
				if (s.row.sample === b.sample) return 1
				return 0
			}
		}
	}

	if (s.sortSamplesBy != 'selectedTerms') {
		throw `unsupported s.sortSamplesBy='${s.sortSamplesBy}'`
	}

	const sorterTerms = [
		...self.termOrder
			.filter(t => t.tw.sortSamples)
			.map(t => t.tw)
			.sort((a, b) => a.sortSamples.priority - b.sortSamples.priority),
		...self.config.settings.matrix.sortSamplesTieBreakers.map(st => st)
	]
	self.sampleSorters = []
	for (const st of sorterTerms) {
		if (st.$id == 'sample') self.sampleSorters.push(sortSamplesByName)
		else if (st.sortSamples.by == 'hits') self.sampleSorters.push(getSortSamplesByHits(st.$id, self, rows))
		else if (st.sortSamples.by == 'values') self.sampleSorters.push(getSortSamplesByValues(st.$id, self, rows))
		else throw `unsupported sortSamplesBy entry by='${st.sortSamples.by}'`
	}

	// default to always use sortSamplesByName as a tie-breaker
	if (!self.sampleSorters.find(f => f.$id === 'sample')) {
		self.sampleSorters.push(sortSamplesByName)
	}

	return (a, b) => {
		for (const sorter of self.sampleSorters) {
			const i = sorter(a, b)
			if (i !== 0) return i
		}
	}
}

function sortSamplesByName(a, b) {
	const k = a.sample
	const l = b.sample
	if (k < l) return -1
	if (k > l) return 1
	return 0
}

function getSortSamplesByHits($id, self, rows) {
	const hits = {}
	for (const row of rows) {
		if (!($id in row)) hits[row.sample] = 0
		else hits[row.sample] = row[$id].values ? row[$id].values.length : 1
	}

	return (a, b) => (hits[a.sample] == hits[b.sample] ? 0 : hits[a.sample] > hits[b.sample] ? -1 : 1)
}

function getSortSamplesByValues($id, self, rows) {
	const t = self.termOrder.find(t => t.tw.$id === $id)

	if (t.tw.q?.mode == 'continuous') {
		return (a, b) => {
			return a[$id].key - b[$id].key
		}
	}

	const values = []
	if (t?.term?.values) {
		for (const v of term.values) {
			values.push(v.key)
		}
		values.sort((a, b) => (term.values[a].order < term.values[a].order ? -1 : 1))
	} else if (t?.ref?.bins) {
		values.push(...t.ref.bins.map(b => b.name))
	} else {
		for (const row of rows) {
			if (!($id in row)) continue
			const v = row[$id].key
			if (values.indexOf(v) == -1) values.push(v) //else hits[row.sample] = row[$id].values ? row[$id].values.length : 1
		}
	}

	return (a, b) => {
		if (!a[$id] && !b[$id]) return 0
		if (!a[$id]) return 1
		if (!b[$id]) return -1
		return values.indexOf(a[$id].key) - values.indexOf(b[$id].key)
	}
}

export function getTermSorter(self, s) {
	if (s.sortTermsBy == 'asListed') {
		//no additional logic required
		return (a, b) => a.index - b.index
	}

	if (s.sortTermsBy != 'sampleCount') {
		throw `unsupported s.sortTermsBy='${s.sortTermsBy}'`
	}

	return (a, b) => {
		if (a.counts.samples === b.counts.samples) return b.counts.hits - a.counts.hits
		if (a.counts.samples === b.counts.samples) return a.index - b.index
		return b.counts.samples - a.counts.samples
	}
}
