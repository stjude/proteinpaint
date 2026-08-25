import type {
	RouteApi,
	RoutePayload,
	SpatialImage,
	WsiBySampleRequest,
	WsiBySampleResponse,
	WsiImage,
	WsiSampleSummary
} from '#types'
import { readdir, stat } from 'fs/promises' // directory listing + slide mtime (cache version)
import path from 'path' // root/sample/image path assembly
import serverconfig from '#src/serverconfig.js' // tpmasterdir, the root of all data paths

/*
 termdb/wsiBySample — whole-slide images for the w2 plot.

 Requires ds.queries.w2 (paths relative to tpmasterdir):
   folder     spatial (Xenium) images: folder/<sample>/<imageName>/ holds one
              image per subfolder; the slide and its annotation files inside are
              located by the *FileSuffix fields (endsWith match)
   wsiFolder  plain slides: wsiFolder/<sample>/<imageName>/<slide file>

 Everything is listed straight from disk: samples are the subfolders of the
 configured roots. The legacy wsimages sql table (when present) is unioned in,
 so a stale db record without files shows 0 images.

 With sample_id: that sample's images. Without: every sample discovered on
 disk or named in the db, with its image count (drives the plot's sample table).
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
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => []) // missing dir = no entries
	return entries.filter(e => e.isDirectory()).map(e => e.name) // directories only; loose files ignored
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q: WsiBySampleRequest = req.query // genome/dslabel and optional sample_id
			const g = genomes[q.genome] // look up the genome object
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets[q.dslabel] // then the dataset within it
			if (!ds) throw new Error('invalid dataset name')
			// a dataset may have spatial images (folder), plain slides (wsiFolder), or both
			const w2 = ds.queries?.w2
			if (!w2?.folder && !w2?.wsiFolder) throw new Error('ds.queries.w2 missing folder/wsiFolder')
			// absolute paths of the configured image roots (undefined when not configured)
			const spatialBase = w2.folder ? path.resolve(serverconfig.tpmasterdir, w2.folder) : undefined
			const wsiBase = w2.wsiFolder ? path.resolve(serverconfig.tpmasterdir, w2.wsiFolder) : undefined

			/** the sample's images from both roots. fileName is relative to the
			 sample's folder in its root, matching the wsitiles wsimage= param */
			const getImages = async (sampleId: string): Promise<(WsiImage | SpatialImage)[]> => {
				const images: (WsiImage | SpatialImage)[] = []

				// v=<slide mtime>: tiles are served immutable, so a regenerated slide
				// must change the URL to bust the browser cache. imageType pins slide
				// resolution to the image's root, in case both roots hold the same
				// <sample>/<imageName>/<file> path. z=0 tile doubles as a thumbnail;
				// client prepends host
				const thumbnail = (fileName: string, mtime: number, imageType: 'spatial' | 'wsi') =>
					`wsitiles/tile/0/0/0?wsimage=${encodeURIComponent(fileName)}&dslabel=${q.dslabel}&genome=${
						q.genome
					}&sample_id=${encodeURIComponent(sampleId)}&imageType=${imageType}&v=${mtime}`

				// spatial: one image per subfolder of the sample's directory
				if (spatialBase) {
					const spSampleDir = path.resolve(spatialBase, sampleId) // folder/<sample>/
					if (!spSampleDir.startsWith(spatialBase + path.sep)) throw new Error('invalid sample_id') // traversal guard
					for (const img of await subdirs(spSampleDir)) {
						// files inside one image folder (slide + its annotation companions)
						const files = await readdir(path.join(spSampleDir, img)).catch(() => [] as string[])
						// locate a file by its configured suffix (endsWith match)
						const bySuffix = (suffix?: string) => (suffix ? files.find(f => f.endsWith(suffix)) : undefined)
						const tif = bySuffix(w2.tiffFileSuffix) // the slide itself
						if (!tif) continue // not an image folder
						// companion paths are relative to tpmasterdir, matching the
						// wsitiles boundaries/genecounts ?file= param
						const rel = (f?: string) => (f ? path.join(w2.folder!, sampleId, img, f) : undefined)
						const fileName = path.join(img, tif) // <imageName>/<tif>, the wsitiles wsimage= value
						const v = (await stat(path.join(spSampleDir, img, tif))).mtimeMs // slide version for cache busting
						images.push({
							type: 'spatial' as const,
							fileName,
							cellBoundaries: rel(bySuffix(w2.cellBoundariesFileSuffix)),
							nucleusBoundaries: rel(bySuffix(w2.nucleusBoundariesFileSuffix)),
							geneExpressionFile: rel(bySuffix(w2.geneExpressionFileSuffix)),
							// dataset-level viewer defaults; the client's burger menu overrides them
							geneExpression: w2.geneExpression,
							annotationLevel: w2.annotationLevel,
							cellTypes: w2.cellTypes,
							thumbnail: thumbnail(fileName, v, 'spatial')
						})
					}
				}

				// plain wsi: one image per subfolder of the sample's directory
				if (wsiBase) {
					const wsiSampleDir = path.resolve(wsiBase, sampleId) // wsiFolder/<sample>/
					if (!wsiSampleDir.startsWith(wsiBase + path.sep)) throw new Error('invalid sample_id') // traversal guard
					for (const img of await subdirs(wsiSampleDir)) {
						const files = await readdir(path.join(wsiSampleDir, img)).catch(() => [] as string[]) // image folder contents
						const slide = files.find(f => SLIDE_EXT.test(f)) // first file with a slide extension
						if (!slide) continue // no slide = not an image folder
						const fileName = path.join(img, slide) // <imageName>/<slide>, the wsitiles wsimage= value
						const v = (await stat(path.join(wsiSampleDir, img, slide))).mtimeMs // slide version for cache busting
						images.push({ type: 'wsi' as const, fileName, thumbnail: thumbnail(fileName, v, 'wsi') })
					}
				}
				return images
			}

			if (!q.sample_id) {
				// no sample given: sample ids are the subfolders of the configured
				// roots on disk, unioned with the legacy wsimages db table (if any)
				// so a db-listed sample whose files are gone still shows with 0
				const ids = new Set<string>() // sample names, deduped across both roots + db
				for (const base of [spatialBase, wsiBase]) {
					if (base) for (const name of await subdirs(base)) ids.add(name) // each subfolder = one sample
				}
				try {
					// legacy db rows: samples that are supposed to have images
					const sql = `SELECT DISTINCT sampleidmap.name AS name
						 FROM wsimages INNER JOIN sampleidmap ON wsimages.sample = sampleidmap.id`
					for (const r of ds.cohort.db.connection.prepare(sql).all()) ids.add(String((r as any).name))
				} catch (_) {
					// dataset without a wsimages table: disk-only listing
				}

				const samples: WsiSampleSummary[] = []
				for (const name of [...ids].sort()) {
					// count each sample's images by actually enumerating them on disk
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
