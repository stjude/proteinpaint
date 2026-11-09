import type { SampleTypes } from '#types'
import { getSelectedCheckboxValues, renderCheckboxSelect } from './checkboxSelect.ts'
import { table2col } from './table2col.js'

/** renders a "Sample Type" row holding the sample type checkboxes or the
 * sample-types-by-terms dropdowns, for a query (e.g. queries.geneExpression or
 * queries.dnaMethylation) that offers a choice of sample types. Returns the
 * sample type select, undefined when there is nothing to choose.
 * chosen: sample type ids to draw as selected, from getChosenSampleTypes(); every one when absent */
export function mayRenderSampleTypeRow(holder: any, query: any, termdbConfig: any, chosen?: number[]) {
	holder.selectAll('*').remove()
	const { sampleTypes, sampleTypesByTerms } = query || {}
	// sampleTypesByTerms is built from sampleTypes, so fewer than two leaves nothing to choose
	if (!Array.isArray(sampleTypes) || sampleTypes.length < 2) return
	const table = table2col({ holder, margin: '0px 0px 15px 0px' })
	const [td1, td2] = table.addRow()
	td1.text('Sample Type')
	td2.style('padding-left', '10px')
	const values: any = chosen && getSampleTypeSelectValues(query, chosen)
	if (!sampleTypesByTerms) return renderSampleTypeSelect(td2, sampleTypes, termdbConfig, values)
	const termSelects = renderSampleTypesByTermsSelect(td2, sampleTypesByTerms, termdbConfig)
	if (values) for (const term in termSelects) termSelects[term].property('value', values[term])
	return termSelects
}

/** a query's sample types (e.g. queries.junction) that have a parent, and its dropdown values left with any
 * of them: the types of the samples that data read by case, such as a genome browser
 * track, maps each case to */
export function getChildSampleTypeQuery(query: any, termdbConfig: any) {
	if (!query?.sampleTypes) return query
	const hasParent = t => Number.isInteger(termdbConfig.sampleTypes?.[t]?.parent_id)
	const q = { ...query, sampleTypes: query.sampleTypes.filter(hasParent) }
	if (query.sampleTypesByTerms)
		q.sampleTypesByTerms = Object.fromEntries(
			Object.entries<any>(query.sampleTypesByTerms).map(([term, byValue]) => [
				term,
				Object.fromEntries(
					Object.entries<number[]>(byValue)
						.map(([v, types]) => [v, types.filter(hasParent)])
						.filter(([, types]) => types.length)
				)
			])
		)
	return q
}

/** the ids of a kept choice of sample types (e.g. the genome browser's config.junction.sampleTypes, which a
 * launcher may set from the sample types of another query) that the query has. undefined for none, or every
 * one, of them, which reads every sample */
export function getChosenSampleTypes(query: any, sampleTypes?: number[] | null) {
	if (!sampleTypes?.length || !query?.sampleTypes?.length) return
	const chosen = query.sampleTypes.filter(t => sampleTypes.includes(t))
	return chosen.length && chosen.length < query.sampleTypes.length ? chosen : undefined
}

/** the sample types and label to set on a term, from the select mayRenderSampleTypeRow()
 * rendered for the query. undefined when the select is rendered but nothing in it is
 * selectable, which getSelectedSampleTypes() has already alerted. */
export function getTermSampleTypes(sampleTypeSelect: any, query: any, termdbConfig: any) {
	const opts = {
		sampleTypeSelect,
		querySampleTypes: query?.sampleTypes,
		// no select means a single sample type and no dropdowns, so that type is assigned as is
		querySampleTypesByTerms: sampleTypeSelect ? query?.sampleTypesByTerms : undefined
	}
	const sampleTypes = getSelectedSampleTypes(opts)
	if (sampleTypeSelect && !sampleTypes?.length) return
	return { sampleTypes, sampleTypeLabel: mayGetSampleTypeLabel({ ...opts, termdbConfig }) }
}

/** the inverse of getSelectedSampleTypes(), to draw a choice kept as sample type ids (e.g. the genome browser's
 * config.junction.sampleTypes): the checkbox values to check, or by term of sampleTypesByTerms the dropdown value
 * whose sample types hold every given one, 'any' when no single value does */
export function getSampleTypeSelectValues(query: any, sampleTypes: number[]) {
	if (!query?.sampleTypesByTerms) return sampleTypes.map(String)
	return Object.fromEntries(
		Object.entries<any>(query.sampleTypesByTerms).map(([term, byValue]) => {
			const values = Object.keys(byValue).filter(v => sampleTypes.every(t => byValue[v].includes(t)))
			return [term, values.length == 1 ? values[0] : 'any']
		})
	)
}

/** the label that mayGetSampleTypeLabel() gives the select drawing these sample type ids. By plural names when
 * the dropdowns cannot select exactly them, so that the label never hides a choice */
export function getSampleTypeLabel(query: any, sampleTypes: number[], termdbConfig: any) {
	const values = getSampleTypeSelectValues(query, sampleTypes)
	if (!Array.isArray(values)) {
		const drawn = getSampleTypesOfTermValues(query.sampleTypesByTerms, values)
		if (drawn.length == sampleTypes.length && sampleTypes.every(t => drawn.includes(t)))
			return Object.values(values)
				.filter(v => v != 'any')
				.join(' ')
	}
	return sampleTypes.map(t => termdbConfig.sampleTypes[t].plural_name).join(', ')
}

// renders sample type checkboxes, all checked by default. At least one sample
// type always stays checked: a click that would uncheck the last checked box is cancelled
export function renderSampleTypeSelect(holder: any, querySampleTypes?: any, termdbConfig?: any, selected?: string[]) {
	holder.selectAll('*').remove()

	if (!Array.isArray(querySampleTypes) || querySampleTypes.length < 2) return

	const sampleTypeConfig: SampleTypes = {}
	for (const sampleType of querySampleTypes) {
		sampleTypeConfig[sampleType] = termdbConfig.sampleTypes[sampleType]
	}

	return renderCheckboxSelect(
		holder,
		Object.entries(sampleTypeConfig).map(([value, config]) => ({ value, label: config.name })),
		{
			className: 'sjpp-genesearch-sampletype-checkboxes',
			lastCheckedTitle: 'At least one sample type must be selected',
			selected
		}
	)
}

/** returns the sample types to assign on the termwrapper: those selected via the
 * checkboxes/dropdowns rendered by renderSampleTypeSelect()/renderSampleTypesByTermsSelect(),
 * or the one available sample type implicitly assigned when it is alone and so renders no
 * selector. undefined when there are no sample types to assign at all. */
export function getSelectedSampleTypes(opts: {
	sampleTypeSelect?: any
	querySampleTypes?: number[]
	querySampleTypesByTerms?: any
}) {
	const { sampleTypeSelect, querySampleTypes, querySampleTypesByTerms } = opts
	if (querySampleTypesByTerms) return getSelectedSampleTypesByTerms(sampleTypeSelect, querySampleTypesByTerms)
	if (sampleTypeSelect) {
		const selectedSampleTypes = getSelectedCheckboxValues(sampleTypeSelect)!.map(Number)
		if (!selectedSampleTypes.length) window.alert('Please select at least one sample type.')
		return selectedSampleTypes
	}
	// no selector was rendered: either there is nothing to select, or a single available sample
	// type is implicitly assigned (see renderSampleTypeSelect())
	return querySampleTypes?.length ? querySampleTypes : undefined
}

// renders a dropdown menu for each term in sampleTypesByTerms, with the term's
// values as options
export function renderSampleTypesByTermsSelect(holder: any, sampleTypesByTerms: any, termdbConfig: any) {
	holder.selectAll('*').remove()

	if (!sampleTypesByTerms || !Object.keys(sampleTypesByTerms).length) return

	const sampleTypesByTermsDiv = holder
		.append('div')
		.attr('class', 'sjpp-genesearch-sampletypesbyterms-selects')
		.style('margin-right', '8px')

	const termSelects = {}

	for (const term in sampleTypesByTerms) {
		const values = Object.keys(sampleTypesByTerms[term])
		const label = sampleTypesByTermsDiv
			.append('label')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('margin-bottom', '4px')
		label.append('span').style('margin-right', '10px').text(termdbConfig.sampleTypeTerms[term].name)
		const select = label.append('select').style('padding-right', '15px')
		select.append('option').attr('value', 'any').text('Any')
		for (const value of values) {
			select.append('option').attr('value', value).text(value)
		}
		termSelects[term] = select
	}

	return termSelects
}

// builds the selected term-value map from dropdowns created by
// renderSampleTypesByTermsSelect()
function getSelectedTermValues(termSelects): { [term: string]: string } | undefined {
	if (!termSelects) return
	const selected = {}
	for (const term in termSelects) {
		selected[term] = termSelects[term].property('value')
	}
	return selected
}

// returns the intersection of sample types associated with the selected
// term values from dropdowns created by renderSampleTypesByTermsSelect()
export function getSelectedSampleTypesByTerms(termSelects, sampleTypesByTerms) {
	if (!termSelects) return
	const selected = getSelectedTermValues(termSelects)
	if (!selected) return
	if (!Object.keys(selected).length) return []
	const selectedSampleTypes = getSampleTypesOfTermValues(sampleTypesByTerms, selected)
	if (!selectedSampleTypes.length) window.alert('Sample type not found. Please select a different sample type.')
	return selectedSampleTypes
}

/* the sample types that dropdown values select: by term, those of its value, or of every value for 'any', then
those common to every term. Once each, as a sample type is under several values of an 'any' term */
function getSampleTypesOfTermValues(sampleTypesByTerms, values: { [term: string]: string }): number[] {
	const lists: number[][] = Object.entries(values).map(([term, value]) =>
		value == 'any' ? Object.values<number[]>(sampleTypesByTerms[term]).flat() : sampleTypesByTerms[term][value]
	)
	if (!lists.length) return []
	return [...new Set(lists.reduce((intersection, types) => intersection.filter(t => types.includes(t))))]
}

// builds a sample type label based on sample type selections;
// unrestricted/all selections and a single implicit selection produce an empty label.
export function mayGetSampleTypeLabel(opts: {
	sampleTypeSelect?: any
	querySampleTypes?: number[]
	querySampleTypesByTerms?: any
	termdbConfig?: any
}) {
	const { sampleTypeSelect, querySampleTypes, querySampleTypesByTerms, termdbConfig } = opts
	let labelParts: string[]
	let allSelected: boolean
	let separator: string
	if (querySampleTypesByTerms) {
		const selected = getSelectedTermValues(sampleTypeSelect)
		if (!selected) return
		labelParts = Object.values(selected).filter(value => value != 'any')
		allSelected = labelParts.length == 0
		separator = ' '
	} else if (querySampleTypes) {
		if (!sampleTypeSelect) return querySampleTypes.length ? '' : undefined
		const selected = getSelectedCheckboxValues(sampleTypeSelect)
		if (!selected) return
		allSelected = selected.length == querySampleTypes.length
		labelParts = selected.map(sampleType => termdbConfig.sampleTypes[sampleType].plural_name)
		separator = ', '
	} else {
		return
	}
	return allSelected ? '' : labelParts.join(separator)
}
