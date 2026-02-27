import type { FilterTerm } from '#types'

export const num_filter_cutoff = 3 // The maximum number of filter terms that can be entered and parsed using the chatbot

/** Shared JSON Schema definitions for filter terms, used by DE, Summary, and Matrix agents. */
export const FILTER_TERM_DEFINITIONS = {
	FilterTerm: {
		anyOf: [{ $ref: '#/definitions/CategoricalFilterTerm' }, { $ref: '#/definitions/NumericFilterTerm' }]
	},
	CategoricalFilterTerm: {
		type: 'object',
		properties: {
			term: { type: 'string', description: 'Name of categorical term' },
			category: { type: 'string', description: 'The category of the term' },
			join: {
				type: 'string',
				enum: ['and', 'or'],
				description:
					'join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term'
			}
		},
		required: ['term', 'category'],
		additionalProperties: false
	},
	NumericFilterTerm: {
		type: 'object',
		properties: {
			term: { type: 'string', description: 'Name of numeric term' },
			start: { type: 'number', description: 'start position (or lower limit) of numeric term' },
			stop: { type: 'number', description: 'stop position (or upper limit) of numeric term' },
			join: {
				type: 'string',
				enum: ['and', 'or'],
				description:
					'join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term'
			}
		},
		required: ['term'],
		additionalProperties: false
	}
}

/** Shared natural language description of filter term types for LLM prompts. */
export const FILTER_DESCRIPTION =
	'There are two kinds of filter variables: "Categorical" and "Numeric". ' +
	'"Categorical" variables are those variables which can have a fixed set of values e.g. gender, race. ' +
	'They are defined by the "CategoricalFilterTerm" which consists of "term" (a field from the sqlite3 db) and "category" (a value of the field from the sqlite db). ' +
	'"Numeric" variables are those which can have any numeric value. ' +
	'They are defined by "NumericFilterTerm" and contain the subfields "term" (a field from the sqlite3 db), ' +
	'"start" an optional filter which is defined when a lower cutoff is defined in the user input for the numeric variable and ' +
	'"stop" an optional filter which is defined when a higher cutoff is defined in the user input for the numeric variable. '

function sortSameCategoricalFilterKeys(filters: any[], ds: any): any {
	let text = ''
	const keys = filters.map(f => f.term)
	if (new Set(keys).size == keys.length) return { filters: filters, text } // All filter terms have separate keys

	const seen = new Set<string>()
	const categorical_filter_terms_with_multiple_fields = new Set<string>()

	for (const item of filters) {
		if (seen.has(item.term)) categorical_filter_terms_with_multiple_fields.add(item.term)
		else seen.add(item.term)
	}

	const multiple_fields_keys: { key: string; categories: string[] }[] = []
	for (const key of categorical_filter_terms_with_multiple_fields) {
		const term =
			ds.cohort.termdb.q.termjsonByOneid(key) ||
			ds.cohort.termdb.q.termjsonByOneid(key.toUpperCase()) ||
			ds.cohort.termdb.q.termjsonByOneid(key.toLowerCase())
		if (!term) {
			text += 'invalid filter id:' + key
		} else {
			if (term.type == 'categorical') {
				const multiple_fields = filters.filter(x => x.term == key)
				multiple_fields_keys.push({ key: key, categories: multiple_fields.map(f => f.category) })
			}
		}
	}

	// Try to preserve the order of the original filter terms
	const sorted_filter: FilterTerm[] = []
	const seen2 = new Set<string>()
	for (const f of filters) {
		const repeated_term = multiple_fields_keys.find(x => x.key == f.term)
		if (!repeated_term) {
			sorted_filter.push(f)
		} else {
			if (!seen2.has(f.term)) {
				const new_filter_term: { term: string; category: string[] } = {
					term: f.term,
					category: repeated_term.categories
				}
				seen2.add(f.term)
				sorted_filter.push(new_filter_term)
			}
		}
	}
	return { filters: sorted_filter, text }
}

export function validate_filter(filters: FilterTerm[], ds: any, group_name: string): any {
	if (!Array.isArray(filters)) throw 'filter is not array'
	const sorted_filters = sortSameCategoricalFilterKeys(filters, ds)
	let filter_result: { simplefilter?: any; text: string } = { text: sorted_filters.text }
	if (sorted_filters.filters.length <= 2) {
		// If number of filter terms <=2 then simply a single iteration of generate_filter_term() is sufficient
		const generated = generate_filter_term(sorted_filters.filters, ds)
		filter_result.simplefilter = generated.simplefilter
		filter_result.text += generated.text
	} else {
		if (sorted_filters.filters.length > num_filter_cutoff) {
			filter_result.text +=
				'For now, the maximum number of filter terms supported through the chatbot is ' + num_filter_cutoff
			if (group_name.length > 0) {
				// Group name is blank for summary filter, this is case for groups
				filter_result.text +=
					' . The number of filter terms for group ' + group_name + ' is ' + sorted_filters.filters.length + '\n' // Added temporary logic to restrict the number of filter terms to num_filter_cutoff.
			} else {
				// For summary filter prompts which do not have a group
				filter_result.text += 'The number of filter terms for this query is ' + sorted_filters.filters.length
			}
		} else {
			// When number of filter terms is greater than 2, then in each iteration the first two terms are taken and a filter object is created which is passed in the following iteration as a filter term
			for (let i = 0; i < sorted_filters.filters.length - 1; i++) {
				const filter_lst = [] as any[]
				if (i == 0) {
					filter_lst.push(sorted_filters.filters[i])
				} else {
					filter_lst.push(filter_result.simplefilter)
				}
				filter_lst.push(sorted_filters.filters[i + 1])
				filter_result = generate_filter_term(filter_lst, ds)
			}
		}
	}
	return { simplefilter: filter_result.simplefilter, text: filter_result.text }
}

function generate_filter_term(filters: any, ds: any) {
	let invalid_text = ''
	const localfilter: any = { type: 'tvslst', in: true, lst: [] as any[] }
	for (const f of filters) {
		if (f.type == 'tvslst') {
			localfilter.lst.push(f)
		} else {
			const term =
				ds.cohort.termdb.q.termjsonByOneid(f.term) ||
				ds.cohort.termdb.q.termjsonByOneid(f.term.toUpperCase()) ||
				ds.cohort.termdb.q.termjsonByOneid(f.term.toLowerCase())
			if (!term) {
				invalid_text += 'invalid filter id:' + f.term
			} else {
				if (f.join) {
					localfilter.join = f.join
				}
				if (term.type == 'categorical') {
					const categories = Array.isArray(f.category) ? f.category : [f.category]
					const values: { key: string }[] = []
					for (const category of categories) {
						let cat: string | undefined
						for (const ck in term.values) {
							if (ck.toLowerCase() == category.toLowerCase()) cat = ck
							else if (term.values[ck].label?.toLowerCase() == category.toLowerCase()) cat = ck
						}
						if (!cat) invalid_text += 'invalid category from ' + JSON.stringify({ term: f.term, category })
						else values.push({ key: cat })
					}
					localfilter.lst.push({
						type: 'tvs',
						tvs: {
							term,
							values
						}
					})
				} else if (term.type == 'float' || term.type == 'integer') {
					const numeric: any = {
						type: 'tvs',
						tvs: {
							term,
							ranges: []
						}
					}
					const range: any = {}
					if (f.start && !f.stop) {
						range.start = Number(f.start)
						range.stopunbounded = true
					} else if (f.stop && !f.start) {
						range.stop = Number(f.stop)
						range.startunbounded = true
					} else if (f.start && f.stop) {
						range.start = Number(f.start)
						range.stop = Number(f.stop)
					} else {
						invalid_text += 'Neither greater or lesser defined'
					}
					numeric.tvs.ranges.push(range)
					localfilter.lst.push(numeric)
				}
			}
		}
	}
	if (filters.length > 1 && !localfilter.join) {
		localfilter.join = 'and' // Hardcoding and when the LLM is not able to detect the connection
		//invalid_text += 'Connection (and/or) between the filter terms is not clear, please try to rephrase your question'
	}
	return { simplefilter: localfilter, text: invalid_text }
}
