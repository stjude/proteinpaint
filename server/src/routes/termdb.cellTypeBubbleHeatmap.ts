import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import type {
	CellTypeBubbleHeatmapRequest,
	CellTypeBubbleHeatmapIsoform,
	CellTypeBubbleCell,
	CellTypeBubbleColumn,
	CellTypeBubbleRow
} from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import serverconfig from '#src/serverconfig.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'CellTypeBubbleHeatmapRequest' },
	response: { typeId: 'CellTypeBubbleHeatmapResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/cellTypeBubbleHeatmap',
	methods: {
		get: payload,
		post: payload
	}
}

// FDR threshold below which a cell is significant.
const SIGNIFICANCE_THRESHOLD = 0.05

/** one parsed DAPfile row (the file is: acc \t identifier \t gene \t log2FC \t FDR) */
type DapRow = {
	acc: string
	identifier: string
	gene: string
	fc: number
	fdr: number
}

/**
 * Read a DAPfile and return only the rows for one gene (case-insensitive match on
 * the gene column). Returns null when the file is missing/unreadable so the caller
 * leaves the cell empty.
 */
async function readGeneRows(filePath: string, geneLower: string): Promise<DapRow[] | null> {
	let content: string
	try {
		content = await fs.readFile(filePath, 'utf8')
	} catch {
		return null
	}
	const rows: DapRow[] = []
	const lines = content.trim().split('\n')
	for (let i = 1; i < lines.length; i++) {
		const parts = lines[i].split('\t')
		if (parts.length < 5) continue
		const gene = parts[2]
		if (!gene || gene.toLowerCase() !== geneLower) continue
		const acc = parts[0]
		if (!acc) continue
		const fc = Number(parts[3])
		if (!Number.isFinite(fc)) continue
		const fdr = Number(parts[4])
		if (!Number.isFinite(fdr)) continue
		rows.push({ acc, identifier: parts[1] || acc, gene, fc, fdr })
	}
	return rows
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: CellTypeBubbleHeatmapRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const proteomeConfig = ds.queries?.proteome
			if (!proteomeConfig) throw 'proteome not configured for this dataset'

			const cfg = proteomeConfig.cellTypeBubbleHeatmap
			if (!cfg) throw 'cellTypeBubbleHeatmap not configured for this dataset'

			const organismConfig = proteomeConfig.organisms?.[cfg.organism]
			if (!organismConfig) throw `invalid organism in cellTypeBubbleHeatmap config: ${cfg.organism}`
			const assayConfig = organismConfig.assays?.[cfg.assay]
			if (!assayConfig) throw `invalid assay in cellTypeBubbleHeatmap config: ${cfg.assay}`

			const gene = q.gene?.trim()
			if (!gene) throw 'gene is required'
			const geneLower = gene.toLowerCase()

			// columns = cellTypes × genotypes (order preserved); rows = timepoints
			const columns: CellTypeBubbleColumn[] = []
			for (const cellType of cfg.cellTypes) {
				for (const genotype of cfg.genotypes) {
					columns.push({
						key: `${cellType}_${genotype}`,
						cellType,
						genotype
					})
				}
			}
			const rows: CellTypeBubbleRow[] = cfg.timepoints.map(tp => ({ key: tp, label: tp }))

			const isoforms: { [isoformId: string]: CellTypeBubbleHeatmapIsoform } = {}

			// For each (column, row) the cohort is named `<cellType>_<genotype>_<timepoint>`.
			// Read the gene's rows from that cohort's DAPfile and, grouped by acc (isoform),
			// keep the single most-significant (lowest-FDR) row → one dot per cell.
			for (const col of columns) {
				for (const row of rows) {
					const cohortName = `${col.cellType}_${col.genotype}_${row.key}`
					const cohortConfig = assayConfig.cohorts?.[cohortName]
					if (!cohortConfig?.DAPfile) continue // cohort missing (e.g. OPC 4m) or no DAPfile → empty cell

					const matched = await readGeneRows(path.join(serverconfig.tpmasterdir, cohortConfig.DAPfile), geneLower)
					if (!matched?.length) continue // file missing/unreadable or gene absent → empty cell

					// group this gene's matching rows by acc (isoform); collapse each acc to
					// its most-significant (lowest-FDR) row
					const bestByAcc = new Map<string, DapRow>()
					for (const r of matched) {
						const cur = bestByAcc.get(r.acc)
						if (!cur || r.fdr < cur.fdr) bestByAcc.set(r.acc, r)
					}

					for (const [acc, r] of bestByAcc) {
						const cell: CellTypeBubbleCell = {
							id: r.identifier,
							log2FC: r.fc,
							fdr: r.fdr,
							significant: r.fdr < SIGNIFICANCE_THRESHOLD
						}
						if (!isoforms[acc]) isoforms[acc] = { gene_name: r.gene || acc, data: {} }
						const data = isoforms[acc].data
						if (!data[col.key]) data[col.key] = {}
						data[col.key][row.key] = cell
					}
				}
			}

			res.send({
				isoforms,
				columns,
				rows,
				fdrThreshold: SIGNIFICANCE_THRESHOLD
			})
		} catch (e: any) {
			const status = typeof e?.status === 'number' ? e.status : 400
			res.status(status).send({ status, error: e.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
