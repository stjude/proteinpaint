import type { RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '#src/serverconfig.js'
import { formatElapsedTime } from '#shared'

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
			if (!genome) throw new Error(`Unknown genome "${q.genome}". Please check dataset configuration.`)
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error(`Dataset "${q.dslabel}" not found.`)
			if (!ds.queries?.dnaMethylation) throw new Error('This dataset does not support DNA methylation analysis.')

			if (!Array.isArray(q.group1) || q.group1.length == 0)
				throw new Error('Group 1 has no samples. Please select at least one sample.')
			if (!Array.isArray(q.group2) || q.group2.length == 0)
				throw new Error('Group 2 has no samples. Please select at least one sample.')
			if (invalidcoord(genome, q.chr, q.start, q.stop))
				throw new Error(`Invalid genomic coordinates: ${q.chr}:${q.start}-${q.stop}`)

			const group1 = q.group1.map(s => s.sample).filter(Boolean)
			const group2 = q.group2.map(s => s.sample).filter(Boolean)
			if (group1.length < 3)
				throw new Error(`Group 1 needs at least 3 samples with methylation data, got ${group1.length}.`)
			if (group2.length < 3)
				throw new Error(`Group 2 needs at least 3 samples with methylation data, got ${group2.length}.`)

			const useR = q.backend === 'r'
			const dmrInput = {
				probe_h5_file: ds.queries.dnaMethylation.file,
				cachedir: serverconfig.cachedir,
				genome: q.genome,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				case: group2.join(','),
				control: group1.join(','),
				fdr_cutoff: q.fdr_cutoff,
				lambda: q.lambda,
				C: q.C
			}

			const time1 = Date.now()
			const result = useR
				? JSON.parse(await run_R('dmrcate_full.R', JSON.stringify(dmrInput)))
				: JSON.parse(await run_rust('dmrcate', JSON.stringify(dmrInput)))
			mayLog(`DMR analysis (${useR ? 'R' : 'Rust'}) time:`, formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)

			// Debug: log per-probe stats for R vs Rust comparison. Will remove once confident in Rust implementation.
			if (result.diagnostic?.probes) {
				const p = result.diagnostic.probes
				mayLog(
					`${useR ? 'R' : 'Rust'} probes logFC:`,
					p.logFC,
					'fdr:',
					p.fdr?.map((f: number) => f.toExponential(4))
				)
			}

			res.send({
				status: 'ok',
				dmrs: result.dmrs,
				diagnostic: result.diagnostic
			} as TermdbDmrSuccessResponse)
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
