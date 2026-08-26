import path from 'path'
import type { RouteApi, RoutePayload } from '#types'
import type { BrainRegionsRequest, BrainRegionsIsoform } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import serverconfig from '#src/serverconfig.js'
import { readGeneRows } from './termdb.bubbleHeatmap.ts'

/*
Brain Regional Proteome: per-region differential abundance of one gene's isoforms.
For every configured disease × region, the matching cohort (found by its case filter) serves
its precomputed DAPfile (log2FC + FDR [+ nominal p]), the same source as every other
fold-change view in the portal. No statistics are computed here.
*/

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
			const geneLower = gene.toLowerCase()

			// Find the cohort for a disease/region pair by matching its case filter on the
			// disease + region columns, plus any extra filters in brConfig.cohortFilter.
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
					if (!cohort?.DAPfile) continue
					const rows = await readGeneRows(path.join(serverconfig.tpmasterdir, cohort.DAPfile), geneLower)
					if (!rows?.length) continue
					for (const r of rows) {
						if (!isoforms[r.identifier]) isoforms[r.identifier] = { gene_name: r.gene, data: {} }
						if (!isoforms[r.identifier].data[disease]) isoforms[r.identifier].data[disease] = {}
						isoforms[r.identifier].data[disease][region] = { fold_change: r.fc, p_value: r.p ?? r.fdr, fdr: r.fdr }
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
