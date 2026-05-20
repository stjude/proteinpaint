import { fileurl, file_is_readable } from '#src/utils.js'
import { do_hicstat } from '#src/hicstat.ts'
import type { HicstatRequest, HicstatResponse, RouteApi } from '#types'
import { hicstatPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'hicstat',
	methods: {
		get: {
			...hicstatPayload,
			init
		},
		post: {
			...hicstatPayload,
			init
		}
	}
}

function init() {
	return async (req: { query: HicstatRequest }, res): Promise<void> => {
		try {
			const [e, file, isurl] = fileurl(req)
			if (e) throw 'illegal file name'
			if (!isurl) {
				await file_is_readable(file)
			}
			const out: HicstatResponse = await do_hicstat(file, isurl)
			res.send({ out })
		} catch (e) {
			res.send({ error: e instanceof Error ? e.message : e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
