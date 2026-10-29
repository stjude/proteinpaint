import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import * as common from '#shared/common.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the cards of the app drawer.
Not set up when disabled by serverconfig.features.disableFeature_cardsjson.
*/

const payload: RoutePayload = {
	get init() {
		return serverconfig.features.disableFeature_cardsjson ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'cardsjson',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async function handle_cards(req, res) {
		try {
			if (req.query.datafile && req.query.tabixCoord) {
				const gn = genomes[req.query.genome]
				if (!gn) throw 'invalid genome'

				const c = common.string2pos(req.query.tabixCoord, gn, true)
				if (!c) throw 'invalid tabixCoord'

				const [e, file] = utils.fileurl({ query: { file: req.query.datafile } })
				if (e) throw e
				await utils.file_is_readable(file)

				const lines: string[] = []
				await utils.readTabixLines({
					file: file,
					regions: [{ chr: c.chr, start: c.start, stop: c.stop }],
					callback: line => lines.push(line)
				})
				res.send({ file: lines })
			} else {
				throw `invalid cards request`
			}
		} catch (e: any) {
			res.send({ error: e.message || e })
		}
	}
}
