import path from 'path'
import fs from 'fs/promises'
import type { RouteApi } from '#types'
import type { DapVolcanoRequest, DapEntry } from '#types'
import { dapVolcanoPayload } from '#types/checkers'
import { get_ds_tdb } from '#src/termdb.js'
import { renderVolcano } from '../src/renderVolcano.ts'
import serverconfig from '../src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'termdb/dapVolcano',
	methods: {
		get: {
			...dapVolcanoPayload,
			init
		},
		post: {
			...dapVolcanoPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: DapVolcanoRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const [ds] = get_ds_tdb(genome, q)

			const cohortConfig = ds.queries?.proteome?.organisms?.[q.organism]?.assays?.[q.assay]?.cohorts?.[q.cohort]
			if (!cohortConfig?.DAPfile) throw 'DAP file not configured for this cohort'

			const filePath = path.join(serverconfig.tpmasterdir, cohortConfig.DAPfile)
			const content = await fs.readFile(filePath, 'utf8')
			const lines = content.trim().split('\n')

			const rustRows: (DapEntry & { adjusted_p_value: number })[] = []
			for (let i = 1; i < lines.length; i++) {
				const parts = lines[i].split('\t')
				if (parts.length < 4) continue
				const pValue = Number(parts[3])
				if (!Number.isFinite(pValue)) continue
				rustRows.push({
					gene_name: parts[0],
					gene: parts[1],
					fold_change: Number(parts[2]),
					original_p_value: pValue,
					adjusted_p_value: pValue
				})
			}

			const rendered = await renderVolcano(rustRows, q.volcanoRender)
			for (const d of rendered.dots) delete (d as any).adjusted_p_value
			res.send({ data: rendered as any })
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
