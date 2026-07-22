import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import type { DapVolcanoRequest, DapEntry } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { renderVolcano } from '#src/renderVolcano.ts'
import serverconfig from '#src/serverconfig.js'
import { countDistinctSamples } from '../../routes/termdb.proteome.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'DapVolcanoRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'DapVolcanoResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/dapVolcano',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: DapVolcanoRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const proteomeConfig = ds.queries?.proteome
			if (!proteomeConfig) throw 'proteome not configured for this dataset'

			const organismConfig = proteomeConfig.organisms?.[q.organism]
			if (!organismConfig) throw 'invalid organism'

			const assayConfig = organismConfig.assays?.[q.assay]
			if (!assayConfig) throw 'invalid assay'

			const cohortConfig = assayConfig.cohorts?.[q.cohort]
			if (!cohortConfig) throw 'invalid cohort'
			if (!cohortConfig.DAPfile) throw 'DAP file not configured for this cohort'

			const organismFilter = [{ columnIdx: organismConfig.columnIdx, columnValue: organismConfig.columnValue }]
			const assayFilter = [{ columnIdx: assayConfig.columnIdx, columnValue: assayConfig.columnValue }]
			const db = proteomeConfig.db
			const controlCount = countDistinctSamples(db, [...organismFilter, ...assayFilter, ...cohortConfig.controlFilter])
			const caseCount = countDistinctSamples(db, [...organismFilter, ...assayFilter, ...cohortConfig.caseFilter])

			if (q.countsOnly) {
				res.send({ sample_size1: controlCount, sample_size2: caseCount })
				return
			}

			const filePath = path.join(serverconfig.tpmasterdir, cohortConfig.DAPfile)
			const content = await fs.readFile(filePath, 'utf8')
			const lines = content.trim().split('\n')

			// DAP file columns: acc, identifier, gene, log2FC, FDR (the p-value column is already an FDR)
			const rustRows: (DapEntry & { adjusted_p_value: number })[] = []
			for (let i = 1; i < lines.length; i++) {
				const parts = lines[i].split('\t')
				if (parts.length < 5) continue
				const fc = Number(parts[3])
				if (!Number.isFinite(fc)) continue
				const fdr = Number(parts[4])
				if (!Number.isFinite(fdr)) continue
				// the file only carries the FDR; use it for both p-value fields (the volcano defaults to adjusted)
				rustRows.push({
					gene_name: parts[1],
					gene: parts[2],
					fold_change: fc,
					original_p_value: fdr,
					adjusted_p_value: fdr
				})
			}

			const rendered = await renderVolcano(rustRows, q.volcanoRender)
			for (const d of rendered.dots) delete (d as any).adjusted_p_value
			res.send({
				data: rendered as any,
				sample_size1: controlCount,
				sample_size2: caseCount
			})
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
