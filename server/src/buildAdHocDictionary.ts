import type { Mds3 } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from './serverconfig.js'
import { decimalPlacesUntilFirstNonZero } from '#shared/roundValue.js'
import { summaryStats } from '#shared/descriptive.stats.js'
import { isUsableTerm } from '#shared/termdb.usecase.js'

/** Will assign later based on the ds defined sample column header */
let sampleKeyIdx: number | null = null

/** Termdb in memory for ds with constantly changing metadata
 * (i.e. terms). These methods build the termdb queries
 * and query mechanisms to support the filter and tvs. */
export async function makeAdHocDicTermdbQueries(ds: Mds3) {
	const dict = ds?.cohort?.termdb?.dictionary
	if (!dict?.aiApi) return
	if (!ds?.cohort?.termdb) return
	/** if q doesn't exist, use empty object */
	const q = (ds.cohort.termdb.q ||= {})
	const id2term = new Map()

	//Defined in the ds. Column header for the sample key
	const sampleKey = dict?.source?.sampleKey || 'sample_id'

	/** Build a temp dictionary for the AI histology tool
	 * from API metadata output. */
	q.buildAdHocDictionary = async () => {
		if (dict?.aiApi != true) return
		const source = dict?.source?.file
		if (!source) return

		const csvData = await readSourceFile(source)
		if (!csvData) return

		console.log(`Creating ad hoc dictionary for ${ds.label}...`)

		const lines = csvData.split('\n')

		//Check if the first line is empty or has missing col headers
		const missingHeader = lines[0].split(',').some(c => c.trim() === '')
		if (missingHeader) throw `Missing header in source file ${source}`

		//Add root term required for termdb queries
		id2term.set('__root', { id: 'root', name: 'root', __tree_isroot: true })

		//Creates the term object for each header
		makeParentTerms(lines[0], id2term, sampleKey)
		//Assigns term.values, term.type, and, if applicable, term.bins
		assignAttributesToTerms(id2term, lines.splice(1))

		return id2term.size > 1 ? `Ad hoc dictionary for ${ds.label} created` : 'failed to initialize dictionary'
	}

	//None of the arguments in server/routes/termdb.rootterm are needed
	q.getRootTerms = async (_, __, ___) => {
		const terms: any = []
		for (const term of id2term.values()) {
			if (term.__tree_isroot) continue
			if (term?.parent_id == undefined) terms.push(JSON.parse(JSON.stringify(term)))
		}
		return terms
	}

	q.getTermChildren = async (_, id, ___, ____) => {
		const terms: any = []
		for (const term of id2term.values()) {
			if (term.parent_id == id) terms.push(JSON.parse(JSON.stringify(term)))
		}
		return terms
	}

	//cohort(_) and treefilter(__) are not required in this case
	q.findTermByName = async (searchStr, _, usecase = null, __) => {
		searchStr = searchStr.toLowerCase() // convert to lowercase
		// find terms that have term.name containing search string
		const terms: any[] = []
		for (const term of id2term.values()) {
			if (usecase && !isUsableTerm(term, usecase)) continue
			const name = term.name.toLowerCase()
			if (name.includes(searchStr)) terms.push(JSON.parse(JSON.stringify(term)))
		}
		return terms
	}

	/** getAncestorIDs & getAncestorNames are required in some vocab queries */
	q.getAncestorIDs = _ => {
		//At this time, no ancestors in metadata
		return []
	}
	q.getAncestorNames = q.getAncestorIDs

	/** Read the .csv file and return [samples{}, byTermId{}] for further
	 * parsing in termdb/categories. byTermId{} will always be empty */
	q.getAdHocTermValues = async (_, termwrappers) => {
		const source = dict.source!.file
		const csvData = await readSourceFile(source!)
		if (!csvData) return [{}, {}]

		const samples: any = {}

		const lines = csvData.split('\n')
		//skip header
		for (const line of lines.splice(1)) {
			const columns = line.split(',')
			const sample = columns[sampleKeyIdx!]

			for (const tw of termwrappers) {
				const term = id2term.get(tw.term.id)
				if (!term.values) throw `Term ${term.id} has no values defined`
				//TODO: Use getSamples from termdb.matrix.js??
				const indexKey = term.type == 'categorical' ? '_' : `${term.id}`
				const value = columns[term.index].trim()
				/** If the value == '', return undefined */
				const keyValue = term.type != 'categorical' ? Number(value) : value || 'undefined'
				samples[sample] = {
					sample: Number(sample),
					[indexKey]: {
						key: keyValue,
						value: keyValue
					}
				}
			}
		}
		//empty obj is byTermId which is only used for the gdc
		return [samples, {}]
	}

	q.termjsonByOneid = (id: string) => {
		const term = id2term.get(id)
		if (term) return JSON.parse(JSON.stringify(term))
		return null
	}

	/** Return entries for NumericCategoriesResponse.lst.
	 * Applies to termdb/numericcategories route */
	q.getSummaryNumericCategories = async (term): Promise<any[]> => {
		if (term.type != 'integer' && term.type != 'float') return []

		const source = dict.source!.file
		const csvData = await readSourceFile(source!)
		if (!csvData) return []

		const value2sampleCount = new Map<string, any>()

		const lines = csvData.split('\n')
		//skip header
		for (const line of lines.splice(1)) {
			const columns = line.split(',')
			const value = columns[term.index].trim()
			if (!value2sampleCount.has(value)) {
				value2sampleCount.set(value, { value: Number(value), samplecount: 0 })
			}
			value2sampleCount.get(value).samplecount++
		}

		const lst = Array.from(value2sampleCount.values()).sort((a, b) => a.value - b.value)
		return lst
	}

	/** q.getSupportedChartTypes is required and defined in the ds for now.
	 * Add if needed.*/

	q.getFilteredSelections = async filter => {
		if (dict?.aiApi != true) return
		const source = dict?.source?.file
		if (!source) return

		const csvData = await readSourceFile(source)
		if (!csvData) return

		const lines = csvData.split('\n')
		const headers = lines[0].split(',')

		/** If no filter provided, return all */
		if (!filter.lst || !filter.lst.length) {
			const matches: string[] = []
			for (const line of lines.splice(1)) {
				const cells = line.split(',')
				matches.push(cells[sampleKeyIdx!])
			}
			return matches
		}

		/** Reduces the filter to only relevant fields so it's easier to work with */
		function normalizeFilter(tvs: any) {
			const filter = {
				termid: tvs.term.id,
				type: tvs.term.type,
				isNot: tvs.isnot ?? false
			}

			if (tvs.term.type === 'categorical') {
				const vals = tvs.values?.map(v => v.key) ?? []
				return { ...filter, filter: vals }
			}
			//for numerical terms, set default ranges for later
			const ranges = (tvs.ranges ?? []).map(r => {
				const { min, max } = setDefaultMinAndMax(r)
				return { ...r, min, max }
			})
			return { ...filter, filter: ranges }
		}

		const filterList = filter.lst.reduce((acc, item) => {
			if (!item.tvs) return acc
			acc.push(normalizeFilter(item.tvs))
			return acc
		}, [])

		const headerIndex = new Map<string, number>(headers.map((h, i) => [h, i]))

		const filterColIdxs: number[] = []
		for (const f of filterList) {
			const idx = headerIndex.get(f.termid)
			if (idx !== undefined) filterColIdxs.push(idx)
		}

		const filterByHeader = new Map<string, any>(filterList.map(f => [f.termid, f]))

		const matchMap = new Map<string, Set<string>>()

		for (const line of lines.splice(1)) {
			if (!line || !line.trim()) continue
			const cells = line.split(',')

			//Only check relevant filter columns
			for (const colIdx of filterColIdxs) {
				const value = cells[colIdx].trim()
				if (!value) continue

				const header = headers[colIdx]
				const f = filterByHeader.get(header)
				if (!f) continue

				if (isMatch(f, value)) {
					const s = matchMap.get(header)
					if (s) s.add(cells[sampleKeyIdx!])
					else matchMap.set(header, new Set([cells[sampleKeyIdx!]]))
				}
			}
		}

		const matchValues = [...matchMap.values()]
		if (matchValues.length === 0) return []

		//Start with the smallest set to reduce computing power
		const smallestSet = matchValues.reduce((acc, curr) => {
			if (curr.size < acc.size) return curr
			return acc
		}, matchValues[0])

		/** Iterate through all filtered match sets to find
		 * values present in each */
		const matches = new Set(smallestSet)
		for (let i = 1; i < matchValues.length; i++) {
			for (const v of [...matches]) {
				if (!matchValues[i].has(v)) matches.delete(v)
			}
		}
		return [...matches]
	}
}

async function readSourceFile(source: string) {
	const sourceFilePath = path.join(serverconfig.tpmasterdir, source)
	if (!fs.existsSync(sourceFilePath)) return
	try {
		return fs.readFileSync(sourceFilePath, 'utf8')
	} catch (e) {
		throw `Error reading source file ${sourceFilePath}: ${e}`
	}
}

function makeParentTerms(header: string, id2term: Map<string, any>, sampleKey: string) {
	const columns = header.split(',')

	for (const [i, col] of columns.entries()) {
		if (col.trim().toLowerCase() == sampleKey.trim().toLowerCase()) {
			sampleKeyIdx = i
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

/** Metadata does not contain data dictionary information
 * Add necessary attributes to terms from inference */
function assignAttributesToTerms(id2term: Map<string, any>, lines: string[]) {
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
		if (!numValuesOnly || term.index == sampleKeyIdx) {
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

/** Determine if value matches filter */
function isMatch(f: any, value: string) {
	if (f.type === 'categorical') {
		return f.isNot ? !f.filter.includes(value) : f.filter.includes(value)
	} else {
		return (() => {
			/** Samples/slides/images should only appear once for numerical terms. */
			let includeValue = false
			for (const range of f.filter) {
				// const { min, max } = getDefaultMinAndMax(range)
				const inRange = isValueInRange(Number(value), range)
				includeValue = f.isNot ? !inRange : inRange
				if (includeValue) break
			}
			return includeValue
		})()
	}
}

function setDefaultMinAndMax(range: any) {
	const min = range.startunbounded ? -Infinity : range.start
	const max = range.stopunbounded ? Infinity : range.stop
	return { min, max }
}

function isValueInRange(value: number, range: any) {
	const min = range.min
	const max = range.max
	if (value > min && value < max) return true
	if (range.startinclusive && value == min) return true
	if (range.stopinclusive && value == max) return true
	return false
}
