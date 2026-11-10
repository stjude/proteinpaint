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
import { genomes } from '#src/initGenomesDs.js' // checked when augen sets up the route
import { findSequenceImage } from './visium.ts' // locates a sequence-based (Visium) sample's tissue image

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
	// a getter so that the loaded genomes are checked when augen sets up the route, not when this module
	// is evaluated; the route is only set up when at least one ds has ds.queries.w2
	get init() {
		return hasW2Ds(genomes) ? init : null
	},
	request: { typeId: 'WsiBySampleRequest' },
	response: { typeId: 'WsiBySampleResponse' }
}

export function hasW2Ds(genomes) {
	return Object.values(genomes).some((g: any) => Object.values(g.datasets || {}).some((ds: any) => ds.queries?.w2))
}

export const api: RouteApi = {
	endpoint: 'termdb/wsiBySample',
	methods: {
		get: payload,
		post: payload
	}
}

/** an input error, answered with 400 instead of 500 */
const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 })

/** plain slide formats: .svs plus pyramidal OME-TIFF (.ome.tif/.ome.tiff) */
const SLIDE_EXT = /\.(svs|ome\.tiff?)$/i

/** subdirectory names of a directory, [] if it doesn't exist */
async function subdirs(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true }).catch(() => []) // missing dir = no entries
	return entries.filter(e => e.isDirectory()).map(e => e.name) // directories only; loose files ignored
}

/** true when the sample has at least one plain slide on disk under
 ds.queries.w2.wsiFolder — the capability check behind "Whole Slide Images"
 actions outside this route (e.g. the omnisearch sample results). Matches the
 standalone plot's listing: spatial-only samples are false, and a dataset
 without a wsiFolder answers false with no disk access. Never throws. */
export async function sampleHasPlainSlides(ds: any, sampleId: string): Promise<boolean> {
	const wsiFolder = ds?.queries?.w2?.wsiFolder
	if (!wsiFolder) return false
	const wsiBase = path.resolve(serverconfig.tpmasterdir, wsiFolder)
	const sampleDir = path.resolve(wsiBase, String(sampleId)) // wsiFolder/<sample>/
	if (!sampleDir.startsWith(wsiBase + path.sep)) return false // traversal guard
	for (const img of await subdirs(sampleDir)) {
		const files = await readdir(path.join(sampleDir, img)).catch(() => [] as string[]) // image folder contents
		if (files.some(f => SLIDE_EXT.test(f))) return true // one slide is enough
	}
	return false
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
			if (!w2?.folder && !w2?.wsiFolder && !w2?.sequenceFolder)
				throw new Error('ds.queries.w2 missing folder/wsiFolder/sequenceFolder')
			// absolute paths of the configured image roots (undefined when not configured)
			const spatialBase = w2.folder ? path.resolve(serverconfig.tpmasterdir, w2.folder) : undefined
			const sequenceBase = w2.sequenceFolder ? path.resolve(serverconfig.tpmasterdir, w2.sequenceFolder) : undefined
			const wsiBase = w2.wsiFolder ? path.resolve(serverconfig.tpmasterdir, w2.wsiFolder) : undefined

			/** the sample's images, from both roots by default; kind restricts to
			 one root so the other tree is never touched (the sample listing only
			 needs plain slides). fileName is relative to the sample's folder in
			 its root, matching the wsitiles wsimage= param */
			const getImages = async (
				sampleId: string,
				kind?: 'spatial' | 'wsi',
				method?: 'image' | 'sequence'
			): Promise<(WsiImage | SpatialImage)[]> => {
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
				if (spatialBase && kind != 'wsi' && method != 'sequence') {
					const spSampleDir = path.resolve(spatialBase, sampleId) // folder/<sample>/
					if (!spSampleDir.startsWith(spatialBase + path.sep)) throw badRequest('invalid sample_id') // traversal guard
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
							method: 'image' as const,
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

				// sequence-based (Visium): one image per subfolder holding the hires png + h5ad
				if (sequenceBase && kind != 'wsi' && method != 'image') {
					const seqSampleDir = path.resolve(sequenceBase, sampleId) // sequenceFolder/<sample>/
					if (!seqSampleDir.startsWith(sequenceBase + path.sep)) throw badRequest('invalid sample_id') // traversal guard
					for (const img of await subdirs(seqSampleDir)) {
						const files = await readdir(path.join(seqSampleDir, img)).catch(() => [] as string[])
						const h5 = files.find(f => f.endsWith(w2.spatialDataFileSuffix || '.h5ad'))
						const png = findSequenceImage(files, w2.sequenceImageSuffix)
						if (!h5 || !png) continue // not a Visium image folder
						const v = (await stat(path.join(seqSampleDir, img, png))).mtimeMs // cache-busting version
						images.push({
							type: 'spatial' as const,
							method: 'sequence' as const,
							fileName: path.join(img, png), // the visium route's wsimage= value
							spatialData: path.join(w2.sequenceFolder, sampleId, img, h5),
							geneExpression: w2.geneExpression,
							cellTypes: w2.cellTypes,
							thumbnail: `visium/image?wsimage=${encodeURIComponent(path.join(img, png))}&dslabel=${q.dslabel}&genome=${
								q.genome
							}&sample_id=${encodeURIComponent(sampleId)}&v=${v}`
						})
					}
				}

				// plain wsi: one image per subfolder of the sample's directory
				if (wsiBase && kind != 'spatial') {
					const wsiSampleDir = path.resolve(wsiBase, sampleId) // wsiFolder/<sample>/
					if (!wsiSampleDir.startsWith(wsiBase + path.sep)) throw badRequest('invalid sample_id') // traversal guard
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

			// filters are validated for every request form, so a typo is a 400, never "no filter"
			if (q.imageType && q.imageType != 'spatial' && q.imageType != 'wsi') throw badRequest('invalid imageType')
			if (q.method && q.method != 'image' && q.method != 'sequence') throw badRequest('invalid method')

			if (!q.sample_id) {
				// no sample given: by default, samples for the standalone Whole
				// Slide Images plot — PLAIN slides on disk only (spatial images are
				// normally viewed through the single-cell app, which asks per
				// sample_id). imageType=spatial opts into listing SPATIAL samples
				// instead — the w2 viewer's similar-region search uses this to
				// offer the dataset's other spatial samples
				const spatial = q.imageType == 'spatial'
				const roots = spatial
					? [q.method != 'sequence' ? spatialBase : undefined, q.method != 'image' ? sequenceBase : undefined]
					: [wsiBase]
				const sampleIds = await Promise.all(roots.filter((base): base is string => !!base).map(subdirs))
				const ids = [...new Set(sampleIds.flat())] // each root's subfolders are sample IDs
				const samples: WsiSampleSummary[] = []
				for (const name of ids.sort()) {
					// count each sample's images by enumerating only the requested
					// root — the other tree is never touched here, so listing cost
					// and failures can't depend on unrelated data
					const count = (await getImages(name, spatial ? 'spatial' : 'wsi', q.method)).length
					if (count) samples.push({ sampleId: name, count }) // a folder without images isn't listed
				}
				res.status(200).json({ samples } satisfies WsiBySampleResponse)
				return
			}

			// optional root restriction (the standalone plot asks for 'wsi', the
			// sc app for 'spatial'); absent = both kinds
			// String(): numeric-looking sample names arrive as numbers from query parsing
			const images = await getImages(String(q.sample_id), q.imageType, q.method)
			res.status(200).json({ images } satisfies WsiBySampleResponse)
		} catch (e: any) {
			console.warn(e)
			// invalid input is the client's error; anything else is the server's
			res.status(e.status || 500).send({ status: 'error', error: e.message || e })
		}
	}
}
