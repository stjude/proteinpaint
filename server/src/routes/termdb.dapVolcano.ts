import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import type { DapVolcanoRequest, DapEntry } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import { renderVolcano } from '#src/renderVolcano.ts'
import serverconfig from '#src/serverconfig.js'
import { listCohortSamples } from '../../routes/termdb.proteome.ts'
import { run_R } from '@sjcrh/proteinpaint-r'

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

/** parse a DAP file (acc \t identifier \t gene \t log2FC \t FDR) into volcano entries.
 *  The file carries a single significance value (FDR); it is stored in both
 *  original_p_value and adjusted_p_value so the generic volcano renderer can
 *  threshold on either pValueType without special-casing this route
 *  (renderVolcano defaults to pValueType 'adjusted' when none is requested). */
async function readDap(DAPfile: string): Promise<DapEntry[]> {
	const content = await fs.readFile(path.join(serverconfig.tpmasterdir, DAPfile), 'utf8')
	const lines = content.trim().split('\n')
	const rows: DapEntry[] = []
	for (let i = 1; i < lines.length; i++) {
		const parts = lines[i].split('\t')
		if (parts.length < 5 || !parts[2]) continue
		const fc = Number(parts[3])
		if (!Number.isFinite(fc)) continue
		const fdr = Number(parts[4])
		if (!Number.isFinite(fdr)) continue
		rows.push({ gene_name: parts[1], gene: parts[2], fold_change: fc, original_p_value: fdr, adjusted_p_value: fdr })
	}
	return rows
}

/** one most-significant row per upper-cased gene symbol */
function bestPerGene(rows: DapEntry[]): Map<string, DapEntry> {
	const best = new Map<string, DapEntry>()
	for (const r of rows) {
		const g = r.gene.toUpperCase()
		const cur = best.get(g)
		if (!cur || (r.adjusted_p_value ?? Infinity) < (cur.adjusted_p_value ?? Infinity)) best.set(g, r)
	}
	return best
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
			// sample lists are memoized per cohort (they don't depend on the gene)
			const controlCount = listCohortSamples(db, [
				...organismFilter,
				...assayFilter,
				...cohortConfig.controlFilter
			]).length
			const caseCount = listCohortSamples(db, [...organismFilter, ...assayFilter, ...cohortConfig.caseFilter]).length

			if (q.countsOnly) {
				res.send({ sample_size1: controlCount, sample_size2: caseCount })
				return
			}

			const rustRows = await readDap(cohortConfig.DAPfile)

			// concordance mode (proteinView concordance tile): join this cohort's DAP with
			// another's on upper-cased gene (human APP ↔ mouse App), one most-significant row
			// per gene, and correlate log2FC across the shared genes with R's cor.test (corr.R)
			if (q.concordanceWith) {
				const w = typeof q.concordanceWith === 'string' ? JSON.parse(q.concordanceWith) : q.concordanceWith
				const wc = proteomeConfig.organisms?.[w?.organism]?.assays?.[w?.assay]?.cohorts?.[w?.cohort]
				if (!wc?.DAPfile) throw `no DAPfile for ${w?.organism}/${w?.assay}/${w?.cohort}`
				const yRows = await readDap(wc.DAPfile)
				const x = bestPerGene(rustRows)
				const y = bestPerGene(yRows)
				const points: { gene: string; x: number; y: number }[] = []
				for (const [gene, vx] of x) {
					const vy = y.get(gene)
					if (vy) points.push({ gene, x: vx.fold_change, y: vy.fold_change })
				}
				let r: number | null = null
				let p: number | null = null
				// cor.test needs ≥3 observations; NA (e.g. a constant side) comes back as a string
				if (points.length >= 3) {
					const input = {
						method: 'pearson',
						terms: [{ id: 'xy', v1: points.map(pt => pt.x), v2: points.map(pt => pt.y) }]
					}
					const [out] = JSON.parse(await run_R('corr.R', JSON.stringify(input)))
					const rv = Number(out?.correlation)
					const pv = Number(out?.original_p_value)
					r = Number.isFinite(rv) ? rv : null
					p = Number.isFinite(pv) ? pv : null
				}
				res.send({
					sample_size1: controlCount,
					sample_size2: caseCount,
					concordance: { points, r, p, n: points.length }
				})
				return
			}

			const rendered = await renderVolcano(rustRows, q.volcanoRender)
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
