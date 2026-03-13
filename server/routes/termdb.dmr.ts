import type { RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { run_python } from '@sjcrh/proteinpaint-python'
import { invalidcoord } from '#shared/common.js'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const cachedir_gpdm = path.join(serverconfig.cachedir, 'gpdm')
if (!fs.existsSync(cachedir_gpdm)) fs.mkdirSync(cachedir_gpdm, { recursive: true })

export const api: RouteApi = {
	endpoint: 'termdb/dmr',
	methods: {
		get: {
			...TermdbDmrPayload,
			init
		},
		post: {
			...TermdbDmrPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbDmrRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('invalid genome')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('invalid ds')
			if (!ds.queries?.dnaMethylation) throw new Error('analysis not supported')

			if (!Array.isArray(q.group1) || q.group1.length == 0) throw new Error('group1 not non empty array')
			if (!Array.isArray(q.group2) || q.group2.length == 0) throw new Error('group2 not non empty array')
			if (invalidcoord(genome, q.chr, q.start, q.stop)) throw new Error('invalid chr/start/stop')

			const group1 = q.group1.map(s => s.sample).filter(Boolean)
			const group2 = q.group2.map(s => s.sample).filter(Boolean)
			if (group1.length < 3) throw new Error(`Need at least 3 samples in group1, got ${group1.length}`)
			if (group2.length < 3) throw new Error(`Need at least 3 samples in group2, got ${group2.length}`)

			const plotPath = path.join(cachedir_gpdm, `dmr_${crypto.randomBytes(16).toString('hex')}.png`)

			const gpdmInput = {
				h5file: ds.queries.dnaMethylation.file,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				group1,
				group2,
				annotations: q.annotations || [],
				nan_threshold: q.nan_threshold ?? 0.5,
				plot_path: plotPath
			}

			const time1 = Date.now()
			const result = JSON.parse(await run_python('gpdm_analysis.py', JSON.stringify(gpdmInput)))
			mayLog('DMR analysis time:', formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)

			// PNG is written to cachedir_gpdm by Python and kept there for reference
			res.send({ status: 'ok', dmrs: result.dmrs } as TermdbDmrSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
