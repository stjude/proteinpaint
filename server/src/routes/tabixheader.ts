import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the header lines of a tabix file.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_tabixheader
	get init() {
		return serverconfig.features.disableFeature_tabixheader ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'tabixheader',
	methods: {
		get: payload
	}
}

function init() {
	return handle_tabixheader
}

async function handle_tabixheader(req, res) {
	try {
		const [e, file, isurl] = utils.fileurl(req)
		if (e) throw e
		const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
		const lines = await utils.get_header_tabix(file, dir)
		res.send({ lines })
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
