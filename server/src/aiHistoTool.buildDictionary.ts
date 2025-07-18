import type { Mds3 } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from './serverconfig.js'

/** Termdb for the AI histology tool is created on the fly from
 * API metdata output. These methods build the termdb queries
 * and query mechanisms to support the filter and tvs. */
export async function makeAIHistoTermdbQueries(ds: Mds3) {
	const dict = ds?.cohort?.termdb?.dictionary
	if (!dict?.aiApi) return
	if (!ds?.cohort?.termdb) return
	/** if q doesn't exist, use empty object */
	const q = (ds.cohort.termdb.q ||= {})
	const id2term = new Map()

	/** Build a temp dictionary for the AI histology tool
	 * from API metadata output. */
	q.buildAdHocDictionary = async () => {
		if (dict?.aiApi != true) return
		const source = dict?.source?.file
		if (!source) return

		const csvData = await readSourceFile(source)
		if (!csvData) return

		console.log(`Creating ad hoc dictionary for ${ds.label}...`)

		const lines = csvData.split('\n').filter(line => line.trim() !== '')

		id2term.set('__root', { id: 'root', name: 'root', __tree_isroot: true })

		makeParentTerms(lines[0], id2term)
		assignValuesToTerms(id2term, lines.splice(1))

		id2term.forEach(term => {
			delete term.index
		}) // Remove index property
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

function makeParentTerms(header: string, id2term: Map<string, any>) {
	const columns = header.split(',')

	for (const [i, col] of columns.entries()) {
		const term = {
			id: col.trim(),
			name: col.replace(/[/.]/g, ' ').trim(),
			/* default during development. Should remove after data dictionary 
            or phenotree is provided */
			type: 'categorical',
			isleaf: false,
			parent_id: undefined,
			values: {},
			child_types_set: new Set(),
			//will delete later
			index: i
		}
		id2term.set(term.id, term)
	}
}

function assignValuesToTerms(id2term: Map<string, any>, lines: string[]) {
	//Will only assign values to categorical terms
	const tmpTermValues = new Map()
	// Create a temporary array to hold the terms based on their index
	// Avoid mucking up the terms map
	const tmpArray = [...id2term.values()]

	/** Assign values to terms */
	for (const line of lines) {
		const columns = line.split(',')

		for (const [i, col] of columns.entries()) {
			const termid = tmpArray.find(term => term.index === i)?.id
			if (!tmpTermValues.has(termid)) {
				tmpTermValues.set(termid, new Set())
			}
			tmpTermValues.get(termid).add(col.trim())
		}
	}

	/** Update the type if necessary and assign values to terms */
	for (const [termid, values] of tmpTermValues.entries()) {
		const numValuesOnly = [...values].every(v => typeof v === 'string' && /^\d+$/.test(v))
		if (numValuesOnly) {
			//No values are added to numerical terms
			id2term.get(termid).type = 'integer'
		} else {
			/** Return the values in the set as an object with increasing
			 * indices as keys with the values as labels.*/
			const termValues = Object.fromEntries([...values].map((v, i) => [String(i), { label: v }]))
			id2term.get(termid).values = termValues
		}
	}
}
