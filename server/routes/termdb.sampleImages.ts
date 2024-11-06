import type { Image, TermdbSampleImagesRequest, TermdbSampleImagesResponse, RouteApi } from '#types'
import { termdbSampleImagesPayload } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'termdb/getSampleImages',
	methods: {
		get: {
			...termdbSampleImagesPayload,
			init
		},
		post: {
			...termdbSampleImagesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: TermdbSampleImagesRequest = req.query
			const sampleId = q.sampleId
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const images = await ds.queries.images.getSampleImages({ sampleId })
			res.send({ images } satisfies TermdbSampleImagesResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

export function validate_query_getSampleImages(ds: any) {
	const q = ds.queries.images
	if (!q) return
	//if (q.src == 'gdcapi') gdcValidateQuery(ds, genome, q.sampleId)
	//reading images locally is the only option supported so far
	nativeValidateQuery(ds)
}

function nativeValidateQuery(ds: any) {
	ds.queries.images.getSampleImages = async (q: TermdbSampleImagesRequest) => {
		const folder = ds.queries.images.folder //query to search top terms by type
		const images = await getSampleImages(ds, folder, q.sampleId)
		return images
	}
}

async function getSampleImages(ds: any, folder: string, sampleId: number) {
	const sql = `SELECT * FROM images WHERE sample = ${sampleId}`
	const rows = ds.cohort.db.connection.prepare(sql).all()
	const images: Image[] = []
	for (const row of rows) {
		const file = path.join(serverconfig.tpmasterdir, folder, row.fileName) //the file extension is assumed to be .jpg
		if (!fs.existsSync(file)) throw new Error(`File ${row.fileName} does not exist`)
		const data = await fs.promises.readFile(file)

		images.push({
			src: 'data:image/jpeg;base64,' + Buffer.from(data).toString('base64')
		})
	}
	return images
}
