import { get_ds_tdb } from '#src/termdb.js'
import * as utils from '#src/utils.js'
import { mayLimitSamples } from '#src/mds3.filter.js'

// sp|P10636-8|TAU_HUMAN → P10636 ; falls back to the raw acc when it doesn't parse.
// Kept in sync with termdb.bubbleHeatmap.ts so PTM sites and whole-proteome rows
// collapse to the same base UniProt accession for matching.
function baseUniProtAcc(acc: string): string {
	if (!acc) return ''
	const parts = acc.split('|')
	const id = parts.length >= 2 ? parts[1] : acc
	const dash = id.indexOf('-')
	return dash > 0 ? id.slice(0, dash) : id
}

export function init({ genomes }) {
	return async (req, res) => {
		const q: any = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			// get() is attached to proteome, all organism, assay type, and cohorts share the same get().
			if (!ds.queries?.proteome?.get) throw 'queries.proteome.get() missing'
			const term = q.term?.term || q.term
			if (!term?.name) throw 'term.name missing'

			const cohorts: any[] = []
			const brConfig = ds.queries.proteome.brainRegions
			const regionRemap: { [raw: string]: string } = brConfig?.regionValueRemap || {}
			// Global sample-id → region-code map, deduped across all dots: a sample's region
			// is independent of which isoform/cohort dot it appears in, so it's recorded once
			// in the response instead of being repeated on every dot.
			const sampleRegions: { [sid: string]: string } = {}
			for (const organismName in ds.queries.proteome.organisms) {
				const organism = ds.queries.proteome.organisms[organismName]
				for (const assayName in organism.assays) {
					const assay = organism.assays[assayName]
					for (const cohortName in assay.cohorts || {}) {
						const details = {
							dbfile: ds.queries.proteome.dbfile,
							organism: organismName,
							assay: assayName,
							cohort: cohortName
						}
						const tw = {
							$id: '_',
							term: {
								name: term.name,
								type: 'proteomeAbundance',
								dataTypeDetails: details
							}
						}
						// request data for each cohort
						const cohortData = await ds.queries.proteome.get({
							terms: [tw],
							dataTypeDetails: details,
							filter: q.filter,
							filter0: q.filter0,
							for: 'proteinView',
							__abortSignal: q.__abortSignal
						})
						const controlSampleIds = cohortData.controlSampleIds || new Set()

						const prior = assay.cohorts[cohortName].prior
						for (const entry of cohortData.allEntries || []) {
							const s2v = entry.s2v
							const sampleRegionsRaw = entry.sampleRegionsRaw || {}
							const stats = getCohortStats(s2v, controlSampleIds, prior)
							delete entry.s2v
							delete entry.sampleRegionsRaw
							entry.foldChange = stats.foldChange
							entry.pValue = stats.pValue
							entry.testedN = stats.testedN
							entry.controlN = stats.controlN
							if (assay.mclassOverride) entry.mclassOverride = assay.mclassOverride
							if (organism.genomeName) entry.genomeName = organism.genomeName
							// Per-dot sample identity so the brain plot can count exactly the samples
							// this volcano dot represents (case + control); each sample's region is
							// recorded once in the response-level sampleRegions map.
							if (brConfig) {
								entry.sampleIds = Object.keys(s2v)
								for (const sid in sampleRegionsRaw) {
									const raw = sampleRegionsRaw[sid]
									if (raw == null) continue
									const code = regionRemap[String(raw)] ?? String(raw)
									if (brConfig.regions[code] !== undefined) sampleRegions[sid] = code
								}
							}
							cohorts.push(entry)
						}
					}
				}
			}
			// Protein-abundance normalization: attach the reference assay's
			// fold change to each non-reference entry, matched by organism + cohort + base
			// UniProt accession. The client turns this into "FC from whole proteome" and a
			// normalized log2FC (site log2FC − whole-proteome log2FC).
			const refAssay = ds.queries.proteome.proteinReferenceAssay
			if (refAssay) {
				// key: organism|cohort|baseAcc → the reference fold change to
				// subtract. Among the rows for one protein we keep the most-significant (lowest
				// raw p) one that has a usable fold change
				const refFcByKey = new Map<string, { fc: number; p: number }>()
				for (const e of cohorts) {
					if (e.assayName !== refAssay || !Number.isFinite(e.foldChange)) continue
					const baseAcc = baseUniProtAcc(e.proteinAccession)
					if (!baseAcc) continue
					const key = `${e.organism}|${e.cohortName}|${baseAcc}`
					const p = Number.isFinite(e.pValue) ? e.pValue : Infinity
					const cur = refFcByKey.get(key)
					if (!cur || p < cur.p) refFcByKey.set(key, { fc: e.foldChange, p })
				}
				// Only PTM entries are protein-abundance normalized.
				for (const e of cohorts) {
					if (!e.PTMType) continue
					const baseAcc = baseUniProtAcc(e.proteinAccession)
					if (!baseAcc) continue
					const ref = refFcByKey.get(`${e.organism}|${e.cohortName}|${baseAcc}`)
					if (ref) e.proteinFoldChange = ref.fc
				}
			}

			res.send({ protein: term.name, cohorts, sampleRegions: brConfig ? sampleRegions : undefined })
		} catch (e: any) {
			if (e?.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}

export function getCohortStats(allS2v, controlSampleIds, prior: { d0: number; s0sq: number }) {
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
	if (!Number.isFinite(prior?.d0) || prior.d0 <= 0 || !Number.isFinite(prior?.s0sq) || prior.s0sq <= 0) {
		throw 'prior with finite positive d0 and s0sq is required for moderated t-test'
	}
	const pValue = getModeratedPValue(testedValues, controlValues, prior)
	return {
		foldChange,
		pValue,
		testedN: testedValues.length,
		controlN: controlValues.length
	}
}

function getModeratedPValue(a, b, prior: { d0: number; s0sq: number }) {
	const n1 = a.length
	const n2 = b.length
	if (n1 < 2 || n2 < 2) return null

	const mean1 = a.reduce((s, v) => s + v, 0) / n1
	const mean2 = b.reduce((s, v) => s + v, 0) / n2

	// pooled sample variance
	let ss1 = 0
	for (const v of a) {
		const d = v - mean1
		ss1 += d * d
	}
	let ss2 = 0
	for (const v of b) {
		const d = v - mean2
		ss2 += d * d
	}
	const dfResidual = n1 + n2 - 2
	const pooledVar = (ss1 + ss2) / dfResidual

	// posterior (moderated) variance: shrink toward prior
	const { d0, s0sq } = prior
	const sTildeSq = (d0 * s0sq + dfResidual * pooledVar) / (d0 + dfResidual)

	const se = Math.sqrt(sTildeSq * (1 / n1 + 1 / n2))
	if (!(se > 0)) {
		if (mean1 === mean2) return 1
		return 1e-300
	}

	const t = (mean1 - mean2) / se
	const df = d0 + dfResidual
	if (!Number.isFinite(df) || df < 0.1) return null

	const p = 2 * tCdfTail(Math.abs(t), df)
	if (!Number.isFinite(p)) return null
	return Math.max(1e-300, Math.min(1, p))
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

	if (!q.organisms) {
		throw 'queries.proteome.organisms is missing'
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

	for (const organismName in q.organisms) {
		const organism = q.organisms[organismName]
		if (organism.columnIdx == null) throw `queries.proteome.organisms.${organismName}.columnIdx missing`
		if (organism.columnValue == null) throw `queries.proteome.organisms.${organismName}.columnValue missing`
		if (!organism.assays || typeof organism.assays != 'object')
			throw `queries.proteome.organisms.${organismName}.assays missing or invalid`
		for (const assayName in organism.assays) {
			const assay = organism.assays[assayName]
			if (assay.columnIdx == null)
				throw `queries.proteome.organisms.${organismName}.assays.${assayName}.columnIdx missing`
			if (assay.columnValue == null)
				throw `queries.proteome.organisms.${organismName}.assays.${assayName}.columnValue missing`
			if (assay.cohorts) {
				for (const cohortName in assay.cohorts) {
					const cohort = assay.cohorts[cohortName]
					// cohorts serving a precomputed DAPfile (log2FC + p-value already computed) don't
					// need prior/controlFilter/caseFilter; those are only used to compute DAP on the fly
					// and to pull per-sample data from the db (boxplots, case/control counts).
					if (!cohort.DAPfile) {
						if (!cohort.controlFilter)
							throw `Missing controlFilter in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
						if (!cohort.caseFilter)
							throw `Missing caseFilter in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
						if (!cohort.prior?.d0 || !cohort.prior?.s0sq)
							throw `Missing prior.d0 and prior.s0sq in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
					}
				}
			} else {
				throw `Invalid assay structure for "${assayName}". Must have .cohorts`
			}
		}
	}

	q.find = async arg => {
		const proteins = arg?.proteins
		if (!Array.isArray(proteins) || proteins.length == 0) throw 'queries.proteome.find arg.proteins[] missing'
		const matches = new Set<string>()
		const details = arg?.dataTypeDetails || {}
		const organism = details.organism
		const assay = details.assay
		const cohort = details.cohort
		const MAX_FIND_RESULTS = 500

		const filters: { columnIdx: number; columnValue: string }[] = []
		if (Object.keys(details).length) {
			if (!organism || !assay || !cohort)
				throw 'queries.proteome.find arg.dataTypeDetails.{organism,assay,cohort} missing'
			const organismConfig = q.organisms?.[organism]
			if (!organismConfig) throw `queries.proteome.find invalid organism: ${organism}`
			const assayConfig = organismConfig.assays?.[assay]
			if (!assayConfig) throw `queries.proteome.find invalid assay: ${assay}`
			const cohortConfig = assayConfig?.cohorts?.[cohort]
			if (!cohortConfig) throw `queries.proteome.find invalid cohort: ${cohort}`

			const organismFilter = [{ columnIdx: organismConfig.columnIdx, columnValue: organismConfig.columnValue }]
			const assayFilter = [{ columnIdx: assayConfig.columnIdx, columnValue: assayConfig.columnValue }]
			const cohortFilter = (Array.isArray(cohortConfig.caseFilter) ? cohortConfig.caseFilter : []).filter(
				(
					filter
				): filter is {
					columnIdx: number
					columnValue: string
				} => !!filter
			)
			if (!cohortFilter.length) throw `queries.proteome.find invalid cohort caseFilter: ${cohort}`
			filters.push(...organismFilter, ...assayFilter, ...cohortFilter)
		}

		for (const p of proteins) {
			if (!p) continue
			const token = String(p).trim()
			if (token.length < 2) continue
			const upperToken = `${token}\uffff`
			const rawRows: { gene: string; identifier: string }[] = []

			if (filters?.length) {
				const { conditions, params } = buildFilterClause(filters)
				const sql = `SELECT DISTINCT gene, identifier FROM proteome_abundance WHERE gene >= ? COLLATE NOCASE AND gene < ? COLLATE NOCASE AND ${conditions.join(
					' AND '
				)} LIMIT ${MAX_FIND_RESULTS}`
				rawRows.push(...q.db.prepare(sql).all(token, upperToken, ...params))
			} else {
				rawRows.push(
					...q.db
						.prepare(
							`SELECT DISTINCT gene, identifier FROM proteome_abundance WHERE gene >= ? COLLATE NOCASE AND gene < ? COLLATE NOCASE LIMIT ${MAX_FIND_RESULTS}`
						)
						.all(token, upperToken)
				)
			}

			for (const row of rawRows) {
				if (!row?.gene || !row?.identifier) continue
				matches.add(`${row.gene}: ${row.identifier}`)
			}
		}
		return [...matches]
	}

	q.get = async param => {
		if (!param?.terms?.length) throw 'queries.proteome.get param.terms[] missing'
		if (!param.dataTypeDetails?.assay || !param.dataTypeDetails?.cohort || !param.dataTypeDetails?.organism)
			throw 'queries.proteome.get param.dataTypeDetails.{assay,cohort,organism} missing'
		return await getProteomeValuesFromCohort(ds, param, q)
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
function buildFilterClause(filters: { columnIdx: number; columnValue: string | number }[]) {
	const conditions: string[] = []
	const params: (string | number)[] = []
	for (const f of filters) {
		const colName = resolveColumnName(f.columnIdx)
		conditions.push(`${colName} = ?`)
		params.push(f.columnValue)
	}
	return { conditions, params }
}

export function countDistinctSamples(db: any, filters: { columnIdx: number; columnValue: string | number }[]) {
	if (!filters?.length) throw 'countDistinctSamples: filters must not be empty'
	const { conditions, params } = buildFilterClause(filters)
	const row = db
		.prepare(`SELECT COUNT(DISTINCT sample) as cnt FROM proteome_abundance WHERE ${conditions.join(' AND ')}`)
		.get(...params)
	return row?.cnt || 0
}

export function queryDbRows(
	db,
	matchColumn: 'gene' | 'identifier',
	matchValue: string,
	filters: { columnIdx: number; columnValue: string | number }[]
) {
	const { conditions, params } = buildFilterClause(filters)
	const allConditions = [`${matchColumn} = ? COLLATE NOCASE`, ...conditions]
	const sql = `SELECT organism, disease, identifier, protein_accession, isoform, modsite, gene, sample, value, brain_region
		FROM proteome_abundance
		WHERE ${allConditions.join(' AND ')}`
	return db.prepare(sql).all(matchValue, ...params)
}

async function getProteomeValuesFromCohort(ds, param, q) {
	const db = ds.queries.proteome.db
	// Only collect per-sample brain regions when the dataset configures brainRegions;
	// otherwise it's wasted work that the proteome route would discard. (brain_region
	// is a standard proteome_abundance column, so the SELECT always includes it.)
	const hasBrainRegions = !!q.brainRegions
	const { assay, cohort, organism } = param.dataTypeDetails
	const organismConfig = q.organisms?.[organism]

	//organism
	if (!organismConfig) throw `queries.proteome invalid organism: ${organism}`
	const organismColumnIdx = organismConfig.columnIdx
	const organismColumnValue = organismConfig.columnValue

	//assay type
	const assayConfig = organismConfig.assays?.[assay]
	if (!assayConfig) throw `queries.proteome.get invalid assay: ${assay}`
	const PTMType = assayConfig.PTMType
	const assayColumnIdx = assayConfig.columnIdx
	const assayColumnValue = assayConfig.columnValue

	//cohort
	const cohortConfig = assayConfig?.cohorts?.[cohort]
	if (!cohortConfig) throw `queries.proteome.get invalid cohort: ${cohort}`
	const cohortControlFilter = cohortConfig.controlFilter
	const cohortCaseFilter = cohortConfig.caseFilter

	// organism-level filter (e.g. organism='human') must be included in every query
	const organismFilter = [{ columnIdx: organismColumnIdx, columnValue: organismColumnValue }]
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

		// Query case and control samples from DB using organism filter + assay filter + cohort-specific filters
		const caseRows = queryDbRows(db, matchColumn, matchValue, [...organismFilter, ...assayFilter, ...cohortCaseFilter])
		const controlRows = queryDbRows(db, matchColumn, matchValue, [
			...organismFilter,
			...assayFilter,
			...cohortControlFilter
		])

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

		const allowedSampleIds = await mayLimitSamples(param, uniqueSampleIds, ds)
		if (allowedSampleIds?.size == 0) {
			// got 0 sample after filtering, must still return expected structure with no data
			return { term2sample2value: new Map(), byTermId: {}, bySampleId: {} }
		}

		if (param.for === 'proteinView') {
			// Group rows by identifier, building s2v map for each
			const entryMap = new Map<string, any>()
			for (const row of allRows) {
				const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
				if (sid === undefined) continue
				if (allowedSampleIds && !allowedSampleIds.has(sid)) continue

				if (!entryMap.has(row.identifier)) {
					entryMap.set(row.identifier, {
						organism: row.organism,
						disease: row.disease,
						uniqueIdentifier: row.identifier,
						assayName: assay,
						cohortName: cohort,
						PTMType,
						modSites: PTMType ? row.modsite || undefined : undefined,
						proteinAccession: row.protein_accession,
						isoform: row.isoform, // refSeq transcript ID mapped from protein_accession
						geneName: row.gene,
						s2v: {},
						// raw brain_region per sample id (only when brainRegions is configured);
						// remapped + finalized into entry.sampleRegions in the route's init().
						sampleRegionsRaw: hasBrainRegions ? {} : undefined
					})
				}
				entryMap.get(row.identifier).s2v[sid] = row.value
				if (hasBrainRegions) entryMap.get(row.identifier).sampleRegionsRaw[sid] = row.brain_region
			}
			for (const entry of entryMap.values()) allEntries.push(entry)
		} else {
			// For non-proteinView, accumulate sample values into a single s2v
			const s2v = {}
			for (const row of allRows) {
				const sid = ds.cohort.termdb.q.sampleName2id(row.sample)
				if (sid === undefined) continue
				if (allowedSampleIds && !allowedSampleIds.has(sid)) continue
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
