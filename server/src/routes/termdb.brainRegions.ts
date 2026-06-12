import type { RouteApi, RoutePayload } from '#types'
import type { BrainRegionsRequest, BrainRegionsIsoform } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { getCohortStats, queryDbRows } from '../../routes/termdb.proteome.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'BrainRegionsRequest' },
	response: { typeId: 'BrainRegionsResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/brainRegions',
	methods: {
		get: payload,
		post: payload
	}
}

type Filter = { columnIdx: number; columnValue: string | number }

function hasFilter(filters: Filter[], target: Filter): boolean {
	return filters.some(f => f.columnIdx === target.columnIdx && f.columnValue === target.columnValue)
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: BrainRegionsRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const proteomeConfig = ds.queries?.proteome
			if (!proteomeConfig) throw 'proteome not configured for this dataset'

			const brConfig = proteomeConfig.brainRegions
			if (!brConfig) throw 'brainRegions not configured for this dataset'

			const organismConfig = proteomeConfig.organisms?.[brConfig.organism]
			if (!organismConfig) throw 'invalid organism in brainRegions config'

			const assayConfig = organismConfig.assays?.[brConfig.assay]
			if (!assayConfig) throw 'invalid assay in brainRegions config'

			const gene = q.gene?.trim()
			if (!gene) throw 'gene is required'

			const db = proteomeConfig.db
			if (!db) throw 'proteome database not available'

			// Every proteome query must include the organism + assay filter prefix
			// (matches the organism + assay prefix queryDbRows uses in termdb.proteome.ts)
			const orgAssayFilter: Filter[] = [
				{ columnIdx: organismConfig.columnIdx, columnValue: organismConfig.columnValue },
				{ columnIdx: assayConfig.columnIdx, columnValue: assayConfig.columnValue }
			]

			// Find the cohort whose caseFilter matches (disease, region) — plus any
			// optional extra filters in brConfig.cohortFilter — so we can reuse its
			// controlFilter / caseFilter / prior without duplicating them in config.
			const findCohort = (disease: string, region: string) => {
				const required: Filter[] = [
					{ columnIdx: brConfig.diseaseColumnIdx, columnValue: disease },
					{ columnIdx: brConfig.regionColumnIdx, columnValue: region },
					...(brConfig.cohortFilter ?? [])
				]
				const cohorts = assayConfig.cohorts ?? {}
				for (const name in cohorts) {
					const c = cohorts[name]
					if (!c?.caseFilter) continue
					if (required.every(r => hasFilter(c.caseFilter, r))) return c
				}
				return undefined
			}

			const isoforms: { [isoformId: string]: BrainRegionsIsoform } = {}

			for (const disease of brConfig.diseases) {
				for (const region of Object.keys(brConfig.regions)) {
					const cohort = findCohort(disease, region)
					if (!cohort) continue

					const caseRows = queryDbRows(db, 'gene', gene, [...orgAssayFilter, ...cohort.caseFilter])
					const controlRows = queryDbRows(db, 'gene', gene, [...orgAssayFilter, ...cohort.controlFilter])
					if (caseRows.length === 0 && controlRows.length === 0) continue

					// Group sample→value per isoform across both case and control rows.
					const perIsoform: {
						[id: string]: { geneName: string; s2v: { [sample: string]: number } }
					} = {}
					const controlSampleIds = new Set<string>()

					const addRow = (row: any, isControl: boolean) => {
						const id = row.identifier
						if (!id) return
						const v = Number(row.value)
						if (!Number.isFinite(v)) return
						if (!perIsoform[id]) perIsoform[id] = { geneName: row.gene || id, s2v: {} }
						perIsoform[id].s2v[row.sample] = v
						if (isControl) controlSampleIds.add(String(row.sample))
					}
					for (const r of controlRows) addRow(r, true)
					for (const r of caseRows) addRow(r, false)

					for (const id in perIsoform) {
						const { geneName, s2v } = perIsoform[id]
						const stats = getCohortStats(s2v, controlSampleIds, cohort.prior)
						if (stats.foldChange == null || stats.pValue == null) continue
						// getCohortStats returns testedMean/controlMean (raw ratio). The
						// brain-regions plot expects log2 FC (legend says "Fold Change (log₂)",
						// color scale is centered at 0).
						if (!(stats.foldChange > 0)) continue
						const log2FC = Math.log2(stats.foldChange)

						if (!isoforms[id]) isoforms[id] = { gene_name: geneName, data: {} }
						if (!isoforms[id].data[disease]) isoforms[id].data[disease] = {}
						isoforms[id].data[disease][region] = {
							fold_change: log2FC,
							p_value: stats.pValue
						}
					}
				}
			}

			res.send({
				isoforms,
				regions: brConfig.regions,
				diseases: brConfig.diseases,
				templateUrl: brConfig.templateUrl,
				svgUrl: brConfig.svgUrl
			})
		} catch (e: any) {
			const status = typeof e?.status === 'number' ? e.status : 400
			res.status(status).send({ status, error: e.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
