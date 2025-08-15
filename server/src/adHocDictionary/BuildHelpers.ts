import { decimalPlacesUntilFirstNonZero } from '#shared/roundValue.js'
import { summaryStats } from '#shared/descriptive.stats.js'

/** Helper functions for building ad hoc dictionaries.
 * Only used in the build script. */
export default class BuildHelpers {
	static imageKeyIdx: number | null

	public static makeParentTerms(header: string, id2term: Map<string, any>, imageKey: string) {
		const columns = header.split(',')

		for (const [i, col] of columns.entries()) {
			if (col.trim().toLowerCase() == imageKey.trim().toLowerCase()) {
				this.imageKeyIdx = i
			}

			const term = {
				id: col.trim(),
				name: col.replace(/[/.]/g, ' ').trim(),
				/* default during development. Should remove after data dictionary 
                or phenotree is provided */
				type: 'categorical',
				isleaf: true,
				parent_id: undefined,
				included_types: [],
				child_types: [],
				__tree_isroot: false,
				//This isn't used in the termdb
				//but makes querying the .csv easier
				index: i
			}
			id2term.set(term.id, term)
		}
	}

	public static assignAttributesToTerms(id2term: Map<string, any>, lines: string[]) {
		//Later, will only assign values to categorical terms
		const tmpTermValues = new Map()
		// Create a temporary array to hold the terms based on their index
		// Avoid mucking up the terms map
		const tmpArray = [...id2term.values()]

		/** Assign values to terms */
		for (const line of lines) {
			const columns = line.split(',')

			for (const [i, col] of columns.entries()) {
				const termid = tmpArray.find(term => term.index === i)?.id
				//'undefined' required for q.getAdHocTermValues()
				const value = col.trim() !== '' ? col.trim() : 'undefined'
				if (!tmpTermValues.has(termid)) {
					tmpTermValues.set(termid, new Set())
				}
				tmpTermValues.get(termid).add(value)
			}
		}

		/** Update the type if necessary and assign values to terms */
		for (const [termid, values] of tmpTermValues.entries()) {
			if (!id2term.has(termid)) continue

			const term = id2term.get(termid)
			if (!term.values) term.values = {}

			const termValues = [...values]

			//Explicitly checks for pos and neg numbers
			const numValuesOnly = [...values].every(v => typeof v === 'string' && /^-?\d+$/.test(v))
			/** Sample ids/names are likely numbers but categorical terms */
			if (!numValuesOnly || term.index == this.imageKeyIdx!) {
				/** Return the values in the set as an object with increasing
				 * indices as keys with the values as labels.*/
				termValues.forEach(v => {
					term.values[v] = { label: v }
				})

				term.included_types = ['categorical']
			} else {
				//No values are added to numerical terms
				assignNumType(term, termValues)
				assignDefaultBins(term, termValues)
			}
		}
	}
}

function assignNumType(term: any, termValues: any) {
	const foundDecimals = decimalPlacesUntilFirstNonZero(termValues)
	if (foundDecimals > 0) {
		term.type = 'float'
		term.included_types = ['float']
	} else {
		term.type = 'integer'
		term.included_types = ['integer']
		term.values = {}
	}
}

function assignDefaultBins(term: any, termValues: any) {
	const stats = summaryStats(termValues)
	if (!stats.values || stats.values.length == 0) {
		term.bins = {}
		return
	}
	const min = stats.values.find(s => s.id === 'min')!.value
	const max = stats.values.find(s => s.id === 'max')!.value

	if (max <= min) {
		term.bins = {
			default: {
				mode: 'discrete',
				type: 'regular-bin',
				bin_size: 1,
				startinclusive: false,
				stopinclusive: true,
				first_bin: {
					startunbounded: true,
					stop: 0
				},
				last_bin: {
					start: 1,
					stopunbounded: true
				}
			}
		}
		return
	}

	const defaultInterval = (max - min) / 5
	const binsize = term.type == 'integer' ? Math.ceil(defaultInterval) : defaultInterval
	term.bins = {
		default: {
			mode: 'discrete',
			type: 'regular-bin',
			bin_size: binsize,
			startinclusive: false,
			stopinclusive: true,
			first_bin: {
				startunbounded: true,
				stop: min + binsize
			}
		}
	}
}
