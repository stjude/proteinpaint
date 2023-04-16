/*
	priorityKey: string, the settings property to use, 'sortPriority' or 'truncatePriority'
*/

export function getSampleSorter(self, settings, rows, priorityKey = 'sortPriority') {
	const s = settings
	const activeOption = s.sortOptions[s.sortSamplesBy]
	if (!activeOption) {
		throw `unsupported s.sortSamplesBy='${s.sortSamplesBy}'`
	}

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

	const selectedTerms = self.termOrder
		.filter(t => t.tw.sortSamples) // sortSamples property indicates a term is selected
		.map(t => t.tw)
		.sort((a, b) => a.sortSamples.priority - b.sortSamples.priority)

	const sortPriority = activeOption.sortPriority

	// always prioritize manually selected terms, if any
	const sorterTerms = []
	if (!sortPriority) {
		sorterTerms.push(...selectedTerms)
	} else {
		for (const p of sortPriority) {
			for (const tw of selectedTerms) {
				if (!p.types.includes(tw.term.type)) continue
				for (const tb of p.tiebreakers) {
					sorterTerms.push(Object.assign({}, tw, { sortSamples: tb }))
				}
			}
		}
	}

	// now apply sort priority as specified in the
	// ds.matrix.settings sortPriority, if applicable
	if (sortPriority) {
		for (const p of sortPriority) {
			for (const t of self.termOrder) {
				if (selectedTerms.find(tw => tw.$id === t.tw.$id)) continue
				if (!p.types.includes(t.tw.term.type)) continue
				for (const tb of p.tiebreakers) {
					sorterTerms.push(Object.assign({ sortSamples: tb }, t.tw))
				}
			}
		}
	} else {
		// !!! QUICK FIX:
		// make sure to not affect the publised PNET matrix figure
		const unSelectedDictTerms =
			self.app.vocabApi.vocab?.dslabel == 'PNET'
				? []
				: self.termOrder
						// sort against only dictionary terms in this tie-breaker
						.filter(t => !t.tw.sortSamples && t.tw.id && !selectedTerms.find(tw => tw.$id === t.tw.$id))
						.map(t => Object.assign({ sortSamples: { by: 'values' } }, t.tw))

		const unSelectedNonDictTerms =
			self.app.vocabApi.vocab?.dslabel == 'PNET'
				? []
				: self.termOrder
						// sort against only non-dictionary terms in this tie-breaker
						.filter(t => !t.tw.sortSamples && !t.tw.id && !selectedTerms.find(tw => tw.$id === t.tw.$id))
						.map(t => Object.assign({ sortSamples: { by: 'hits' } }, t.tw))

		sorterTerms.push(...unSelectedNonDictTerms, ...unSelectedDictTerms)
	}

	sorterTerms.push(...s.sortSamplesTieBreakers.map(st => st))

	const sampleSorters = []
	self.maxSampleSet = new Set()
	for (const st of sorterTerms) {
		if (st.$id == 'sample') sampleSorters.push(sortSamplesByName)
		else if (st.sortSamples.by == 'hits') sampleSorters.push(getSortSamplesByHits(st, self, rows, s))
		else if (st.sortSamples.by == 'values') sampleSorters.push(getSortSamplesByValues(st, self, rows, s))
		else if (st.sortSamples.by == 'dt') sampleSorters.push(getSortSamplesByDt(st, self, rows, s))
		else if (st.sortSamples.by == 'class') sampleSorters.push(getSortSamplesByClass(st, self, rows, s))
		else throw `unsupported sortSamplesBy entry by='${st.sortSamples.by}'`
	}

	// default to always use sortSamplesByName as a tie-breaker
	if (!sampleSorters.find(f => f.$id === 'sample')) {
		sampleSorters.push(sortSamplesByName)
	}

	return (a, b) => {
		for (const sorter of sampleSorters) {
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

function getSortSamplesByHits(st, self, rows, s) {
	const { $id, sortSamples } = st
	const hits = {}
	for (const row of rows) {
		if (!hits[row.sample]) hits[row.sample] = 0
		if ($id in row) {
			const t = self.termOrder.find(t => t.tw.$id === $id)
			const { countedValues } = getFilteredValues(row[$id], t.tw, t.grp)
			hits[row.sample] += countedValues.length // ? 1 : 0
		}
	}
	return (a, b) => (hits[a.sample] == hits[b.sample] ? 0 : hits[a.sample] > hits[b.sample] ? -1 : 1)
}

function getSortSamplesByValues(st, self, rows, s) {
	const { $id, sortSamples } = st
	const t = self.termOrder.find(t => t.tw.$id === $id)

	if (t.tw.q?.mode == 'continuous') {
		return (a, b) => {
			if ($id in a && $id in b) {
				return a[$id]?.value - b[$id]?.value
			}
			if ($id in a) return -1
			if ($id in b) return 1
			return 0
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
			const v = row[$id].override?.key || row[$id].key
			if (values.indexOf(v) == -1) values.push(v)
		}
	}

	return (a, b) => {
		if (!a[$id] && !b[$id]) return 0
		if (!a[$id]) return b[$id].override ? -1 : 1
		if (!b[$id]) return a[$id].override ? 1 : -1
		if (a[$id].override && b[$id].override) {
			const ak = 'order' in a[$id].override ? a[$id].override.order : values.indexOf(a[$id].override.key)
			const bk = 'order' in b[$id].override ? b[$id].override.order : values.indexOf(b[$id].override.key)
			return ak - bk
		}
		if (!a[$id].override && !b[$id].override) {
			return values.indexOf(a[$id].key) - values.indexOf(b[$id].key)
		}
		if (!a[$id].override) return -1
		if (!b[$id].override) return 1
		return 0
	}
}

function getSortSamplesByDt(st, self, rows, s) {
	const { $id, sortSamples, term } = st
	const order = sortSamples.order
	const dt = {}
	for (const row of rows) {
		if (!($id in row)) dt[row.sample] = order.length + 1
		else {
			const indices = row[$id].values.map(v => order.indexOf(v.dt)).filter(i => i !== -1)
			dt[row.sample] = indices.length ? Math.min(...indices) : order.length + 1
			//should samples with mutiple mclass should be sorted after samples with only 1 mclass???
			//if (indices.length > 1) dt[row.sample] += [...(new Set(indices))].length * 0.05
		}
	}
	return (a, b) => dt[a.sample] - dt[b.sample]
}

function getSortSamplesByClass(st, self, rows, s) {
	const { $id, sortSamples } = st
	const order = sortSamples.order
	const cls = {}
	for (const row of rows) {
		if (!($id in row)) cls[row.sample] = order.length + 1
		else {
			const indices = row[$id].values.map(v => order.indexOf(v.class)).filter(i => i !== -1)
			cls[row.sample] = indices.length ? Math.min(...indices) : order.length + 1
			//should samples with mutiple mclass should be sorted after samples with only 1 mclass???
			//if (indices.length > 1) cls[row.sample] += [...(new Set(indices))].length * 0.05
		}
	}
	return (a, b) => cls[a.sample] - cls[b.sample]
}

function getFilteredValues(anno, tw, grp) {
	const values = 'value' in anno ? [anno.value] : anno.values
	if (!values) return { filteredValues: null, countedValues: null }
	const valueFilter = tw.valueFilter || grp.valueFilter

	const filteredValues = values.filter(v => {
		/*** do not count wildtype and not tested as hits ***/
		if (tw.term.type == 'geneVariant' && v.class == 'WT') return false
		if (!valueFilter) return true

		if (valueFilter.type == 'tvs') {
			const matched = true
			// quick fix: assume tvs values are joined by "and", not "or"
			// TODO: reuse the filter.js code/data format for a more flexible filter configuration
			for (const vf of valueFilter.tvs.values) {
				if (v[vf.key] === vf.value && valueFilter.isnot) return false
				else if (v[vf.key] !== vf.value && !valueFilter.isnot) return false
			}
			return matched
		} else {
			// TODO: handle non-tvs type value filter
			throw `unknown matrix value filter type='${valueFilter.type}'`
		}
	})

	return {
		filteredValues,
		countedValues: filteredValues.filter(v => {
			/*** do not count wildtype and not tested as hits ***/
			if (tw.term.type == 'geneVariant' && (v.class == 'WT' || v.class == 'Blank')) return false
			return true
		})
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
		// !!! QUICK FIX: put dictionary terms above non-dictionary terms
		// make sure to not affect the publised PNET matrix figure
		if (self.app.vocabApi.vocab?.dslabel === 'GDC') {
			if (a.tw?.term?.id && !b.tw?.term?.id) return -1
			if (!a.tw?.term?.id && b.tw?.term?.id) return 1
		} // !!! end quick fix

		if (b.counts.samples !== a.counts.samples) return b.counts.samples - a.counts.samples
		if (b.counts.hits !== a.counts.hits) return b.counts.hits - a.counts.hits
		return a.index - b.index
	}
}

export function getSortOptions(termdbConfig) {
	const sortOptions = {
		asListed: {
			label: 'as-listed',
			value: 'asListed',
			order: 0
		},
		dt: {
			label: 'by alteration type against sorted genes',
			value: 'dt',
			order: 1,
			sortPriority: [
				{
					types: ['geneVariant'],
					tiebreakers: [
						{
							by: 'dt',
							order: [1, 4, 2]
						}
					]
				}
			]
		},
		class: {
			label: 'by alteration subtype against sorted genes',
			value: 'class',
			order: 2,
			sortPriority: [
				{
					types: ['geneVariant'],
					tiebreakers: [
						{
							by: 'class',
							order: [
								'CNV_amp',
								'CNV_loss',
								// truncating
								'F',
								'N',
								// indel
								'D',
								'I',
								// point
								'M',
								'P',
								'L',
								// noncoding
								'Utr3',
								'Utr5',
								'S',
								'Intron'
							]
						}
					]
				}
			]
		}
	}

	const sortPriority = termdbConfig?.matrix?.settings?.sortPriority
	if (sortPriority) {
		const order = 1
		Object.values(sortOptions).forEach(d => {
			if (d.order >= order) d.order += 1
		})
		sortOptions.custom = {
			label: sortPriority.label || 'Custom sort',
			value: 'custom',
			order,
			sortPriority
		}
	}
	return sortOptions
}
