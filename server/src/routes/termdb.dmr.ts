import type { RoutePayload, RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { invalidcoord } from '#shared/common.js'
import { mayLog } from '#src/helpers.ts'
import { resolveMethylationMatrix, resolveGroupNames, admitDmrcateJobs } from '#src/utils/methylationMatrix.ts'
import { resolveGroupPair } from '#src/utils/sampleGroups.ts'
import serverconfig from '#src/serverconfig.js'
import { formatElapsedTime } from '#shared'
import { genomes } from '#src/initGenomesDs.js'
import { hasDnaMethylationDs } from './termdb.diffMeth.ts'

// a module-local copy, since serverconfig.cachedir is deleted before the server starts listening
const cachedir = serverconfig.cachedir

export const payload: RoutePayload = {
	// only set up when at least one ds has ds.queries.dnaMethylation, see termdb.diffMeth.ts
	get init() {
		return hasDnaMethylationDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbDmrRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbDmrResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/dmr',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbDmrRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'unknown ds'
			const dm = ds.queries?.dnaMethylation
			if (!dm) throw new Error('This dataset does not support DNA methylation region analysis.')

			const { matrixFile, mvalues, eligible } = resolveMethylationMatrix(ds, q.chr, q.element_type)

			// a group may be defined by a filter
			const [list1, list2] = await resolveGroupPair(q, ds)
			if (!Array.isArray(list1) || list1.length == 0)
				throw new Error('Group 1 has no samples. Please select at least one sample.')
			if (!Array.isArray(list2) || list2.length == 0)
				throw new Error('Group 2 has no samples. Please select at least one sample.')
			if (invalidcoord(genome, q.chr, q.start, q.stop))
				throw new Error(`Invalid genomic coordinates: ${q.chr}:${q.start}-${q.stop}`)

			// Hard server-side safety cap — prevents expensive requests regardless of client settings.
			// The client enforces its own configurable limit (settings.dmr.maxRegionSize, default 5 Mb)
			// which should always be <= this cap. This guard catches direct API calls or buggy clients.
			const SERVER_MAX_REGION_BP = 10_000_000
			const span = q.stop - q.start
			if (span > SERVER_MAX_REGION_BP)
				throw new Error(
					`Region too large (${(span / 1e6).toFixed(1)} Mb). Server maximum is ${SERVER_MAX_REGION_BP / 1e6} Mb.`
				)

			const { group1, group2 } = await resolveGroupNames(list1, list2, eligible, ds, q.__protected__)
			// checked after id-to-name resolution, which is where a group actually shrinks
			if (group1.length < 3 || group2.length < 3)
				throw new Error(
					`Each group needs at least 3 samples with methylation data (got ${group1.length} and ${group2.length}).`
				)

			const dmrInput = {
				probe_h5_file: matrixFile,
				mvalues,
				cachedir,
				genome: q.genome,
				chr: q.chr,
				start: q.start,
				stop: q.stop,
				case: group2.join(','),
				control: group1.join(','),
				fdr_cutoff: q.fdr_cutoff,
				lambda: q.lambda,
				C: q.C,
				blockWidth: q.blockWidth,
				devicePixelRatio: q.devicePixelRatio,
				maxLoessRegion: q.maxLoessRegion,
				colors: q.colors
			}

			const releaseMemory = await admitDmrcateJobs(
				'DMR region',
				[matrixFile],
				1,
				'Server memory is too low to analyze this region right now. Try again later.'
			)
			const time1 = Date.now()
			let result
			try {
				result = JSON.parse(await run_rust('dmrcate', JSON.stringify(dmrInput)))
			} finally {
				releaseMemory()
			}
			mayLog('DMR analysis time:', formatElapsedTime(Date.now() - time1))
			if (result.error) throw new Error(result.error)

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
