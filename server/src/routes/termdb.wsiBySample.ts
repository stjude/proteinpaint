import type {
	RouteApi,
	RoutePayload,
	WsiBySampleRequest,
	WsiBySampleResponse,
	WsiImage,
	WsiSampleSummary
} from '#types'
import { readdir } from 'fs/promises'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

/*
 termdb/wsiBySample — whole-slide images for the w2 plot.

 Requires ds.queries.w2 = { folder }: that directory (relative to tpmasterdir)
 holds one subfolder per sample that has images, and the sample's .svs files
 live inside it (folder/<sample>/<fileName>). Everything is listed straight
 from disk — the wsimages sql table is not consulted, so a stale db record
 without files never shows up.

 With sample_id: that sample's images. Without: every sample that has an image
 folder, with its image count (drives the plot's sample table).
*/

export const payload: RoutePayload = {
	init,
	request: { typeId: 'WsiBySampleRequest' },
	response: { typeId: 'WsiBySampleResponse' }
}

export const api: RouteApi = {
	endpoint: 'termdb/wsiBySample',
	methods: {
		get: payload,
		post: payload
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: WsiBySampleRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('invalid dataset name')
			const folder = ds.queries?.w2?.folder
			if (!folder) throw new Error('ds.queries.w2 missing')
			const base = path.resolve(serverconfig.tpmasterdir, folder)

			if (!q.sample_id) {
				// no sample given: list samples supposed to have images (wsimages db
				// table) plus any sample folder on disk; the count is always what is
				// actually on disk, so a sample with a db record but no files shows 0
				const names = new Set<string>()
				const sql = `SELECT DISTINCT sampleidmap.name AS name
					 FROM wsimages INNER JOIN sampleidmap ON wsimages.sample = sampleidmap.id`
				for (const r of ds.cohort.db.connection.prepare(sql).all()) names.add(String((r as any).name))
				const entries = await readdir(base, { withFileTypes: true }).catch(() => [])
				for (const e of entries) if (e.isDirectory()) names.add(e.name)

				const samples: WsiSampleSummary[] = []
				for (const name of [...names].sort()) {
					const files = await readdir(path.join(base, name)).catch(() => [] as string[])
					samples.push({ sampleId: name, count: files.filter(f => /\.svs$/i.test(f)).length })
				}
				res.status(200).json({ samples } satisfies WsiBySampleResponse)
				return
			}

			// the sample's own subfolder; guard against path traversal via sample_id.
			// String(): numeric-looking sample names arrive as numbers from query parsing
			const sampleId = String(q.sample_id)
			const sampleDir = path.resolve(base, sampleId)
			if (!sampleDir.startsWith(base + path.sep)) throw new Error('invalid sample_id')

			// a sample without a folder simply has no images
			const fileNames = await readdir(sampleDir).catch(() => [] as string[])

			const images: WsiImage[] = fileNames
				.filter(f => /\.svs$/i.test(f))
				.map(fileName => ({
					fileName,
					// z=0 tile of the slide doubles as a thumbnail; client prepends host
					thumbnail: `wsitiles/tile/0/0/0?wsimage=${encodeURIComponent(fileName)}&dslabel=${q.dslabel}&genome=${
						q.genome
					}&sample_id=${encodeURIComponent(sampleId)}`
				}))

			res.status(200).json({ images } satisfies WsiBySampleResponse)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({ status: 'error', error: e.message || e })
		}
	}
}
