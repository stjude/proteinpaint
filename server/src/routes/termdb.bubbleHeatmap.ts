import path from 'path'
import fs from 'fs/promises'
import type { RouteApi, RoutePayload } from '#types'
import type { BubbleHeatmapRequest, BubbleHeatmapIsoform, BubbleSite } from '#types'
import { get_ds_tdb } from '#src/termdb.js'
import serverconfig from '#src/serverconfig.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'BubbleHeatmapRequest' },
	response: { typeId: 'BubbleHeatmapResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/bubbleHeatmap',
	methods: {
		get: payload,
		post: payload
	}
}

// raw p-value threshold below which a site is significant.
const SIGNIFICANCE_THRESHOLD = 0.05

/** one parsed DAPfile row (the file is: acc \t identifier \t gene \t log2FC \t p-value) */
type DapRow = {
	acc: string
	/** base UniProt accession (isoform suffix stripped), e.g. P10636 from sp|P10636-8|TAU_HUMAN */
	baseAcc: string
	identifier: string
	gene: string
	/** log2 fold change */
	fc: number
	/** raw p-value */
	p: number
}

/** sp|P10636-8|TAU_HUMAN → P10636 ; falls back to the raw acc when it doesn't parse */
function baseUniProtAcc(acc: string): string {
	const parts = acc.split('|')
	const id = parts.length >= 2 ? parts[1] : acc
	const dash = id.indexOf('-')
	return dash > 0 ? id.slice(0, dash) : id
}

/**
 * Read a DAPfile and return only the rows for one gene (case-insensitive match on
 * the gene column). Each (assay, cohort) DAPfile (~10k rows) is read once per
 * request and scanned linearly — cheap enough for the handful of files a request
 * touches. Returns null when the file is missing/unreadable so the caller leaves
 * the cell empty.
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
		const p = Number(parts[4])
		if (!Number.isFinite(p)) continue
		rows.push({ acc, baseAcc: baseUniProtAcc(acc), identifier: parts[1] || acc, gene, fc, p })
	}
	return rows
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: BubbleHeatmapRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const proteomeConfig = ds.queries?.proteome
			if (!proteomeConfig) throw 'proteome not configured for this dataset'

			const bhConfig = proteomeConfig.bubbleHeatmap
			if (!bhConfig) throw 'bubbleHeatmap not configured for this dataset'

			const organismConfig = proteomeConfig.organisms?.[bhConfig.organism]
			if (!organismConfig) throw `invalid organism in bubbleHeatmap config: ${bhConfig.organism}`

			const gene = q.gene?.trim()
			if (!gene) throw 'gene is required'
			const geneLower = gene.toLowerCase()

			// Reference assay used as the total-protein baseline for protein-abundance
			// adjustment. Only advertise it if it actually exists for this organism.
			const refAssayName = proteomeConfig.proteinReferenceAssay
			const refAssayConfig = refAssayName ? organismConfig.assays?.[refAssayName] : undefined
			const proteinReferenceAssay = refAssayConfig ? refAssayName! : null

			// Lazily-built per-cohort map: base UniProt acc → reference-assay protein log2FC,
			// for the queried gene only. When a base acc has more than one row we take the
			// most-significant (lowest raw p), matching how the reference assay's own dot is
			// displayed, so the subtracted baseline equals the value shown.
			const proteinRefByCohort = new Map<string, Map<string, number>>()
			const getProteinRef = async (cohortName: string): Promise<Map<string, number>> => {
				const cached = proteinRefByCohort.get(cohortName)
				if (cached) return cached
				const map = new Map<string, number>()
				const refCohort = refAssayConfig?.cohorts?.[cohortName]
				if (refCohort?.DAPfile) {
					const rows = await readGeneRows(path.join(serverconfig.tpmasterdir, refCohort.DAPfile), geneLower)
					if (rows) {
						const bestByBase = new Map<string, DapRow>()
						for (const r of rows) {
							const cur = bestByBase.get(r.baseAcc)
							if (!cur || r.p < cur.p) bestByBase.set(r.baseAcc, r)
						}
						for (const [baseAcc, best] of bestByBase) map.set(baseAcc, best.fc)
					}
				}
				proteinRefByCohort.set(cohortName, map)
				return map
			}

			const isoforms: { [isoformId: string]: BubbleHeatmapIsoform } = {}
			const ptmAssays: string[] = []

			// For each (assay, cohort), read the gene's rows from the DAPfile and emit sites,
			// grouped by acc (isoform). Every row is emitted (significant or not) with a
			// `significant` flag; the client decides what to draw.
			//  - PTM assays (PTMType set): one site per modification site → many small dots
			//  - non-PTM assays (whole/insoluble proteome): collapse each acc to its single
			//    most-significant (lowest-p) row → one big dot
			for (const assayName of bhConfig.assays) {
				const assayConfig = organismConfig.assays?.[assayName]
				if (!assayConfig) continue // assay not present for this organism — leave column empty
				const isPTM = !!assayConfig.PTMType
				if (isPTM) ptmAssays.push(assayName)
				const adjustable = !!proteinReferenceAssay && isPTM

				for (const cohortName of bhConfig.cohorts) {
					const cohortConfig = assayConfig.cohorts?.[cohortName]
					if (!cohortConfig?.DAPfile) continue // missing cohort or no DAPfile — leave cell empty

					const matched = await readGeneRows(path.join(serverconfig.tpmasterdir, cohortConfig.DAPfile), geneLower)
					if (!matched?.length) continue // file missing/unreadable or gene absent → empty cell

					const proteinRef = adjustable ? await getProteinRef(cohortName) : null

					// group this gene's matching rows by acc (isoform)
					const rowsByAcc = new Map<string, DapRow[]>()
					for (const r of matched) {
						let arr = rowsByAcc.get(r.acc)
						if (!arr) rowsByAcc.set(r.acc, (arr = []))
						arr.push(r)
					}

					for (const [acc, rows] of rowsByAcc) {
						// PTM: keep every site (significant or not). non-PTM: collapse to the
						// single most-significant row. Significance is flagged per site so the
						// client can render non-significant ones faded.
						let chosen: DapRow[]
						if (isPTM) {
							chosen = rows
						} else {
							let best = rows[0]
							for (const r of rows) if (r.p < best.p) best = r
							chosen = [best]
						}

						for (const r of chosen) {
							const site: BubbleSite = {
								id: r.identifier,
								log2FC: r.fc,
								p_value: r.p,
								significant: r.p < SIGNIFICANCE_THRESHOLD,
								adjustedAvailable: false
							}
							if (proteinRef) {
								const pf = proteinRef.get(r.baseAcc)
								if (pf !== undefined) {
									site.proteinLog2FC = pf
									site.adjustedLog2FC = r.fc - pf
									site.adjustedAvailable = true
								}
							}
							if (!isoforms[acc]) isoforms[acc] = { gene_name: r.gene || acc, data: {} }
							const data = isoforms[acc].data
							if (!data[assayName]) data[assayName] = {}
							if (!data[assayName][cohortName]) data[assayName][cohortName] = { sites: [] }
							data[assayName][cohortName].sites.push(site)
						}
					}
				}
			}

			res.send({
				isoforms,
				ptmAssays,
				assays: bhConfig.assays,
				cohorts: bhConfig.cohorts,
				pValueThreshold: SIGNIFICANCE_THRESHOLD,
				proteinReferenceAssay
			})
		} catch (e: any) {
			const status = typeof e?.status === 'number' ? e.status : 400
			res.status(status).send({ status, error: e.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
