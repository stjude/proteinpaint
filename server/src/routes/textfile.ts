import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of a server hosted text file.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_textfile
	get init() {
		return serverconfig.features.disableFeature_textfile ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'textfile',
	methods: {
		post: payload
	}
}

function init() {
	return handle_textfile
}

async function handle_textfile(req, res) {
	// load a server hosted text file
	try {
		if (!req.query.file) throw 'query.file missing'
		const [e, file] = utils.fileurl(req, true) // /textfile request is dangerous. must apply
		if (e) throw e
		if (req.query.from) throw 'from/to is no longer supported'
		res.send({ text: await utils.read_file(file) })
	} catch (e: any) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
