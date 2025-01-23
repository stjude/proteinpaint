import type { Image, imgRequest, imgResponse, RouteApi } from '#types'
import { imgPayload } from '#types/checkers'

import path from 'path'
import fs from 'fs'
import * as utils from '../src/utils.js'
import imagesize from 'image-size'

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

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		console.log('getImageFromPath', req.query)
		try {
			const q: imgRequest = req.query
			sendImage(req, res)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function sendImage(req, res) {
	const [e, file, isurl] = utils.fileurl(req, true) // utils.fileurl({ query: { file: req.query.file } })
	try {
		if (e) throw 'invalid image file'
		const data = await fs.promises.readFile(file)
		const ext = path.extname(file).substring(1)
		const image: imgResponse = {
			src: `data:image/${ext};base64,${Buffer.from(data).toString('base64')}`,
			size: imagesize(file)
		}
		res.send({ ...image })
	} catch (e: any) {
		res.send({ error: e.message || e })
	}
}
