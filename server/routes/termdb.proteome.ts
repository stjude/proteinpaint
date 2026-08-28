import path from 'path'
import { get_ds_tdb } from '#src/termdb.js'
import * as utils from '#src/utils.js'
import { mayLimitSamples } from '#src/mds3.filter.js'
import serverconfig from '#src/serverconfig.js'
import { readGeneRows, baseUniProtAcc } from '../src/routes/termdb.bubbleHeatmap.ts'

const missingDapWarned = new Set<string>()

export function init({ genomes }) {
	return async (req, res) => {
		const q: any = req.query
		try {
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)
			if (!ds.queries?.proteome?.organisms) throw 'queries.proteome not configured'
			const term = q.term?.term || q.term
			if (!term?.name) throw 'term.name missing'

			const cohorts: any[] = []
			const brConfig = ds.queries.proteome.brainRegions
			const regionRemap: { [raw: string]: string } = brConfig?.regionValueRemap || {}
			// Global sample-id → region-code map, deduped across all dots: a sample's region
			// is independent of which isoform/cohort dot it appears in, so it's recorded once
			// in the response instead of being repeated on every dot.
			const sampleRegions: { [sid: string]: string } = {}
			const identifierAnno = new Map<string, Map<string, { modsite: string | null; isoform: string | null }>>()
			for (const organismName in ds.queries.proteome.organisms) {
				const organism = ds.queries.proteome.organisms[organismName]
				for (const assayName in organism.assays) {
					const assay = organism.assays[assayName]
					for (const cohortName in assay.cohorts || {}) {
						const cohortCfg = assay.cohorts[cohortName]
						// Every cohort serves its stats from the precomputed DAPfile (published
						// log2FC + FDR, the same source as the bubble heatmap, volcano and
						// cohort-compare tools). The abundance db only supplies the sample
						// lists: case/control counts and, for the brain panel, which samples
						// (and brain regions) each dot represents.
						const dapPath = path.join(serverconfig.tpmasterdir, cohortCfg.DAPfile)
						const rows = await readGeneRows(dapPath, String(term.name).toLowerCase())
						if (!rows) {
							// unreadable file (typically a deploy without the data): the cohort
							// silently disappears from every plot, so make it visible once
							if (!missingDapWarned.has(dapPath)) {
								missingDapWarned.add(dapPath)
								console.warn(
									`proteome: DAPfile missing or unreadable for ${organismName}/${assayName}/${cohortName}: ${dapPath}`
								)
							}
							continue
						}
						if (!rows.length) continue
						const organismFilter = [{ columnIdx: organism.columnIdx, columnValue: organism.columnValue }]
						const assayFilter = [{ columnIdx: assay.columnIdx, columnValue: assay.columnValue }]
						let caseSamples: string[] = []
						let controlSamples: string[] = []
						try {
							caseSamples = listCohortSamples(ds.queries.proteome.db, [
								...organismFilter,
								...assayFilter,
								...cohortCfg.caseFilter
							])
							controlSamples = listCohortSamples(ds.queries.proteome.db, [
								...organismFilter,
								...assayFilter,
								...cohortCfg.controlFilter
							])
						} catch {
							// sample lists are cosmetic (tooltips, brain-panel counts); don't fail the request over them
						}
						// per-identifier annotation from the abundance db (modification site, RefSeq
						// isoform) for the PTM lollipop; looked up once per organism/assay
						const annoKey = `${organismName}|${assayName}`
						if (!identifierAnno.has(annoKey)) {
							let m = new Map<string, { modsite: string | null; isoform: string | null }>()
							try {
								m = listIdentifierAnnotations(ds.queries.proteome.db, term.name, [...organismFilter, ...assayFilter])
							} catch {
								// annotation is optional
							}
							identifierAnno.set(annoKey, m)
						}
						const anno = identifierAnno.get(annoKey)!
						const sampleIds: string[] = brConfig ? [...caseSamples, ...controlSamples] : []
						if (brConfig) {
							// a brain-region cohort selects its samples by the region column, so the
							// region is read off the cohort's own filter (no per-row db lookup needed)
							const regionOf = (filters: { columnIdx: number; columnValue: string | number }[]) => {
								const f = filters.find(f => f.columnIdx === brConfig.regionColumnIdx)
								if (!f) return undefined
								const code = regionRemap[String(f.columnValue)] ?? String(f.columnValue)
								return brConfig.regions[code] !== undefined ? code : undefined
							}
							const caseRegion = regionOf(cohortCfg.caseFilter)
							const controlRegion = regionOf(cohortCfg.controlFilter)
							if (caseRegion) for (const sid of caseSamples) sampleRegions[sid] = caseRegion
							if (controlRegion) for (const sid of controlSamples) sampleRegions[sid] = controlRegion
						}
						for (const row of rows) {
							const entry: any = {
								organism: organismName,
								// the study catalog (dataset config) is the authority on disease
								disease: cohortCfg.catalog?.disease,
								assayName,
								cohortName,
								uniqueIdentifier: row.identifier,
								proteinAccession: row.acc,
								geneName: term.name,
								// client computes log2(foldChange); DAP stores log2FC directly
								foldChange: Math.pow(2, row.fc),
								// significance is the DAP file's FDR (BH-adjusted p), consistent with
								// the other DAP-driven tools; a nominal p is only present when the
								// DAP file carries one (6th column)
								fdr: row.fdr,
								pValue: row.p,
								testedN: caseSamples.length,
								controlN: controlSamples.length
							}
							const a = anno.get(row.identifier)
							if (a?.isoform) entry.isoform = a.isoform // refSeq transcript ID mapped from protein_accession
							if (assay.PTMType) {
								entry.PTMType = assay.PTMType
								if (a?.modsite) entry.modSites = a.modsite
							}
							if (assay.mclassOverride) entry.mclassOverride = assay.mclassOverride
							if (organism.genomeName) entry.genomeName = organism.genomeName
							// Per-dot sample identity so the brain plot can count exactly the samples
							// this volcano dot represents (case + control); each sample's region is
							// recorded once in the response-level sampleRegions map.
							if (brConfig) entry.sampleIds = sampleIds.slice() // own copy per entry
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
					const p = Number.isFinite(e.fdr) ? e.fdr : Infinity
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
					// control/case filters are needed for per-sample queries and sample counts (e.g. dapVolcano),
					// even when a cohort serves a precomputed DAPfile.
					if (!cohort.controlFilter)
						throw `Missing controlFilter in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
					if (!cohort.caseFilter)
						throw `Missing caseFilter in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
					// every fold change / significance shown for a cohort comes from its DAPfile;
					// nothing is computed from the per-sample values
					if (!cohort.DAPfile)
						throw `Missing DAPfile in queries.proteome.organisms.${organismName}.assays.${assayName}.cohorts.${cohortName}`
				}
			} else {
				throw `Invalid assay structure for "${assayName}". Must have .cohorts`
			}
		}
	}

	const geneIndexHint = q.db
		.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'proteome_abundance_gene'`)
		.get()
		? ' INDEXED BY proteome_abundance_gene'
		: ''

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
				// INDEXED BY: with a cohort filter the planner otherwise walks the whole
				// cohort (10M+ rows for the human cohorts, 15-20s) looking for the gene
				// prefix; the gene index answers the same query in well under a second.
				// Only forced when the db actually has that index (SQLite errors otherwise).
				const sql = `SELECT DISTINCT gene, identifier FROM proteome_abundance${geneIndexHint} WHERE gene >= ? COLLATE NOCASE AND gene < ? COLLATE NOCASE AND ${conditions.join(
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

/** distinct sample names matching a cohort's filters. Selects only columns of the
 *  (organism, tech1, cohort, disease, brain_region, sample) index so the query is
 *  index-covered and stays fast on the multi-million-row human cohorts. */
export function listCohortSamples(db: any, filters: { columnIdx: number; columnValue: string | number }[]): string[] {
	if (!filters?.length) throw 'listCohortSamples: filters must not be empty'
	// a cohort's sample list does not depend on the gene, so it is computed once per
	// db + filter set and reused by every later request
	let perDb = cohortSampleCache.get(db)
	if (!perDb) cohortSampleCache.set(db, (perDb = new Map()))
	const key = JSON.stringify(filters)
	const hit = perDb.get(key)
	if (hit) return hit
	const { conditions, params } = buildFilterClause(filters)
	const samples: string[] = db
		.prepare(`SELECT DISTINCT sample FROM proteome_abundance WHERE ${conditions.join(' AND ')}`)
		.all(...params)
		.map((r: any) => String(r.sample))
	perDb.set(key, samples)
	return samples
}
const cohortSampleCache = new WeakMap<object, Map<string, string[]>>()

/** identifier → modification site + RefSeq isoform for one gene within an organism/assay */
export function listIdentifierAnnotations(
	db: any,
	gene: string,
	filters: { columnIdx: number; columnValue: string | number }[]
) {
	const { conditions, params } = buildFilterClause(filters)
	const rows = db
		.prepare(
			`SELECT identifier, modsite, isoform FROM proteome_abundance WHERE gene = ? COLLATE NOCASE${
				conditions.length ? ' AND ' + conditions.join(' AND ') : ''
			} GROUP BY identifier`
		)
		.all(gene, ...params) as { identifier: string; modsite: string | null; isoform: string | null }[]
	return new Map(rows.map(r => [r.identifier, { modsite: r.modsite, isoform: r.isoform }]))
}

export function queryDbRows(db, identifier: string, filters: { columnIdx: number; columnValue: string | number }[]) {
	const { conditions, params } = buildFilterClause(filters)
	const allConditions = [`identifier = ? COLLATE NOCASE`, ...conditions]
	const sql = `SELECT organism, disease, identifier, protein_accession, isoform, modsite, gene, sample, value, brain_region
		FROM proteome_abundance
		WHERE ${allConditions.join(' AND ')}`
	return db.prepare(sql).all(identifier, ...params)
}

async function getProteomeValuesFromCohort(ds, param, q) {
	const db = ds.queries.proteome.db
	const { assay, cohort, organism } = param.dataTypeDetails
	const organismConfig = q.organisms?.[organism]

	//organism
	if (!organismConfig) throw `queries.proteome invalid organism: ${organism}`
	const organismColumnIdx = organismConfig.columnIdx
	const organismColumnValue = organismConfig.columnValue

	//assay type
	const assayConfig = organismConfig.assays?.[assay]
	if (!assayConfig) throw `queries.proteome.get invalid assay: ${assay}`
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
	const controlSampleIds = new Set<string>()

	for (const tw of param.terms) {
		if (!tw) continue

		const fullGeneName = tw.term.name
		const identifier = fullGeneName.split(':')[1]?.trim()
		const geneName = fullGeneName.split(':')[0]?.trim()
		if (!identifier || !geneName)
			throw 'invalid term name for proteome query, must be in format geneName: uniqueIdentifier'

		// Query case and control samples from DB using organism filter + assay filter + cohort-specific filters
		const caseRows = queryDbRows(db, identifier, [...organismFilter, ...assayFilter, ...cohortCaseFilter])
		const controlRows = queryDbRows(db, identifier, [...organismFilter, ...assayFilter, ...cohortControlFilter])

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

		// accumulate sample values into a single s2v
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

	// Build bySampleId from the samples we actually have data for
	const bySampleId = {}

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
