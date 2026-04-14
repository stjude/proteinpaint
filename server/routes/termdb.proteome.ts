import type { RouteApi } from '#types'
import { termdbProteomePayload } from '#types/checkers'
import { get_ds_tdb } from '#src/termdb.js'
import * as utils from '#src/utils.js'
import { mayLimitSamples } from '#src/mds3.filter.js'

export const api: RouteApi = {
	endpoint: 'termdb/proteome',
	methods: {
		get: {
			...termdbProteomePayload,
			init
		},
		post: {
			...termdbProteomePayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res) => {
		const q: any = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			if (!ds.queries?.proteome?.get) throw 'queries.proteome.get() missing'
			const term = q.term?.term || q.term
			if (!term?.name) throw 'term.name missing'

			const cohorts: any[] = []
			for (const assayName in ds.queries.proteome.assays) {
				const assay = ds.queries.proteome.assays[assayName]
				for (const cohort of assay.cohorts) {
					const details = {
						dbfile: ds.queries.proteome.dbfile,
						assayName,
						cohortName: cohort.cohortName,
						cohortControlFilter: cohort.controlFilter,
						cohortCaseFilter: cohort.caseFilter,
						PTMType: assay.PTMType,
						assayColumnIdx: assay.columnIdx,
						assayColumnValue: assay.columnValue
					}
					const tw = {
						$id: '_',
						term: {
							name: term.name,
							type: 'proteomeAbundance',
							proteomeDetails: details
						}
					}
					// request data for each cohort
					const cohortData = await ds.queries.proteome.get({
						terms: [tw],
						proteomeDetails: details,
						filter: q.filter,
						filter0: q.filter0,
						for: 'proteinView',
						__abortSignal: q.__abortSignal
					})
					const controlSampleIds = cohortData.controlSampleIds || new Set()

					for (const entry of cohortData.allEntries || []) {
						const s2v = entry.s2v
						const stats = getCohortStats(s2v, controlSampleIds)
						delete entry.s2v
						entry.foldChange = stats.foldChange
						entry.pValue = stats.pValue
						entry.testedN = stats.testedN
						entry.controlN = stats.controlN
						if (assay.mclassOverride) entry.mclassOverride = assay.mclassOverride
						cohorts.push(entry)
					}
				}
			}
			res.send({ protein: term.name, cohorts })
		} catch (e: any) {
			if (e?.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

function getCohortStats(allS2v, controlSampleIds) {
	if (!allS2v || typeof allS2v != 'object') return { foldChange: null, pValue: null, testedN: 0, controlN: 0 }
	const controlValues: number[] = []
	const testedValues: number[] = []

	for (const sampleId in allS2v) {
		const v = Number(allS2v[sampleId])
		if (!Number.isFinite(v)) continue
		if (controlSampleIds.has(String(sampleId))) controlValues.push(v)
		else testedValues.push(v)
	}

	const controlMean = controlValues?.length ? controlValues.reduce((sum, v) => sum + v, 0) / controlValues.length : null
	const testedMean = testedValues?.length ? testedValues.reduce((sum, v) => sum + v, 0) / testedValues.length : null
	const foldChange =
		testedMean != null &&
		controlMean != null &&
		Number.isFinite(testedMean) &&
		Number.isFinite(controlMean) &&
		controlMean !== 0
			? testedMean / controlMean
			: null
	const pValue = getWelchPValue(testedValues, controlValues)
	return {
		foldChange,
		pValue,
		testedN: testedValues.length,
		controlN: controlValues.length
	}
}

function getWelchPValue(a, b) {
	const n1 = a.length
	const n2 = b.length
	if (n1 < 2 || n2 < 2) return null

	const mean1 = a.reduce((s, v) => s + v, 0) / n1
	const mean2 = b.reduce((s, v) => s + v, 0) / n2
	const var1 = sampleVariance(a, mean1)
	const var2 = sampleVariance(b, mean2)

	if (!Number.isFinite(var1) || !Number.isFinite(var2)) return null
	const se2 = var1 / n1 + var2 / n2
	if (!(se2 > 0)) {
		if (mean1 === mean2) return 1
		return 1e-300
	}

	const t = (mean1 - mean2) / Math.sqrt(se2)
	const df = (se2 * se2) / ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1))
	if (!Number.isFinite(df) || df < 0.1) return null

	const p = 2 * tCdfTail(Math.abs(t), df)
	if (!Number.isFinite(p)) return null
	return Math.max(1e-300, Math.min(1, p))
}

function sampleVariance(lst, mean) {
	if (lst.length < 2) return NaN
	let sumsq = 0
	for (const v of lst) {
		const d = v - mean
		sumsq += d * d
	}
	return sumsq / (lst.length - 1)
}

function tCdfTail(t, df) {
	const x = df / (df + t * t)
	return 0.5 * regularizedBetaIncomplete(df / 2, 0.5, x)
}

function regularizedBetaIncomplete(a, b, x) {
	if (x <= 0) return 0
	if (x >= 1) return 1

	if (x > (a + 1) / (a + b + 2)) {
		return 1 - regularizedBetaIncomplete(b, a, 1 - x)
	}

	const lnPrefactor = lnBetaPrefactor(a, b, x)
	const maxIter = 200
	const eps = 1e-14
	let f = 1e-30
	let C = 1e-30
	let D = 0

	for (let m = 0; m <= maxIter; m++) {
		let numerator
		if (m === 0) {
			numerator = 1
		} else {
			const k = m
			if (k % 2 === 1) {
				const i = (k - 1) / 2
				numerator = (-(a + i) * (a + b + i) * x) / ((a + 2 * i) * (a + 2 * i + 1))
			} else {
				const i = k / 2
				numerator = (i * (b - i) * x) / ((a + 2 * i - 1) * (a + 2 * i))
			}
		}

		D = 1 + numerator * D
		if (Math.abs(D) < 1e-30) D = 1e-30
		D = 1 / D

		C = 1 + numerator / C
		if (Math.abs(C) < 1e-30) C = 1e-30

		const delta = C * D
		f *= delta

		if (m > 0 && Math.abs(delta - 1) < eps) break
	}

	return (Math.exp(lnPrefactor) * f) / a
}

function lnBetaPrefactor(a, b, x) {
	return a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b)
}

function lnBeta(a, b) {
	return lnGamma(a) + lnGamma(b) - lnGamma(a + b)
}

function lnGamma(z) {
	if (z < 0.5) {
		return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
	}
	z -= 1
	const g = 7
	// Standard Lanczos coefficients used by the lnGamma() approximation.
	const coef = [
		0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
		12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
	]
	let x = coef[0]
	for (let i = 1; i < coef.length; i++) {
		x += coef[i] / (z + i)
	}
	const t = z + g + 0.5
	return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

export async function validate_query_proteome(ds) {
	const q = ds.queries.proteome
	if (!q) return

	if (!q.assays) {
		throw 'queries.proteome.assays is missing'
	}
	if (!q.dbfile) {
		throw 'queries.proteome.dbfile is missing'
	}

	// Open SQLite database connection
	try {
		q.db = utils.connect_db(q.dbfile)
	} catch (e: any) {
		throw `Cannot connect to proteome db ${q.dbfile}: ${e.message || e}`
	}

	for (const assayName in q.assays) {
		const assay = q.assays[assayName]
		if (!assay.columnIdx) throw `queries.proteome.assays.${assayName}.columnIdx missing`
		if (!assay.columnValue) throw `queries.proteome.assays.${assayName}.columnValue missing`
		if (assay.cohorts) {
			console.log(`Validating assay "${assayName}" with multiple cohorts`)
			for (const cohort of assay.cohorts) {
				if (!cohort.cohortName) throw `Missing cohortName in queries.proteome.assays.${assayName}.cohorts`
				if (!cohort.controlFilter)
					throw `Missing controlFilter in queries.proteome.assays.${assayName}.cohorts.${cohort.cohortName}`
				if (!cohort.caseFilter)
					throw `Missing caseFilter in queries.proteome.assays.${assayName}.cohorts.${cohort.cohortName}`
			}
		} else {
			throw `Invalid assay structure for "${assayName}". Must have .cohorts`
		}
	}

	q.find = async arg => {
		const proteins = arg?.proteins
		if (!Array.isArray(proteins) || proteins.length == 0) throw 'queries.proteome.find arg.proteins[] missing'
		return findProteinsInCohort(q.db, proteins)
	}

	q.get = async param => {
		if (!param?.terms?.length) throw 'queries.proteome.get param.terms[] missing'
		if (!param.proteomeDetails?.assayName || !param.proteomeDetails?.cohortName)
			throw 'queries.proteome.get param.proteomeDetails.{assayName,cohortName} missing'
		if (
			!param.proteomeDetails?.cohortControlFilter ||
			!param.proteomeDetails?.cohortCaseFilter ||
			!param.proteomeDetails?.assayColumnIdx ||
			!param.proteomeDetails?.assayColumnValue
		)
			throw 'queries.proteome.get param.proteomeDetails.{cohortControlFilter, cohortCaseFilter, assayColumnIdx, assayColumnValue} missing'

		return await getProteomeValuesFromCohort(ds, param)
	}
}

// Map DB column indices to column names
const columnIdxToName: Record<number, string> = {
	0: 'organism',
	1: 'disease',
	2: 'tissue',
	3: 'brain_region',
	4: 'tech1',
	5: 'tech2',
	6: 'cohort'
}

function resolveColumnName(idx: number) {
	const name = columnIdxToName[idx]
	if (!name) throw `Invalid columnIdx: ${idx}, must be one of ${Object.keys(columnIdxToName).join(',')}`
	return name
}

// Build a WHERE clause and params array from a filter array like [{columnIdx:6, columnValue:'AD1'}, {columnIdx:1, columnValue:'Ctl'}]
function buildFilterClause(filters: { columnIdx: number; columnValue: string }[]) {
	const conditions: string[] = []
	const params: string[] = []
	for (const f of filters) {
		const colName = resolveColumnName(f.columnIdx)
		conditions.push(`${colName} = ?`)
		params.push(f.columnValue)
	}
	return { conditions, params }
}

function findProteinsInCohort(db, proteins) {
	const matches: string[] = []
	for (const p of proteins) {
		if (!p) continue
		const rows = db
			.prepare('SELECT DISTINCT gene, identifier FROM proteome_abundance WHERE gene LIKE ? COLLATE NOCASE')
			.all(`%${p}%`)
		for (const row of rows) {
			if (row.gene.toLowerCase().includes(p.toLowerCase())) {
				matches.push(`${row.gene}: ${row.identifier}`)
			}
		}
	}
	return matches
}

function queryDbRows(
	db,
	matchColumn: 'gene' | 'identifier',
	matchValue: string,
	filters: { columnIdx: number; columnValue: string }[]
) {
	console.log(`Querying DB for ${matchColumn}=${matchValue} with filters:`, filters)
	const { conditions, params } = buildFilterClause(filters)
	const allConditions = [`${matchColumn} = ? COLLATE NOCASE`, ...conditions]
	const sql = `SELECT identifier, protein_accession, modsite, gene, sample, value
		FROM proteome_abundance
		WHERE ${allConditions.join(' AND ')}`
	console.log('Executing SQL:', sql)
	return db.prepare(sql).all(matchValue, ...params)
}

async function getProteomeValuesFromCohort(ds, param) {
	const db = ds.queries.proteome.db
	const { assayName, cohortName, PTMType, cohortControlFilter, cohortCaseFilter, assayColumnIdx, assayColumnValue } =
		param.proteomeDetails

	// Assay-level filter (e.g. tech1='wholeProteome') must be included in every query
	const assayFilter = [{ columnIdx: assayColumnIdx, columnValue: assayColumnValue }]

	const term2sample2value = new Map()
	const allEntries: any[] = []
	const controlSampleIds = new Set<string>()

	for (const tw of param.terms) {
		if (!tw) continue

		const fullGeneName = tw.term.name
		const identifier = fullGeneName.split(':')[1]?.trim()
		const geneName = fullGeneName.split(':')[0]?.trim()
		if (param.for === 'proteinView') {
			if (!geneName) throw 'invalid term name for proteome query, gene name missing'
		} else {
			if (!identifier || !geneName)
				throw 'invalid term name for proteome query, must be in format geneName: uniqueIdentifier'
		}

		const matchColumn = param.for === 'proteinView' ? 'gene' : 'identifier'
		const matchValue = param.for === 'proteinView' ? geneName : identifier

		// Query case and control samples from DB using assay filter + cohort-specific filters
		const caseRows = queryDbRows(db, matchColumn, matchValue, [...assayFilter, ...cohortCaseFilter])
		const controlRows = queryDbRows(db, matchColumn, matchValue, [...assayFilter, ...cohortControlFilter])

		// Identify control sample IDs
		for (const row of controlRows) {
			const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
			if (sid !== undefined) controlSampleIds.add(String(sid))
		}

		// Combine all rows
		const allRows = [...caseRows, ...controlRows]

		// Collect all sample IDs for mayLimitSamples
		const allSampleIds: number[] = []
		for (const row of allRows) {
			const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
			if (sid !== undefined) allSampleIds.push(sid)
		}
		const uniqueSampleIds = [...new Set(allSampleIds)]

		const limitSamples = await mayLimitSamples(param, uniqueSampleIds, ds)
		if (limitSamples?.size == 0) {
			// got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} }
		}

		if (param.for === 'proteinView') {
			// Group rows by identifier, building s2v map for each
			const entryMap = new Map<string, any>()
			for (const row of allRows) {
				const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
				if (sid === undefined) continue
				if (limitSamples && !limitSamples.has(sid)) continue

				if (!entryMap.has(row.identifier)) {
					entryMap.set(row.identifier, {
						uniqueIdentifier: row.identifier,
						assayName,
						cohortName,
						PTMType,
						modSites: PTMType ? row.modsite || undefined : undefined,
						proteinAccession: row.protein_accession,
						geneName: row.gene,
						s2v: {}
					})
				}
				entryMap.get(row.identifier).s2v[sid] = row.value
			}
			for (const entry of entryMap.values()) allEntries.push(entry)
		} else {
			// For non-proteinView, accumulate sample values into a single s2v
			const s2v = {}
			for (const row of allRows) {
				const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
				if (sid === undefined) continue
				if (limitSamples && !limitSamples.has(sid)) continue
				s2v[sid] = row.value
			}
			if (Object.keys(s2v).length) {
				term2sample2value.set(tw.$id, s2v)
			}
		}
	}

	// Build bySampleId from the samples we actually have data for
	const bySampleId = {}
	if (param.for === 'proteinView') {
		const sampleIds = new Set<number>()
		for (const entry of allEntries) {
			for (const sid of Object.keys(entry.s2v)) sampleIds.add(Number(sid))
		}
		for (const sid of sampleIds) {
			bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
		}
		return { allEntries, controlSampleIds, bySampleId }
	}

	if (term2sample2value.size == 0) {
		throw `No data available for: ${param.terms?.map(t => t.term.name).join(', ')}`
	}
	for (const s2v of term2sample2value.values()) {
		for (const sid of Object.keys(s2v)) {
			bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(Number(sid)) }
		}
	}
	return { term2sample2value, controlSampleIds, bySampleId }
}
