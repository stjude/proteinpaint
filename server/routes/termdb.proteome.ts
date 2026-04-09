import path from 'path'
import { termdbProteomePayload, type RouteApi } from '#types'
import { filterJoin, getWrappedTvslst } from '#shared/filter.js'
import { get_ds_tdb } from '#src/termdb.js'
import { get_samples } from '#src/termdb.sql.js'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'
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
				for (const cohortName in assay.cohorts || {}) {
					const details = {
						assay: assayName,
						cohort: cohortName,
						PTMType: assay.PTMType
					}
					const tw = {
						$id: '_',
						term: {
							name: term.name,
							type: 'proteomeAbundance',
							proteomeDetails: details
						}
					}
					const allData = await ds.queries.proteome.get({
						terms: [tw],
						proteomeDetails: details,
						filter: q.filter,
						filter0: q.filter0,
						for: 'proteinView',
						__abortSignal: q.__abortSignal
					})

					const filterConfig = assay.cohorts[cohortName]?.ctlFilter
					const ctlFilter =
						filterConfig && Array.isArray(filterConfig) && filterConfig.length
							? getWrappedTvslst(
									filterConfig.map(tvs => ({ type: 'tvs', tvs })),
									filterConfig.length > 1 ? 'and' : ''
							  )
							: null

					let controlSampleIds = new Set()
					if (ctlFilter) {
						const controlFilter = filterJoin([q.filter, ctlFilter].filter(f => !!f))
						const controlSamples = await get_samples({ filter: controlFilter }, ds)
						controlSampleIds = new Set(controlSamples.map(i => String(i.id)))
					}

					for (const cohortData of allData.allEntries || []) {
						const s2v = cohortData.s2v
						const stats = getCohortStats(s2v, controlSampleIds)
						delete cohortData.s2v
						cohortData.foldChange = stats.foldChange
						cohortData.pValue = stats.pValue
						cohortData.testedN = stats.testedN
						cohortData.controlN = stats.controlN
						if (assay.mclassOverride) cohortData.mclassOverride = assay.mclassOverride
						cohorts.push(cohortData)
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

	for (const assayName in q.assays) {
		const assay = q.assays[assayName]
		if (assay.cohorts) {
			// assay has multiple cohorts, each with its own file
			console.log(`Validating assay "${assayName}" with multiple cohorts`)
			for (const cohortName in assay.cohorts) {
				const cohort = assay.cohorts[cohortName]
				if (!cohort.file) {
					throw `Missing file in queries.proteome.assays.${assayName}.cohorts.${cohortName}`
				}
				await validateCohortFile(ds, assayName, cohortName, cohort)
			}
		} else {
			throw `Invalid assay structure for "${assayName}". Must have .cohorts`
		}
	}

	q.getCohort = proteomeDetails => {
		const assay = proteomeDetails?.assay
		const cohort = proteomeDetails?.cohort
		if (!assay || !cohort) throw 'proteomeDetails.{assay,cohort} missing'
		const cohortQuery = q.assays?.[assay]?.cohorts?.[cohort]
		if (!cohortQuery) throw `queries.proteome.assays.${assay}.cohorts.${cohort} missing for the dataset`
		return cohortQuery
	}

	q.find = async arg => {
		const proteins = arg?.proteins
		if (!Array.isArray(proteins) || proteins.length == 0) throw 'queries.proteome.find arg.proteins[] missing'
		if (arg?.proteomeDetails) {
			const cohortQuery = q.getCohort(arg.proteomeDetails)
			return findProteinsInCohort(cohortQuery, proteins)
		}
		return findProteinsAcrossNonPTMCohorts(q, proteins)
	}

	q.get = async param => {
		if (!param?.terms?.length) throw 'queries.proteome.get param.terms[] missing'
		if (!param.proteomeDetails?.assay || !param.proteomeDetails?.cohort)
			throw 'queries.proteome.get param.proteomeDetails.{assay,cohort} missing'
		const cohortQuery = q.getCohort(param.proteomeDetails)
		return getProteomeValuesFromCohort(ds, cohortQuery, param)
	}
}

// Helper function to validate cohort files for proteome assays
async function validateCohortFile(ds, assayName, cohortName, cohort) {
	if (!cohort.file.startsWith(serverconfig.tpmasterdir)) cohort.file = path.join(serverconfig.tpmasterdir, cohort.file)
	// validate file exists
	await utils.validate_txtfile(cohort.file)

	// Read header and extract sample IDs
	const headerLine = await utils.get_header_txt(cohort.file)
	const l = headerLine.split('\t')

	cohort.samples = []
	for (let i = 9; i < l.length; i++) {
		const sampleName = l[i]
		const sampleId = ds.cohort.termdb.q.sampleName2id(sampleName)
		if (sampleId == undefined) {
			throw `queries.proteome.assays.${assayName}.cohorts.${cohortName}: unknown sample from header: ${sampleName}`
		}
		cohort.samples.push(sampleId)
	}
}

async function findProteinsInCohort(cohort, proteins) {
	if (!cohort._proteins) {
		const list: string[] = []
		await utils.get_lines_txtfile({
			args: [cohort.file],
			dir: undefined,
			callback: line => {
				const cols = line.split('\t')
				if (cols[0]?.startsWith('#Unique identifier')) return
				const identifier = cols[0].trim()
				const proteinName = cols[4].trim()
				//protein isoform identifier is gene name: unique identifier
				list.push(`${proteinName}: ${identifier}`)
			}
		})
		cohort._proteins = list
	}
	const matches: string[] = []
	for (const p of proteins) {
		if (!p) continue
		const lowerP = p.toLowerCase()
		for (const entry of cohort._proteins) {
			const proteinName = entry.split(':')[0]
			if (proteinName.toLowerCase().includes(lowerP)) {
				matches.push(entry)
			}
		}
	}
	return matches
}

async function findProteinsAcrossNonPTMCohorts(q, proteins) {
	const unique = new Set()
	for (const assayName in q.assays || {}) {
		const assay = q.assays[assayName]
		if (assay.PTMType) continue // Skip PTM assays when searching a gene on Protein View
		const cohorts = assay?.cohorts || {}
		for (const cohortName in cohorts) {
			const cohort = cohorts[cohortName]
			const matches = await findProteinsInCohort(cohort, proteins)
			for (const m of matches) unique.add(m)
		}
	}
	return [...unique]
}

async function getProteomeValuesFromCohort(ds, cohort, param) {
	const limitSamples = await mayLimitSamples(param, cohort.samples, ds)
	if (limitSamples?.size == 0) {
		// got 0 sample after filtering, must still return expected structure with no data
		return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} }
	}

	const bySampleId = {}
	const samples = cohort.samples || []
	if (limitSamples) {
		for (const sid of limitSamples) bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
	} else {
		for (const sid of samples) bySampleId[sid] = { label: ds.cohort.termdb.q.id2sampleName(sid) }
	}

	const term2sample2value = new Map()
	const { PTMType, cohort: cohortName, assay: assayName } = param.proteomeDetails
	const allEntries: any[] = []

	for (const tw of param.terms) {
		if (!tw) continue

		const fullEntry = tw.term.name
		const identifier = fullEntry.split(':')[1]?.trim()
		const geneName = fullEntry.split(':')[0]?.trim()
		if (param.for === 'proteinView') {
			// for protein view, the term name can be either gene name or in format geneName: uniqueIdentifier
			if (!geneName) throw 'invalid term name for proteome query, gene name missing'
		} else {
			// If not for protein view, the term name must be in format geneName: uniqueIdentifier, both are required for proper matching to the cohort file
			if (!identifier || !geneName)
				throw 'invalid term name for proteome query, must be in format geneName: uniqueIdentifier'
		}

		const s2v = {}
		await utils.get_lines_txtfile({
			args: [cohort.file],
			dir: undefined,
			callback: line => {
				const l = line.split('\t')
				if (param.for === 'proteinView') {
					// For proteinView, getting all rows related to the gene name (5th column), matching is done on gene name.
					if (l[4]?.trim().toLowerCase() !== geneName.toLowerCase()) return
				} else if (l[0]?.trim().toLowerCase() !== identifier.toLowerCase()) {
					// for non proteinView, only get the single row ralted to the unique identifier(1st column), matching is done on unique identifier.
					return
				}
				if (param.for === 'proteinView') {
					// Only for proteinView, capture metadata and sample values for each matching row.
					// 1 Unique identifier, 2 ModSites, 3 Protein accession, 5 Gene name
					const uniqueIdentifier = l[0]?.trim()
					if (!uniqueIdentifier) throw 'missing unique identifier for PTM row'

					const rowS2v = {}
					for (let i = 9; i < l.length; i++) {
						const sampleId = cohort.samples[i - 9]
						if (limitSamples && !limitSamples.has(sampleId)) continue
						if (!l[i]) continue
						const v = Number(l[i])
						if (Number.isNaN(v)) throw 'exp value not number'
						rowS2v[sampleId] = v
					}

					allEntries.push({
						uniqueIdentifier: uniqueIdentifier,
						assayName,
						cohortName,
						PTMType,
						modSites: PTMType ? l[1]?.trim() : undefined,
						category: !PTMType ? l[1]?.trim() : undefined,
						proteinAccession: l[2]?.trim(),
						geneName: l[4]?.trim(),
						//psms: l[5] === undefined || l[5] === '' ? undefined : Number.isNaN(Number(l[5])) ? l[5].trim() : Number(l[5]),
						s2v: rowS2v
					})
				} else {
					// For non protein view, accumulate sample values into the single s2v
					for (let i = 9; i < l.length; i++) {
						const sampleId = cohort.samples[i - 9]
						if (limitSamples && !limitSamples.has(sampleId)) continue
						if (!l[i]) continue
						const v = Number(l[i])
						if (Number.isNaN(v)) throw 'exp value not number'
						s2v[sampleId] = v
					}
				}
			}
		})

		if (param.for !== 'proteinView' && Object.keys(s2v).length) {
			// For non-proteinView, store in term2sample2value
			term2sample2value.set(tw.$id, s2v)
		}
	}
	if (term2sample2value.size == 0 && param.for != 'proteinView') {
		throw `No data available for: ${param.terms?.map(t => t.term.name).join(', ')}`
	}
	if (param.for === 'proteinView') return { allEntries, bySampleId }
	else return { term2sample2value, bySampleId }
}
