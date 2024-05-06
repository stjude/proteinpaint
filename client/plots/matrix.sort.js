import { isNonDictionary } from '#shared/common'

export function getSampleSorter(self, settings, rows, opts = {}) {
	const s = settings
	validateSettings(s)
	if (self.config.chartType == 'hierCluster') {
		return self.hcSampleSorter
	}

	if (s.sortSamplesBy == 'asListed') {
		return (a, b) => {
			return self.asListedSampleOrder.indexOf(a.sample) - self.asListedSampleOrder.indexOf(b.sample)
		}
	}

	if (s.sortSamplesBy == 'name') {
		//no additional logic required
		return sortSamplesByName
	}

	const activeOption = s.sortOptions[s.sortSamplesBy]
	if (!activeOption) throw `unsupported s.sortSamplesBy='${s.sortSamplesBy}'`

	self.selectedTermsToSortAgainst = self.termOrder.filter(t => t.tw.sortSamples) // sortSamples property indicates a term is selected
	const selectedTerms = self.selectedTermsToSortAgainst
		.map(t => t.tw)
		.sort((a, b) => a.sortSamples.priority - b.sortSamples.priority)

	const sorterTerms = []

	const sortPriority = activeOption.sortPriority
	if (sortPriority) {
		for (const _tw of selectedTerms) {
			const tw = structuredClone(_tw)
			if (tw.sortSamples?.by) {
				sorterTerms.push(Object.assign({}, tw))
				continue
			}
			for (const p of sortPriority) {
				if (opts.skipSorter?.(p, tw)) continue
				if (!p.types.includes(tw.term.type)) continue
				for (const tb of p.tiebreakers) {
					const sortSamples = Object.assign(structuredClone(tw.sortSamples || {}), tb)
					const sorter = Object.assign(structuredClone(tw), { sortSamples })
					sorterTerms.push(sorter)
				}
			}
		}
	}

	// now apply sort priority as specified in the
	// ds.matrix.settings sortPriority, if applicable
	if (sortPriority) {
		for (const p of sortPriority) {
			for (const t of self.termOrder) {
				// skip the selectedTerms that were already processed above
				if (selectedTerms.find(tw => tw.$id === t.tw.$id)) continue
				if (opts.skipSorter?.(p, t.tw)) continue
				if (!p.types.includes(t.tw.term.type)) continue
				for (const tb of p.tiebreakers) {
					sorterTerms.push(Object.assign({}, t.tw, { sortSamples: tb }))
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
						.filter(
							t =>
								!t.tw.sortSamples && !isNonDictionary(t.tw.term.type) && !selectedTerms.find(tw => tw.$id === t.tw.$id)
						)
						.map(t => Object.assign({ sortSamples: { by: 'values' } }, t.tw))

		const unSelectedNonDictTerms =
			self.app.vocabApi.vocab?.dslabel == 'PNET'
				? []
				: self.termOrder
						// sort against only non-dictionary terms in this tie-breaker
						.filter(
							t =>
								!t.tw.sortSamples && isNonDictionary(t.tw.term.type) && !selectedTerms.find(tw => tw.$id === t.tw.$id)
						)
						.map(t => Object.assign({ sortSamples: { by: 'hits' } }, t.tw))

		sorterTerms.push(...unSelectedNonDictTerms, ...unSelectedDictTerms)
	}
	if (opts.tiebreaker) sorterTerms.push(opts.tiebreaker)
	sorterTerms.push(...s.sortSamplesTieBreakers.map(st => st))

	const sampleSorters = []
	self.maxSampleSet = new Set()
	for (const st of sorterTerms) {
		if (typeof st === 'function') sampleSorters.push(st)
		else if (st.$id == 'sample') sampleSorters.push(sortSamplesByName)
		else if (st.sortSamples.by == 'hits') sampleSorters.push(getSortSamplesByHits(st, self, rows, s))
		else if (st.term.type != 'geneVariant') sampleSorters.push(getSortSamplesByValues(st, self, rows, s))
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

function validateSettings(s) {
	if (!s.sortOptions) s.sortOptions = 'custom'
	if (['selectedTerms', 'class', 'dt', 'hits'].includes(s.sortSamplesBy)) s.sortSamplesBy = 'custom'
}

function sortSamplesByName(a, b) {
	if (a._ref_.label && b._ref_.label) {
		return a._ref_.label < b._ref_.label ? -1 : a._ref_.label > b._ref_.label ? 1 : 0
	}
	if (!a.sample && !b.sample && a.row.sample) {
		return a.row.sample < b.row.sample ? -1 : a.row.sample > b.row.sample ? 1 : 0
	}
	return a.sample < b.sample ? -1 : a.sample > b.sample ? 1 : 0
}

function getSortSamplesByHits(st, self, rows, s) {
	const { $id, sortSamples } = st
	const hits = {}
	for (const row of rows) {
		if (!hits[row.sample]) hits[row.sample] = 0
		if ($id in row) {
			hits[row.sample] += row[$id].countedValues?.length || 0
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
	const nextRound = order.length + 1
	// benchmark:
	// - fastest by 100+ ms: using Map and not pre-sorting
	// - ok: using {} as a tracker and either pre-sorting or not
	// - slowest: using Map and pre-sorting
	const dt = new Map()

	function setSortIndex(row) {
		if (!($id in row)) {
			dt.set(row.sample, nextRound)
			return
		}
		if (sortSamples.filter && !findMatchingValue(row[$id].values, sortSamples.filter.values)) {
			dt.set(row.sample, nextRound)
			return
		}
		const indices = row[$id].values.map(v => order.indexOf(v.dt)).filter(i => i !== -1)
		dt.set(row.sample, indices.length ? Math.min(...indices) : nextRound)
	}

	return (a, b) => {
		if (!dt.has(a.sample)) setSortIndex(a)
		if (!dt.has(b.sample)) setSortIndex(b)
		return dt.get(a.sample) - dt.get(b.sample)
	}

	// rows.forEach(setSortIndex)
	// return (a, b) => dt.get(a.sample) - dt.get(b.sample)
}

function getSortSamplesByClass(st, self, rows, s) {
	const { $id, sortSamples } = st
	if (sortSamples.disabled) return () => 0

	const m = self.config.settings.matrix
	const includeSSM = m.showMatrixMutation != 'none' && !m.allMatrixMutationHidden
	const includeCNV = m.showMatrixCNV != 'none' && !m.allMatrixCNVHidden
	const order = sortSamples.order.filter(
		includeSSM && includeCNV
			? v => !m.hiddenVariants.includes(v)
			: !includeSSM && !includeCNV
			? () => false
			: includeSSM
			? v => m.mutationClasses.includes(v) && !m.hiddenVariants.includes(v)
			: includeCNV
			? v => v.startsWith('CNV_') && !m.hiddenVariants.includes(v)
			: v => !v.startsWith('CNV_')
	)

	if (!order.length && sortSamples.ignoreEmptyFilteredOrder) return () => 0

	const nextRound = 'z' // this string will cause a sample to be sorted last in a tiebreaker round
	// benchmark:
	// - fastest by 100+ ms: using Map and not pre-sorting
	// - ok: using {} as a tracker and either pre-sorting or not
	// - slowest: using Map and pre-sorting
	const cls = new Map()
	// Example idea:
	//
	// sortPriority order = ['CNV_amp', 'CNV_loss', 'F', 'N', 'L', 'P']
	// if sample.values has a matching mclass in order, map to '1', otherwise map to 'x'
	//
	// sample1.values: ['CNV_amp', 'F']       => '1x1xxx'  // first sample by string order
	// sample2.values: ['CNV_amp', 'P']       => '1xxxx1'
	// sample3.values: ['CNV_loss', 'F', 'L'] => 'x11x1x'
	// sample4.values: ['F', 'N']             => 'xx11xx'
	// sample5.values: ['noncoding]           => 'z'       // next round of tiebreakers

	function setSortIndex(row) {
		if (!($id in row)) {
			// there is no value to index, force the sorting to the next round of tiebreakers
			cls.set(row.sample, nextRound)
			return
		}
		const values = row[$id].renderedValues || row[$id].filteredValues || row[$id].values
		if (sortSamples.filter && !findMatchingValue(values, sortSamples.filter.values)) {
			// there is no matching values, force the sorting to the next round of tiebreakers
			cls.set(row.sample, nextRound)
			return
		}
		const vals = values.map(v => v.class)
		let str = sortSamples.isOrdered ? '' : 'x'
		for (const mcls of order) {
			if (sortSamples.isOrdered) str += vals.includes(mcls) ? '1' : 'x'
			else if (vals.includes(mcls)) {
				str = '1'
				break
			}
		}
		// each sample will be mapped to a sortable string (for ease of sorting comparison),
		// derived from concatenating an array of numbers equivalent to values that match
		// the mclass sortPriority
		cls.set(row.sample, str)
	}

	// not calling setSortIndex in advance based on the benchmark notes above
	// rows.forEach(setSortIndex)
	return (a, b) => {
		if (!cls.has(a.sample)) setSortIndex(a)
		if (!cls.has(b.sample)) setSortIndex(b)
		const ca = cls.get(a.sample)
		const cb = cls.get(b.sample)
		return ca < cb ? -1 : ca > cb ? 1 : 0
	}
}

function findMatchingValue(annoValues, filterValues) {
	for (const v of annoValues) {
		for (const f of filterValues) {
			if (
				(!f.dt || v.dt === f.dt) &&
				(!f.mclassLst || f.mclassLst.includes(v.class)) &&
				(!f.class || f.class === v.class) &&
				(!f.origin || v.origin === f.origin)
			) {
				return true
			}
		}
	}
}

export function getTermSorter(self, s, grp) {
	if (grp?.type == 'hierCluster') return self.hcTermSorter

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

export function getSortOptions(termdbConfig, controlLabels = {}, matrixSettings) {
	const s = matrixSettings || termdbConfig?.matrix?.settings || {}
	const l = Object.assign({ sample: 'sample' }, controlLabels, s.controlLabels || {})

	const sortOptions = {}
	if (s.sortPriority) {
		const order = 1
		Object.values(sortOptions).forEach(d => {
			if (d.order >= order) d.order += 1
		})
		sortOptions.custom = {
			label: s.sortPriority.label || 'Custom sort',
			value: 'custom',
			order,
			sortPriority: s.sortPriority
		}
	}

	// Similar to Oncoprint sorting
	sortOptions.a = s.sortOptions?.a || {
		//label: l.Mutation + ' categories', //'CNV+SSM > SSM-only > CNV-only',
		// altLabels: {
		// 	mutationOnly: 'SSM',
		// 	cnvOnly: 'CNV',
		// },
		value: 'a',
		order: 1, // this is used for list order as a sorter option in a dropdown
		sortPriority: [
			{
				label: 'For each gene mutation, sort cases by matching data',
				types: ['geneVariant'],
				tiebreakers: [
					{
						skip: !s.mutationClasses.includes('Fuserna'), // not visible, cannot be enabled
						label: 'Cases with Fusion RNASeq > without',
						filter: {
							values: [
								{
									dt: 2
								}
							]
						},
						by: 'class',
						isOrdered: false,
						order: ['Fuserna' /*'WT', 'Blank'*/]
					},
					{
						label: 'Cases with protein changing mutations > without',
						filter: {
							values: [
								{
									dt: 1
								}
							]
						},
						by: 'class',
						isOrdered: false,
						order: [
							...s.proteinChangingMutations
							// // truncating
							// 'F', // FRAMESHIFT
							// 'N', // NONSENSE
							// 'L', // SPLICE
							// 'P', // SPLICE_REGION

							// // indel
							// 'D', // PROTEINDEL
							// 'I', // PROTEININS
							// 'ProteinAltering',

							// // point
							// 'M' // MISSENSE
						]
					},
					{
						label: 'Cases with CNV data > without',
						filter: {
							values: [
								{
									dt: 4
								}
							]
						},
						by: 'class',
						isOrdered: true,
						disabled: true, // visible, can be enabled
						order: ['CNV_amp', 'CNV_loss']
					},
					{
						disabled: true,
						label: 'Cases with consequence data',
						filter: {
							values: [
								{
									dt: 1
								}
							]
						},
						by: 'class',
						isOrdered: true,
						order: [
							// truncating
							'F', // FRAMESHIFT
							'N', // NONSENSE
							'L', // SPLICE
							'P', // SPLICE_REGION

							// indel
							'D', // PROTEINDEL
							'I', // PROTEININS
							'ProteinAltering',

							// point
							'M' // MISSENSE
						],
						notUsed: [
							// noncoding
							'Utr3',
							'Utr5',
							'S', //SILENT
							'Intron',
							'noncoding'
						]
					}
				]
			},
			{
				label: 'For each dictionary variable, sort cases by matching data',
				types: ['categorical', 'integer', 'float', 'survival'],
				tiebreakers: [
					{
						label: 'Values',
						by: 'values'
					}
				]
			}
		]
	}

	// legacy support for testing, do not display in a control UI
	sortOptions.name = {
		label: `By ${l.sample} name, ID, or label`,
		value: 'name',
		order: Object.values(sortOptions).length
	}

	return sortOptions
}

export function getSampleGroupSorter(self) {
	const s = self.settings.matrix
	if (s.sortSampleGrpsBy == 'hits')
		return (a, b) => {
			if (a.lst.length && !b.lst.length) return -1
			if (!a.lst.length && b.lst.length) return 1
			return b.totalCountedValues - a.totalCountedValues
		}
	if (s.sortSampleGrpsBy == 'sampleCount')
		return (a, b) => {
			if (a.lst.length && !b.lst.length) return -1
			if (!a.lst.length && b.lst.length) return 1
			if (a.lst.length == b.lst.length) {
				return defaultSorter(a, b)
			}
			return b.lst.length - a.lst.length
		}

	if (!self.config.divideBy?.$id) return defaultSorter
	const ref = self.data.refs.byTermId[self.config.divideBy.$id]
	if (ref && !ref.keyOrder) ref.keyOrder = ref.bins ? ref.bins.map(b => b.name) : []

	const predefinedKeyOrder = self.data.refs.byTermId[self.config.divideBy.$id]?.keyOrder
	if (!predefinedKeyOrder) return defaultSorter
	return (a, b) => {
		// NOTE: should not reorder by isExcluded, in order to maintain the assigned legend item order, colors, etc
		//if (a.isExcluded && !b.isExcluded) return 1
		//if (!a.isExcluded && b.isExcluded) return -1
		a.order = predefinedKeyOrder.indexOf(a.id)
		if (a.order == -1) delete a.order
		b.order = predefinedKeyOrder.indexOf(b.id)
		if (b.order == -1) delete b.order
		if ('order' in a && 'order' in b) return a.order - b.order
		if ('order' in a) return -1
		if ('order' in b) return 1
		return defaultSorter(a, b)
	}
}

function defaultSorter(a, b) {
	return a.name < b.name ? -1 : 1
}

export function getMclassSorter(self) {
	const s = self.settings.matrix
	// subsequent code does not work when s.sortSamplesBy == 'name', but a mclass sorter function
	// may still be needed for non-matrix-column-sorting use cases such as for legend entries.
	// In that case, use a default sorting option that is known to sort by mutation classes
	const activeOption = s.sortOptions[s.sortSamplesBy].sortPriority ? s.sortOptions[s.sortSamplesBy] : s.sortOptions.a
	const mclassPriority = []
	activeOption.sortPriority.forEach(obj => {
		if (obj.types.includes('geneVariant')) {
			// Extract 'order' arrays from each tiebreaker and filter 'WT' and 'Blank'
			obj.tiebreakers.forEach(tiebreaker => {
				if (tiebreaker.by == 'class' && tiebreaker.order) {
					mclassPriority.push(...tiebreaker.order.filter(t => t !== 'WT' && t !== 'Blank'))
				}
			})
		}
	})

	const sorter = (a, b) => {
		const ai = mclassPriority.indexOf(a.class)
		const bi = mclassPriority.indexOf(b.class)
		return ai == -1 && bi == -1
			? 0
			: mclassPriority.indexOf(a.class) == -1
			? 1
			: mclassPriority.indexOf(b.class) == -1
			? -1
			: mclassPriority.indexOf(a.class) - mclassPriority.indexOf(b.class)
	}
	return sorter
}
