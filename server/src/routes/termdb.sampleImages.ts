import type { RoutePayload, Image, TermdbSampleImagesRequest, TermdbSampleImagesResponse, RouteApi } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
import { genomes } from '#src/initGenomesDs.js'

export const payload: RoutePayload = {
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated (this module is also imported by mds3.init.js, which is imported by initGenomesDs.js);
	// the route is only set up when at least one ds has ds.queries.images
	get init() {
		return hasImagesDs(genomes) ? init : null
	},
	request: { typeId: 'TermdbSampleImagesRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'TermdbSampleImagesResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/getSampleImages',
	methods: {
		get: payload,
		post: payload
	}
}

export function hasImagesDs(genomes) {
	return Object.values(genomes).some((g: any) => Object.values(g.datasets || {}).some((ds: any) => ds.queries?.images))
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
			const getSampleImages = ds.queries?.images?.getSampleImages
			if (!getSampleImages) throw 'images not supported on this dataset'
			const images = await getSampleImages({ sampleId })
			res.send({ images } satisfies TermdbSampleImagesResponse)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

export function validate_query_getSampleImages(ds: any) {
	const q = ds.queries.images
	if (!q) return
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
	const rows = ds.cohort.db.connection.prepare('SELECT * FROM images WHERE sample = ?').all(sampleId)
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
