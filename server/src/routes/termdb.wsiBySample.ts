import type {
	RouteApi,
	RoutePayload,
	SpatialImage,
	WsiBySampleRequest,
	WsiBySampleResponse,
	WsiImage,
	WsiSampleSummary
} from '#types'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

/*
 termdb/wsiBySample — whole-slide images for the w2 plot.

 Requires ds.queries.w2 (paths relative to tpmasterdir):
   folder     spatial (Xenium) images: folder/<sample>/<imageName>/ holds one
              image per subfolder; the slide and its annotation files inside are
              located by the *FileSuffix fields (endsWith match)
   wsiFolder  plain slides: wsiFolder/<sample>/wsi/<imageName>/<slide file>

 Everything is listed straight from disk — the wsimages sql table only names
 the candidate samples, so a stale db record without files shows 0 images.

 With sample_id: that sample's images. Without: every sample from the wsimages
 table, with its image count (drives the plot's sample table).
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

/** plain slide formats: .svs plus pyramidal OME-TIFF (.ome.tif/.ome.tiff) */
const SLIDE_EXT = /\.(svs|ome\.tiff?)$/i

/** subdirectory names of a directory, [] if it doesn't exist */
async function subdirs(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
	return entries.filter(e => e.isDirectory()).map(e => e.name)
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: WsiBySampleRequest = req.query
			const g = genomes[q.genome]
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel]
			if (!ds) throw new Error('invalid dataset name')
			const w2 = ds.queries?.w2
			if (!w2?.folder) throw new Error('ds.queries.w2 missing')
			const spatialBase = path.resolve(serverconfig.tpmasterdir, w2.folder)
			const wsiBase = w2.wsiFolder ? path.resolve(serverconfig.tpmasterdir, w2.wsiFolder) : undefined

			/** the sample's images from both roots. fileName is relative to the
			 sample's folder in its root, matching the wsitiles wsimage= param */
			const getImages = async (sampleId: string): Promise<(WsiImage | SpatialImage)[]> => {
				const images: (WsiImage | SpatialImage)[] = []

				// v=<slide mtime>: tiles are served immutable, so a regenerated slide
				// must change the URL to bust the browser cache. z=0 tile doubles as
				// a thumbnail; client prepends host
				const thumbnail = (fileName: string, mtime: number) =>
					`wsitiles/tile/0/0/0?wsimage=${encodeURIComponent(fileName)}&dslabel=${q.dslabel}&genome=${
						q.genome
					}&sample_id=${encodeURIComponent(sampleId)}&v=${mtime}`

				// spatial: one image per subfolder of the sample's directory
				const spSampleDir = path.resolve(spatialBase, sampleId)
				if (!spSampleDir.startsWith(spatialBase + path.sep)) throw new Error('invalid sample_id')
				for (const img of await subdirs(spSampleDir)) {
					const files = await readdir(path.join(spSampleDir, img)).catch(() => [] as string[])
					const bySuffix = (suffix?: string) => (suffix ? files.find(f => f.endsWith(suffix)) : undefined)
					const tif = bySuffix(w2.tiffFileSuffix)
					if (!tif) continue // not an image folder
					// companion paths are relative to tpmasterdir, matching the
					// wsitiles boundaries/genecounts ?file= param
					const rel = (f?: string) => (f ? path.join(w2.folder, sampleId, img, f) : undefined)
					const fileName = path.join(img, tif)
					const v = (await stat(path.join(spSampleDir, img, tif))).mtimeMs
					images.push({
						type: 'spatial' as const,
						fileName,
						cellBoundaries: rel(bySuffix(w2.cellBoundariesFileSuffix)),
						nucleusBoundaries: rel(bySuffix(w2.nucleusBoundariesFileSuffix)),
						geneExpressionFile: rel(bySuffix(w2.geneExpressionFileSuffix)),
						// dataset-level viewer defaults; the client's burger menu overrides them
						geneExpression: w2.geneExpression,
						annotationLevel: w2.annotationLevel,
						thumbnail: thumbnail(fileName, v)
					})
				}

				// plain wsi: one image per subfolder of <sample>/wsi/
				if (wsiBase) {
					const wsiSampleDir = path.resolve(wsiBase, sampleId)
					if (!wsiSampleDir.startsWith(wsiBase + path.sep)) throw new Error('invalid sample_id')
					const wsiDir = path.join(wsiSampleDir, 'wsi')
					for (const img of await subdirs(wsiDir)) {
						const files = await readdir(path.join(wsiDir, img)).catch(() => [] as string[])
						const slide = files.find(f => SLIDE_EXT.test(f))
						if (!slide) continue
						const fileName = path.join('wsi', img, slide)
						const v = (await stat(path.join(wsiDir, img, slide))).mtimeMs
						images.push({ type: 'wsi' as const, fileName, thumbnail: thumbnail(fileName, v) })
					}
				}
				return images
			}

			if (!q.sample_id) {
				// no sample given: the wsimages db table says which samples are supposed
				// to have images; disk says how many actually exist
				const sql = `SELECT DISTINCT sampleidmap.name AS name
					 FROM wsimages INNER JOIN sampleidmap ON wsimages.sample = sampleidmap.id
					 ORDER BY sampleidmap.name`
				const rows = ds.cohort.db.connection.prepare(sql).all()

				const samples: WsiSampleSummary[] = []
				for (const r of rows) {
					const name = String((r as any).name)
					samples.push({ sampleId: name, count: (await getImages(name)).length })
				}
				res.status(200).json({ samples } satisfies WsiBySampleResponse)
				return
			}

			// String(): numeric-looking sample names arrive as numbers from query parsing
			const images = await getImages(String(q.sample_id))
			res.status(200).json({ images } satisfies WsiBySampleResponse)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({ status: 'error', error: e.message || e })
		}
	}
}
