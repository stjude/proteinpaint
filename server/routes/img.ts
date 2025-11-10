import type { imgResponse, RouteApi } from '#types'
import { imgPayload } from '#types/checkers'

import path from 'path'
import fs from 'fs'
import * as utils from '../src/utils.js'
import { imageSize } from 'image-size'

export const api: RouteApi = {
	endpoint: 'img',
	methods: {
		get: {
			...imgPayload,
			init
		},
		post: {
			...imgPayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			sendImage(req, res)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function sendImage(req, res) {
	const [e, file] = utils.fileurl(req, true) // utils.fileurl({ query: { file: req.query.file } })
	try {
		if (e) throw 'invalid image file'
		const data = await fs.promises.readFile(file)
		const ext = path.extname(file).substring(1)
		const { width, height } = imageSize(file)
		const image: imgResponse = {
			src: `data:image/${ext};base64,${Buffer.from(data).toString('base64')}`,
			size: `${width}x${height}`
		}
		res.send({ ...image })
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}
