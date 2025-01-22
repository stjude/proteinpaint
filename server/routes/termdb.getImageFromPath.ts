import type { Image, TermdbGetImageFromPathRequest, TermdbGetImageFromPathResponse, RouteApi } from '#types'
import { termdbGetImageFromPathPayload } from '#types/checkers'

import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'termdb/getImageFromPath',
	methods: {
		get: {
			...termdbGetImageFromPathPayload,
			init
		},
		post: {
			...termdbGetImageFromPathPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		console.log('getImageFromPath', req.query)
		try {
			const q: TermdbGetImageFromPathRequest = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const image = await getImage(ds, q.filePath)
			res.send({ image }) satisfies TermdbGetImageFromPathResponse
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function getImage(ds: any, filePath: string) {
	const file = path.join(serverconfig.tpmasterdir, filePath) //the file extension is assumed to be .jpg
	const ext = path.extname(file).substring(1)
	if (!fs.existsSync(file)) throw new Error(`File ${filePath} does not exist`)
	const data = await fs.promises.readFile(file)

	const image = {
		src: `data:image/${ext};base64,${Buffer.from(data).toString('base64')}`
	}
	return image
}
