import { sample_match_termvaluesetting } from '#shared/filter.js'
import { getSampleSorter, getTermSorter, getSampleGroupSorter, getMclassSorter } from './matrix.sort'
import { dtsnvindel, dtcnv, dtfusionrna, dtgeneexpression, dtsv } from '#shared/common.js'

export function getTermOrder(data) {
	const s = this.settings.matrix
	this.termSorter = getTermSorter(this, s)
	//this.termGroups = JSON.parse(JSON.stringify(this.config.termgroups))
	const termOrder = []
	let totalIndex = 0,
		visibleGrpIndex = 0,
		numClusterTerms = 0

	this.mclassSorter = getMclassSorter(this)
	for (const [grpIndex, grp] of this.termGroups.entries()) {
		const lst = [] // will derive a mutable copy of grp.lst
		for (const [index, tw] of grp.lst.entries()) {
			const counts = { samples: 0, hits: 0 }
			const countedSamples = new Set()
			// sd = sample data, s = this.settings.matrix
			for (const sd of data.lst) {
				if (countedSamples.has(sd.sample)) continue
				countedSamples.add(sd.sample)
				const anno = sd[tw.$id]
				if (anno) {
					// This is the first time classifyValues(), to help sort
					// terms by sample counts (to the top) and samples by hits
					// (if applicable, to the left)
					//
					// This call will determine what is considered "visible",
					// even when columns are out-of-view when zoomed-in.
					//
					// NOTE: the displayed case counts or variant hits are determined
					// not in this call, but in the second call to
					// classifyValues(), + in getSerieses() and getLegendData()
					const { filteredValues, countedValues, renderedValues } = this.classifyValues(anno, tw, grp, s, sd)
					anno.filteredValues = filteredValues
					anno.countedValues = countedValues
					anno.renderedValues = renderedValues
					if (anno.countedValues?.length) {
						const v = tw.term.values?.[anno.value]
						if (v?.uncountable) continue
						counts.samples += 1
						counts.hits += anno.countedValues.length
						if (tw.q?.mode == 'continuous') {
							const v = anno.value
							if (!('minval' in counts) || counts.minval > v) counts.minval = v
							if (!('maxval' in counts) || counts.maxval < v) counts.maxval = v
						}
					}
				}
			}
			if (grp.type != 'hierCluster' || counts.samples) lst.push({ tw, counts, index })
			if (grp.type == 'hierCluster') numClusterTerms++
		}

		// may override the settings.sortTermsBy with a sorter that is specific to a term group
		const termSorter = grp.sortTermsBy || grp.type == 'hierCluster' ? getTermSorter(this, s, grp) : this.termSorter
		const processedLst = lst
			.filter(t => {
				if ('minNumSamples' in t.tw) return t.tw.minNumSamples <= t.counts.samples
				if (!grp.settings) return true
				return !('minNumSamples' in grp.settings) || t.counts.samples >= grp.settings.minNumSamples
			})
			/*
                NOTE: When sorting terms by sample counts, those counts would have been computed before applying the s.maxSample truncation.
                The sample counts are then re-computed, if applicable, in setSampleCountByTerm() after sample list truncation.
                If the left-most sample group does not have much less hits relative to sample groups to its right, then this
                may look like a term with less sample count got mistakenly sorted to the top.

                TODO: 
                (a) Option for s.sortSampleGroupBy = hits-by-term-order, and force this option so that the left-most sample group would
                    make visually sense with s.maxSample is not empty and s.sortTermsBy = 'sampleCount'
                (b) OR, re-sort the term lst based on sample counts without rearranging sample groups
            */
			.sort(termSorter)

		if (!processedLst.length) continue
		for (const [index, t] of processedLst.entries()) {
			const { tw, counts } = t
			const ref = data.refs.byTermId[t.tw.$id] || {}
			termOrder.push({
				grp,
				grpIndex,
				visibleGrpIndex,
				tw,
				index, // rendered index
				lstIndex: t.index, // as-listed index, before applying term filters
				processedLst,
				prevGrpTotalIndex: totalIndex,
				totalIndex: totalIndex + index,
				ref,
				allCounts: counts
				// note: term label will be assigned after sample counts are known
				// label: t.tw.label || t.tw.term.name,
			})
		}

		totalIndex += processedLst.length
		visibleGrpIndex += 1
	}
	this.numTerms = termOrder.length
	this.numClusterTerms = numClusterTerms
	return termOrder
}

export function getSampleGroups(data) {
	const s = this.settings.matrix
	const defaultSampleGrp = {
		id: this.config.divideBy?.$id,
		name: this.config.divideBy ? 'Not annotated' : '',
		lst: []
	}
	const sampleGroups = new Map()
	const term = this.config.divideBy?.term || {}
	const $id = this.config.divideBy?.$id || '-'
	const exclude = this.config.divideBy?.exclude || []
	const values = term.values || {}
	const ref = data.refs.byTermId[$id] || {}

	for (const row of data.lst) {
		if ($id in row) {
			const key = row[$id].key
			const name = key in values && values[key].label ? values[key].label : key
			if (!sampleGroups.has(key)) {
				const grp = {
					name: `${name}`, // convert to a string
					id: key,
					lst: [],
					tw: this.config.divideBy,
					legendGroups: {},
					isExcluded: exclude.includes(key)
				}
				if (ref.bins && s.sortSampleGrpsBy == 'name') grp.order = ref.bins.findIndex(bin => bin.name == key)
				else delete grp.order
				sampleGroups.set(key, grp)
			}
			sampleGroups.get(key).lst.push(row)
		} else {
			defaultSampleGrp.lst.push(row)
		}
	}

	const sampleGrpsArr = [...sampleGroups.values()]
	const n = sampleGroups.size
	if (n > 100 && sampleGrpsArr.filter(sg => sg.lst.length < 3).length > 0.8 * n) {
		const l = s.controlLabels
		throw `Did not group ${l.samples} by "${term.name}": too many ${l.sample} groups (${n}), with the majority of groups having <= 2 ${l.samples} per group.`
	}

	if (defaultSampleGrp.lst.length && !sampleGroups.size) {
		sampleGroups.set(undefined, defaultSampleGrp)
		sampleGrpsArr.push(...sampleGroups.values())
	}
	this.asListedSampleOrder = []
	for (const grp of sampleGrpsArr) {
		this.asListedSampleOrder.push(...grp.lst.map(s => s.sample))
	}
	const selectedDictTerms = this.termOrder.filter(t => t.tw.sortSamples && t.tw.term.type != 'geneVariant')
	// initial sorting for ungrouped samples, prioritizes grouping by gene variant, skippin other sorters at this step
	const noGrpSampleSorter = getSampleSorter(this, s, data.lst, {
		skipSorter: (p, tw) => !p.types?.includes('geneVariant') && selectedDictTerms.find(t => t.tw.$id === tw.$id)
	})
	const noGrpSampleOrder = data.lst.sort(noGrpSampleSorter)
	// truncate the samples based on the initial sorting
	const allowedSamples = noGrpSampleOrder.slice(0, s.maxSample)
	// do not include samples that are not in the truncated allowedSamples
	const dataFilter = d => allowedSamples.includes(d)
	// these hits counter functions may be used for sortSampleGrpsBy = 'hits'
	const hitsPerSample = (t, c) => t + (typeof c == 'object' && c.countedValues?.length ? 1 : 0)
	const countHits = (total, d) => total + (Object.values(d).reduce(hitsPerSample, 0) ? 1 : 0)
	// this second sorter will be applied within each group of samples
	const grpLstSampleSorter = getSampleSorter(this, s, data.lst)
	for (const grp of sampleGrpsArr) {
		grp.lst = grp.lst.filter(dataFilter)
		grp.totalCountedValues = grp.lst.reduce(countHits, 0)
		grp.lst.sort(grpLstSampleSorter)
	}
	const sampleGrpSorter = getSampleGroupSorter(this)
	return sampleGrpsArr.sort(sampleGrpSorter)
}

export function getSampleOrder(data) {
	const s = this.settings.matrix
	this.visibleSampleGrps = new Set()
	const sampleOrder = []
	let total = 0,
		numHiddenGrps = 0
	for (const [grpIndex, grp] of this.sampleGroups.entries()) {
		if (!grp.lst.length) continue
		if (grp.isExcluded) numHiddenGrps++
		let processedLst = grp.lst
		for (const [index, row] of processedLst.entries()) {
			sampleOrder.push({
				grp,
				grpIndex: grpIndex - numHiddenGrps, // : this.sampleGroups.length,
				row,
				index,
				prevGrpTotalIndex: total,
				totalIndex: total + index,
				totalHtAdjustments: 0, // may be required when transposed???
				grpTotals: { htAdjustment: 0 }, // may be required when transposed???
				processedLst
			})
		}
		if (!grp.isExcluded) total += processedLst.length
		this.visibleSampleGrps.add(grp)
		//if (s.maxSample && total >= s.maxSample) break // *** Apply group sorting before column truncation ????? ****
	}
	this.unfilteredSampleOrder = sampleOrder
	return sampleOrder.filter(so => !so.grp.isExcluded)
}

/*
Given the anno of a term for a sample, generate the 
    filteredValues (values matched the filter)
    countedValues (values counted, Class = Blank or WT are not counted)
    renderedValues (values rendered on matrix)
*/
export function classifyValues(anno, tw, grp, s, sample) {
	const values = 'value' in anno ? [anno.value] : anno.values
	if (!values) return { filteredValues: null, countedValues: null, renderedValues: null }

	// isSpecific is the filter that is specific to the term
	const isSpecific = [tw.valueFilter || grp.valueFilter].filter(v => v && true)
	if (isSpecific.length && isSpecific[0].type !== 'tvs' && isSpecific[0].type !== 'tvslst')
		throw `unknown matrix value filter type='${isSpecific.type}'`

	// filteredValues are the values passed the isSpecific filter
	let filteredValues = !isSpecific.length
		? values
		: values.filter(v => sample_match_termvaluesetting(v, isSpecific[0], tw.term, sample))

	const renderedValues = []
	if (tw.term.type == 'geneVariant' && tw.q?.type == 'values') {
		// filteredValues.sort((a, b) => getMclassOrder(a) - getMclassOrder(b))
		filteredValues.sort(this.mclassSorter)

		if (s.cellEncoding == '') renderedValues.push(...filteredValues)
		else {
			const sortedFilteredValues = []
			// dt=1 are SNVindels, dt=4 CNV, dt=3 Gene Expression
			// will render only one matching value per dt
			for (const dt of [dtcnv, dtsnvindel, dtfusionrna, dtgeneexpression]) {
				const v =
					dt == dtgeneexpression
						? filteredValues.find(v => v.dt === dt)
						: filteredValues.find(v => v.dt === dt && v.class !== 'WT' && v.class !== 'Blank')
				if (v) renderedValues.push(v)

				const oneDtV = filteredValues.filter(v => v.dt === dt)
				sortedFilteredValues.push(...oneDtV)
			}
			filteredValues = sortedFilteredValues
		}
	} else {
		renderedValues.push(...filteredValues)
	}

	// group stacked cell values to avoid striped pattern
	// if (tw.term.type == 'geneVariant') {
	// renderedValues.sort(this.stackSiblingCellsByClass)
	// filteredValues.sort(this.stackSiblingCellsByClass)
	// }

	return {
		filteredValues,
		countedValues: filteredValues.filter(v => {
			if (tw.term.type == 'geneVariant') {
				if (tw.q?.type == 'predefined-groupset' || tw.q?.type == 'custom-groupset') {
					// groupsetting in use
					// values are group assignments
					// only count assignments to group with highest
					// priority in groupset
					const groupset =
						tw.q.type == 'predefined-groupset' ? tw.term.groupsetting.lst[tw.q.predefined_groupset_idx] : tw.q.customset
					if (!groupset) throw 'groupset not found'
					const group = groupset.groups[0]
					if (v != group.name) return false
				} else {
					// groupsetting not in use
					// values are mutation classes
					// do not count WT, blank, or skipped classes
					if (v.class == 'WT' || v.class == 'Blank' || s.geneVariantCountSamplesSkipMclass.includes(v.class))
						return false
				}
			}
			return true
		}),
		renderedValues
	}
}

export function stackSiblingCellsByClass(a, b) {
	return a.class === b.class ? 0 : a.class === 'Blank' ? 1 : b.class == 'Blank' ? -1 : a.class < b.class ? -1 : 1
}
