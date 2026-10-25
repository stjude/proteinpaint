import fs from 'fs'
import path from 'path'
import type { RouteApi, RoutePayload } from '#types'
import * as utils from '#src/utils.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the svmr file.
*/

const payload: RoutePayload = {
	// not set up when disabled by serverconfig.features.disableFeature_svmr
	get init() {
		return serverconfig.features.disableFeature_svmr ? null : init
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'svmr',
	methods: {
		post: payload
	}
}

function init() {
	return handle_svmr
}

function handle_svmr(req, res) {
	if (req.query.file) {
		const [e, file, isurl] = utils.fileurl(req)
		// only a file under tp is read
		const tp = path.resolve(serverconfig.tpmasterdir)
		const resolved = e || isurl ? '' : path.resolve(file)
		if (!resolved.startsWith(tp + path.sep)) {
			res.send({ error: 'illegal file name' })
			return
		}
		fs.readFile(resolved, 'utf8', (err, data) => {
			if (err) {
				res.send({ error: 'cannot read file' })
				return
			}
			res.send({ raw: data })
			return
		})
	} else {
		res.send({ error: 'missing file' })
	}
}
