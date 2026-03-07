import type { RouteApi, TermdbDmrRequest, TermdbDmrSuccessResponse } from '#types'
import { TermdbDmrPayload } from '#types/checkers'
import { run_R } from '@sjcrh/proteinpaint-r'
import { invalidcoord } from '#shared/common.js'

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
			if (!ds.queries?.dnaMethylation) throw new Error('not supported')

			if (!Array.isArray(q.group1) || q.group1.length == 0) throw new Error('group1 not non empty array')
			if (!Array.isArray(q.group2) || q.group2.length == 0) throw new Error('group2 not non empty array')

			if (invalidcoord(genome, q.chr, q.start, q.stop)) throw new Error('invalid chr/start/stop')

			const arg = {
				group1: q.group1,
				group2: q.group2,
				file: ds.queries.dnaMethylation.file, // todo change file to mValueFile
				chr: q.chr,
				start: q.start,
				stop: q.stop
			}

			const result: any = JSON.parse(await run_R('dmr.R', JSON.stringify(arg)))
			if (result.error) throw new Error(result.error)
			res.send(result as TermdbDmrSuccessResponse)
		} catch (e: any) {
			res.send({ error: e.message || e })
		}
	}
}
