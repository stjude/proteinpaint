import type { RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { run_R } from '@sjcrh/proteinpaint-r'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { getProbeLimmaCachePath, getProbeLimmaCacheStatus, spawnProbeLimmaJob } from '#src/probeLimmaCache.ts'

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

			const useR = q.backend === 'r'
			console.log(`DMR ${useR ? 'R' : 'Rust'} request: ${q.chr}:${q.start}-${q.stop} backend=${q.backend}`)
			const time1 = Date.now()
			let result: any

			if (useR) {
				// R backend: requires cached probe-level limma results from probeLimma.R
				const cachePath = getProbeLimmaCachePath(ds.label, group2, group1)
				const cacheStatus = getProbeLimmaCacheStatus(cachePath)
				mayLog('R cache status:', cacheStatus.status, 'path:', cachePath)
				if (cacheStatus.status === 'none') {
					// No cache — spawn background job and tell client to wait
					spawnProbeLimmaJob(cachePath, {
						probe_h5_file: ds.queries.dnaMethylation.file,
						case: group2.join(','),
						control: group1.join(','),
						cache_file: cachePath,
						running_file: cachePath + '.running'
					})
					res.send({ status: 'computing' })
					return
				}
				if (cacheStatus.status === 'computing') {
					res.send({ status: 'computing' })
					return
				}
				if (cacheStatus.status === 'error') {
					throw new Error(`Probe-level limma failed: ${cacheStatus.message}`)
				}
				const rInput = {
					cache_file: cachePath,
					probe_h5_file: ds.queries.dnaMethylation.file,
					chr: q.chr,
					start: q.start,
					stop: q.stop,
					case: group2.join(','),
					control: group1.join(','),
					fdr_cutoff: q.fdr_cutoff,
					lambda: q.lambda,
					C: q.C
				}
				result = JSON.parse(await run_R('dmrcate.R', JSON.stringify(rInput)))
			} else {
				// Rust backend (default): genome-wide eBayes in a single binary
				const rustInput = {
					probe_h5_file: ds.queries.dnaMethylation.file,
					chr: q.chr,
					start: q.start,
					stop: q.stop,
					case: group2.join(','),
					control: group1.join(','),
					fdr_cutoff: q.fdr_cutoff,
					lambda: q.lambda,
					C: q.C
				}
				result = JSON.parse(await run_rust('dmrcate', JSON.stringify(rustInput)))
			}
			mayLog(`DMR analysis (${useR ? 'R' : 'Rust'}) time:`, formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)
			// Debug: log per-probe stats for comparison
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
