import type { Mds3 } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from '../serverconfig.js'
import { isUsableTerm } from '#shared/termdb.usecase.js'
import BuildHelpers from './BuildHelpers.ts'
import FilterHelpers from './FilterHelpers.ts'

/** Will assign later based on the ds defined image column header */
let imageKeyIdx: number | null = null

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

	//Defined in the ds. Column header for the image key
	const imageKey = dict?.source?.sampleKey || 'image_id'

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

		new BuildHelpers()
		//Creates the term object for each header
		BuildHelpers.makeParentTerms(lines[0], id2term, imageKey)
		//Assigns term.values, term.type, and, if applicable, term.bins
		BuildHelpers.assignAttributesToTerms(id2term, lines.splice(1))

		imageKeyIdx = BuildHelpers.imageKeyIdx

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
			const sample = columns[imageKeyIdx!]

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

		const value2imageCount = new Map<string, any>()

		const lines = csvData.split('\n')
		//skip header
		for (const line of lines.splice(1)) {
			const columns = line.split(',')
			const value = columns[term.index].trim()
			if (!value2imageCount.has(value)) {
				value2imageCount.set(value, { value: Number(value), samplecount: 0 })
			}
			value2imageCount.get(value).samplecount++
		}

		const lst = Array.from(value2imageCount.values()).sort((a, b) => a.value - b.value)
		return lst
	}

	/** q.getSupportedChartTypes is required and defined in the ds for now.
	 * Add if needed.*/

	q.getFilteredImages = async filter => {
		if (dict?.aiApi != true) return
		const source = dict?.source?.file
		if (!source) return

		const csvData = await readSourceFile(source)
		if (!csvData) return

		const lines = csvData.split('\n')
		const headers = lines[0].split(',')
		const headersMap = new Map(headers.map((h, i) => [h, { idx: i, label: id2term.get(h.trim()).name }]))

		new FilterHelpers(imageKeyIdx!, headersMap)

		const normalized = FilterHelpers.normalizeFilter(filter)
		const matches = FilterHelpers.getMatches(normalized, lines)

		if (!matches! || matches.length === 0) {
			console.log('No matches found for filter [src/buildAdHocDictionary.ts getFilteredImages()]')
			return null
		}

		const formattedData = FilterHelpers.formatData(matches!)
		return formattedData
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
