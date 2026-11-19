import fs from 'fs'
import path from 'path'
import { tsvParseRows } from 'd3'
import serverconfig from '#src/serverconfig.js'
import type {
	RoutePayload,
	RouteApi,
	ChemicalSensitivityRequest,
	ChemicalSensitivityResponse,
	ChemicalSensitivitySample,
	ChemicalSensitivityDrug,
	ChemicalSensitivityResult,
	ChemicalSensitivityDoseResponse,
	ChemicalSensitivityCurve,
	ChemicalSensitivityQuery
} from '#types'
import { genomes } from '#src/initGenomesDs.js'
import { authApi } from '#src/auth.js'
import { protectedRoutes } from '#src/auth/protectedRoutes.ts'
import { validGenomeDs } from '#routes/common.ts'

/*
data is parsed from the dataset's files at server launch (validate_query_chemicalSensitivity, called from mds3.init.js)
and kept in ds.queries.chemicalSensitivity.data
*/

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.queries.chemicalSensitivity
	get init() {
		return hasChemicalSensitivityDs(genomes) ? init : null
	},
	request: { typeId: 'ChemicalSensitivityRequest', checker: validRequest },
	response: { typeId: 'ChemicalSensitivityResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/chemicalSensitivity',
	// the response has sample names: requires a session when the dataset has a termdb credential for the embedder,
	// and the login status for authApi.canDisplaySampleIds()
	middlewares: [protectedRoutes.termdb, protectedRoutes.samples],
	methods: {
		get: payload,
		post: payload
	}
}

function hasChemicalSensitivityDs(genomes) {
	return Object.values(genomes).some((g: any) =>
		Object.values(g.datasets || {}).some((ds: any) => ds.queries?.chemicalSensitivity)
	)
}

/** checks the request; a sample name may arrive as a number (e.g. "380"), and is then a string */
export function validRequest(input): ChemicalSensitivityRequest {
	const q: ChemicalSensitivityRequest = validGenomeDs(input)
	if (input.sample !== undefined) {
		const vt = typeof input.sample
		if (vt != 'string' && vt != 'number') throw 'sample must be a string or number'
		q.sample = String(input.sample)
		if (!q.sample) throw 'sample is blank'
	}
	if (input.drugs !== undefined) {
		if (q.sample === undefined) throw 'drugs requires sample'
		const drugs = input.drugs
		if (!Array.isArray(drugs) || drugs.some(d => typeof d != 'string' || !d))
			throw 'drugs must be an array of drug names'
		if (new Set(drugs).size != drugs.length) throw 'drugs must be distinct'
		q.drugs = drugs
	}
	return q
}

export function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		let result: ChemicalSensitivityResponse | { status: number; error: string }
		try {
			const q: ChemicalSensitivityRequest = req.query
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw 'invalid genome or dataset'
			const data = ds.queries?.chemicalSensitivity?.data
			if (!data) throw 'chemical sensitivity data not available'
			// the response has the sample names and their results
			if (!authApi.canDisplaySampleIds(req, ds))
				throw { status: 401, message: 'Requires sign in to access the sample data' }
			result = getResult(q, data)
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			result = { status: e.status || 400, error: e.message || e }
		}
		res.send(result)
	}
}

/** the response of a checked request (see validRequest) */
export function getResult(q: ChemicalSensitivityRequest, data: ChemicalSensitivityData): ChemicalSensitivityResponse {
	const result: ChemicalSensitivityResponse = {
		samples: data.samples,
		drugs: data.drugs,
		aocMax: data.aocMax,
		ic50Range: data.ic50Range
	}
	if (q.sample === undefined) return result
	const results = data.sample2results.get(q.sample)
	if (!results) throw 'unknown sample'
	result.results = results
	if (q.drugs) {
		// a drug not in the data, e.g. of a saved session, has no dose response or image
		const drug2dr = data.doseResponse.get(q.sample)
		result.doseResponses = q.drugs.map(d => drug2dr?.get(d)).filter(dr => dr !== undefined)
		if (q.drugs.length == 1) {
			const image = data.moleculeImages.get(q.drugs[0])
			if (image) result.moleculeImage = image
		}
	}
	return result
}

export async function validate_query_chemicalSensitivity(ds: any) {
	const q = ds.queries?.chemicalSensitivity
	if (!q) return
	if (typeof q.file != 'string' || !q.file) throw 'chemicalSensitivity.file must be a file path'
	const text = await fs.promises.readFile(path.join(serverconfig.tpmasterdir, q.file), 'utf8')
	const { data, drug2imageFile, warnings } = parseChemicalSensitivityFile(text)
	if (!data.samples.length) throw 'chemicalSensitivity: no sample has data'
	for (const key of ['doseResponseFolder', 'moleculeImageFolder']) {
		if (q[key] !== undefined && (typeof q[key] != 'string' || !q[key]))
			throw `chemicalSensitivity.${key} must be a folder path`
	}
	if (q.doseResponseFolder) {
		const files = await readJsonFiles(path.join(serverconfig.tpmasterdir, q.doseResponseFolder))
		indexDoseResponseFiles(files, data, warnings)
	}
	if (q.moleculeImageFolder) {
		await readMoleculeImages(path.join(serverconfig.tpmasterdir, q.moleculeImageFolder), drug2imageFile, data, warnings)
	}
	for (const w of warnings) console.warn(`${ds.label} chemicalSensitivity: ${w}`)
	q.data = data
}

/** the parsed json files of a folder and its subfolders, keyed by the path relative to the folder; undefined for a
file that cannot be read or parsed */
async function readJsonFiles(folder: string): Promise<Map<string, unknown>> {
	const files = new Map<string, unknown>()
	const names = (await fs.promises.readdir(folder, { recursive: true })).filter(f => f.endsWith('.json')).sort()
	for (const name of names) {
		try {
			files.set(name, JSON.parse(await fs.promises.readFile(path.join(folder, name), 'utf8')))
		} catch {
			// an unreadable or invalid file is reported by indexDoseResponseFiles()
			files.set(name, undefined)
		}
	}
	return files
}

/** adds the dose-response files (parsed json keyed by file name) to data.doseResponse, by their own Compound and
Model (sample name) fields. an invalid file, or one of an unknown drug or sample or of a pair already seen, is
skipped with a warning; so are the sample and drug pairs with results but no dose-response file */
export function indexDoseResponseFiles(files: Map<string, unknown>, data: ChemicalSensitivityData, warnings: string[]) {
	const drugNames = new Set(data.drugs.map(d => d.name))
	const sampleNames = new Set(data.samples.map(s => s.name))
	const invalid: string[] = []
	const unknown: string[] = []
	const duplicate: string[] = []
	for (const [name, json] of files) {
		let dr: ChemicalSensitivityDoseResponse
		try {
			dr = parseDoseResponse(json)
		} catch (e) {
			invalid.push(`${name} (${e})`)
			continue
		}
		if (!drugNames.has(dr.drug) || !sampleNames.has(dr.sample)) {
			unknown.push(name)
			continue
		}
		if (!data.doseResponse.has(dr.sample)) data.doseResponse.set(dr.sample, new Map())
		const drug2dr = data.doseResponse.get(dr.sample)!
		if (drug2dr.has(dr.drug)) {
			duplicate.push(name)
			continue
		}
		drug2dr.set(dr.drug, dr)
	}
	if (invalid.length) warnings.push(`invalid dose-response files, skipped: ${invalid.join(', ')}`)
	if (unknown.length) warnings.push(`dose-response files of an unknown drug or sample, skipped: ${unknown.join(', ')}`)
	if (duplicate.length)
		warnings.push(`dose-response files of a sample and drug already loaded, skipped: ${duplicate.join(', ')}`)
	let missing = 0
	for (const [sample, results] of data.sample2results) {
		for (const r of results) if (!data.doseResponse.get(sample)?.has(r.drug)) missing++
	}
	if (missing) warnings.push(`${missing} sample and drug pairs have results but no dose-response file`)
}

/** a dose-response file (see ChemicalSensitivityQuery.doseResponseFolder); throws a message when invalid. the
Metrics values are matched to the Curves by order */
export function parseDoseResponse(j: any): ChemicalSensitivityDoseResponse {
	if (!j || typeof j != 'object') throw 'not an object'
	if (typeof j.Compound != 'string' || !j.Compound) throw 'missing Compound'
	if (typeof j.Model != 'string' || !j.Model) throw 'missing Model'
	if (!Number.isFinite(j.ConcLow) || !Number.isFinite(j.ConcHigh)) throw 'ConcLow and ConcHigh must be numbers'
	const names = Object.keys(j.Curves || {})
	if (!names.length) throw 'no Curves'
	const ic50s = j.Metrics?.IC50,
		aocs = j.Metrics?.AOC
	if (!Array.isArray(ic50s) || !Array.isArray(aocs) || ic50s.length != names.length || aocs.length != names.length)
		throw 'Metrics.IC50 and Metrics.AOC must have one value per curve'
	const curves: ChemicalSensitivityCurve[] = names.map((name, i) => {
		const c = j.Curves[name]
		if (!Number.isFinite(ic50s[i]) || !Number.isFinite(aocs[i])) throw `non-numeric metrics of ${name}`
		const curve: ChemicalSensitivityCurve = { name, ic50: ic50s[i], aoc: aocs[i], fit: getPoints(c?.DR, `${name}.DR`) }
		if (c?.Raw !== undefined) curve.raw = getPoints(c.Raw, `${name}.Raw`)
		return curve
	})
	return { drug: j.Compound, sample: j.Model, concRange: [j.ConcLow, j.ConcHigh], curves }
}

function getPoints(xy: any, label: string): { conc: number[]; act: number[] } {
	const conc = xy?.Conc,
		act = xy?.Act
	if (!Array.isArray(conc) || !Array.isArray(act) || conc.length != act.length || !conc.length)
		throw `${label} must have Conc and Act of the same length`
	if (!conc.every(Number.isFinite) || !act.every(Number.isFinite)) throw `${label} has non-numeric values`
	return { conc, act }
}

/** reads the molecule image of each drug that names one, into data.moleculeImages. a file name with a folder,
a missing file and a file that is not svg are skipped with a warning */
async function readMoleculeImages(
	folder: string,
	drug2imageFile: Map<string, string>,
	data: ChemicalSensitivityData,
	warnings: string[]
) {
	const skipped: string[] = []
	for (const [drug, file] of drug2imageFile) {
		if (path.basename(file) != file) {
			skipped.push(`${drug} (${file})`)
			continue
		}
		try {
			const svg = await fs.promises.readFile(path.join(folder, file), 'utf8')
			if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(svg)) throw 'not svg'
			data.moleculeImages.set(drug, svg)
		} catch {
			skipped.push(`${drug} (${file})`)
		}
	}
	if (skipped.length) warnings.push(`molecule images not found or not svg, skipped: ${skipped.join(', ')}`)
	const noImage = data.drugs.filter(d => !drug2imageFile.has(d.name)).map(d => d.name)
	if (noImage.length) warnings.push(`drugs without a molecule image file: ${noImage.join(', ')}`)
}

/** number of columns of the data file before the optional sample attributes */
const ATTRIBUTE_START = 6

/** parses the data file (see ChemicalSensitivityQuery.file). the samples and drugs are in the order they first
appear. a row with a blank sample or drug, a non-numeric AOC or log10 IC50, or a sample and drug already seen is
dropped; a drug or sample whose values differ between its rows keeps those of its first row. all are reported in
warnings */
export function parseChemicalSensitivityFile(text: string) {
	const warnings: string[] = []
	const { header, rows } = getRows(text, warnings)
	const attributeLabels = header.slice(ATTRIBUTE_START)
	const drugs: ChemicalSensitivityDrug[] = []
	const samples: ChemicalSensitivitySample[] = []
	/** molecule image file name of a drug */
	const drug2imageFile = new Map<string, string>()
	/** the drug columns of the first row of each drug, and the attributes of the first row of each sample, to find
	rows that differ */
	const drug2key = new Map<string, string>()
	const sample2key = new Map<string, string>()
	const sample2results = new Map<string, ChemicalSensitivityResult[]>()
	const conflicts = new Set<string>()
	let badRows = 0,
		duplicates = 0
	for (const row of rows) {
		const [sample, drug, drugClass, image, aocStr, ic50Str] = row
		const aoc = Number(aocStr),
			ic50 = Number(ic50Str)
		if (!sample || !drug || !aocStr || !ic50Str || !Number.isFinite(aoc) || !Number.isFinite(ic50)) {
			badRows++
			continue
		}
		// the drug columns are the same in all rows of a drug, and the attributes in all rows of a sample
		const drugKey = [drugClass, image].join('\t')
		if (!drug2key.has(drug)) {
			drug2key.set(drug, drugKey)
			drugs.push({ name: drug, class: getValue(drugClass) })
			if (getValue(image)) drug2imageFile.set(drug, image)
		} else if (drug2key.get(drug) != drugKey) conflicts.add(`drug ${drug}`)
		const attributeValues = attributeLabels.map((_, i) => row[ATTRIBUTE_START + i])
		const sampleKey = attributeValues.join('\t')
		if (!sample2key.has(sample)) {
			sample2key.set(sample, sampleKey)
			samples.push(getSample(sample, attributeLabels, attributeValues))
			sample2results.set(sample, [])
		} else if (sample2key.get(sample) != sampleKey) conflicts.add(`sample ${sample}`)
		const results = sample2results.get(sample)!
		if (results.some(r => r.drug == drug)) {
			duplicates++
			continue
		}
		results.push({ drug, aoc, ic50 })
	}
	if (badRows) warnings.push(`${badRows} rows with a blank sample or drug, or a non-numeric AOC or log10 IC50, dropped`)
	if (duplicates) warnings.push(`${duplicates} rows of a sample and drug already seen, dropped`)
	if (conflicts.size)
		warnings.push(
			`values that differ between the rows of a ${[...conflicts].join(', ')}; those of the first row are used`
		)

	// results in the drugs order, which is the order of the bars
	const drugOrder = new Map(drugs.map((d, i) => [d.name, i]))
	let aocMax = 0,
		ic50Min = Infinity,
		ic50Max = -Infinity
	for (const results of sample2results.values()) {
		results.sort((a, b) => drugOrder.get(a.drug)! - drugOrder.get(b.drug)!)
		for (const r of results) {
			aocMax = Math.max(aocMax, r.aoc)
			ic50Min = Math.min(ic50Min, r.ic50)
			ic50Max = Math.max(ic50Max, r.ic50)
		}
	}
	const ic50Range: [number, number] = samples.length ? [ic50Min, ic50Max] : [0, 0]
	const data: ChemicalSensitivityData = {
		samples,
		drugs,
		sample2results,
		aocMax,
		ic50Range,
		doseResponse: new Map<string, Map<string, ChemicalSensitivityDoseResponse>>(),
		moleculeImages: new Map<string, string>()
	}
	return { data, drug2imageFile, warnings }
}

/** the parsed data file, kept in ds.queries.chemicalSensitivity.data */
type ChemicalSensitivityData = NonNullable<ChemicalSensitivityQuery['data']>

/** a sample with its attributes that have a value, labeled by their header, in the column order */
function getSample(name: string, labels: string[], values: (string | undefined)[]): ChemicalSensitivitySample {
	const sample: ChemicalSensitivitySample = { name }
	for (const [i, label] of labels.entries()) {
		const value = getValue(values[i])
		if (!label || value === undefined) continue
		if (!sample.attributes) sample.attributes = {}
		sample.attributes[label] = value
	}
	return sample
}

/** the header and the other non-blank tab-delimited rows, each field trimmed (String.trim also removes non-breaking
spaces). bytes that are not valid utf-8, which were read as the replacement character (e.g. a latin-1 non-breaking
space), are removed with a warning */
function getRows(text: string, warnings: string[]): { header: string[]; rows: string[][] } {
	let invalid = 0
	const [header = [], ...rows] = tsvParseRows(text)
		.map(row =>
			row.map(v => {
				if (v.includes('\uFFFD')) {
					invalid++
					v = v.replaceAll('\uFFFD', '')
				}
				return v.trim()
			})
		)
		.filter(row => row.some(v => v))
	if (invalid) warnings.push(`${invalid} fields have bytes that are not valid utf-8, removed`)
	return { header, rows }
}

/** a blank or NA field is unset */
function getValue(v: string | undefined): string | undefined {
	return v && v != 'NA' ? v : undefined
}
