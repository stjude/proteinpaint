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
 configured roots.

 With sample_id: that sample's images, both kinds (the single-cell app's
 spatial probe/viewer use this). Without: every sample with PLAIN slides on
 disk, with its plain-image count — drives the standalone plot's sample
 table, which excludes spatial-only samples.
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
							spatialData: rel(bySuffix(w2.spatialDataFileSuffix)),
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
				// no sample given: list samples for the standalone Whole Slide
				// Images plot — PLAIN slides on disk only (spatial images are
				// viewed through the single-cell app, which asks per sample_id)
				const ids = wsiBase ? await subdirs(wsiBase) : [] // each subfolder = one sample
				const samples: WsiSampleSummary[] = []
				for (const name of ids.sort()) {
					// count each sample's plain images by actually enumerating them on disk
					const count = (await getImages(name)).filter(i => i.type == 'wsi').length
					if (count) samples.push({ sampleId: name, count }) // a folder without slides isn't listed
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
