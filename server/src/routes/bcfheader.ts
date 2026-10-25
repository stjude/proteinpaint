import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the header of a custom bcf track.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_bcfheader
	get init() {
		return serverconfig.features.disableFeature_bcfheader ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'bcfheader',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async function handle_bcfheader(req, res) {
		// get header for a single custom bcf track
		try {
			if (!req.query.genome) throw 'genome missing'
			const g = genomes[req.query.genome]
			if (!g) throw 'invalid genome'
			const [e, file, isurl] = utils.fileurl(req)
			if (e) throw e
			const dir = isurl ? await utils.cache_index(file, req.query.indexURL) : null
			res.send({
				header: await utils.get_header_bcf(file, dir),
				nochr: await utils.tabix_is_nochr(file, dir, g)
			})
		} catch (e: any) {
			if (e.stack) console.error(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
