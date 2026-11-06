/*
 visium.ts — sequence-based spatial transcriptomics (Visium), method=sequence of the w2 spatial viewer.
 Unlike method=image (wsitiles.ts: a tiled slide + per-cell polygons), a Visium sample is ONE
 high-resolution png plus ONE consolidated .h5ad (counts, spot positions, optional cell-type
 proportions; see the converter's header). The png is small, so it is served whole, not tiled.

 Two ways to address a sample (neither takes file paths in dataset mode):
 - Dataset: ds.queries.w2.sequenceFolder/<sample_id>/<imageName>/ holds the h5ad (matched by
   w2.spatialDataFileSuffix, default '.h5ad') and the tissue image (png/jpg/jpeg, w2.sequenceImageSuffix, default tissue_hires_image.png). Query: genome, dslabel,
   sample_id, wsimage=<imageName>/<anything>.
 - Direct (runpp ?method=sequence&image_file=&spatial_data=): tpmasterdir-relative paths, gated by
   serverconfig.features.wsi.allowDirectSlidePath like wsitiles' direct mode.

 Endpoints (visium/:action):
   image      -> image/png, the hires tissue image
   spots      -> { ids, x, y, radius, width, height, arrayRow, arrayCol, proportions } (in-tissue spots,
                 hires-image px, y down)
   genenames  -> { genes }
   genecounts -> { cells: {spotId: count}, max }  (?gene=)
*/
import type { RouteApi, RoutePayload } from '#types'
import { run_python } from '@sjcrh/proteinpaint-python'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { genomes } from '#src/initGenomesDs.js'

/** image formats a sequence-based sample's tissue image may have */
export const IMAGE_EXT = /\.(png|jpe?g)$/i

/** the tissue image among an image folder's files: the one ending with `suffix`
 (w2.sequenceImageSuffix, default Space Ranger's 'tissue_hires_image.png'); png/jpg/jpeg only */
export const findSequenceImage = (files: string[], suffix = 'tissue_hires_image.png') =>
	IMAGE_EXT.test(suffix) ? files.find(f => f.endsWith(suffix)) : undefined

const hasSequenceDs = g =>
	Object.values(g).some((x: any) => Object.values(x.datasets || {}).some((ds: any) => ds.queries?.w2?.sequenceFolder))

export const payload: RoutePayload = {
	get init() {
		return hasSequenceDs(genomes) || serverconfig.features?.wsi?.allowDirectSlidePath ? init : null
	},
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'visium/:action',
	methods: { get: payload, post: payload }
}

/** absolute path of tpmasterdir-relative `rel`, which must stay inside tpmasterdir */
function underMaster(rel: string): string {
	const base = path.resolve(serverconfig.tpmasterdir)
	const full = path.resolve(base, rel)
	if (!full.startsWith(base + path.sep)) throw new Error('path escapes tpmasterdir')
	return full
}

/** the sample's h5ad + hires png on disk */
async function resolveFiles(genomes: any, q: any): Promise<{ h5ad: string; png: string }> {
	if (q.image_file || q.spatial_data) {
		// direct mode
		if (!serverconfig.features?.wsi?.allowDirectSlidePath)
			throw new Error('direct path disabled (set features.wsi.allowDirectSlidePath)')
		const png = underMaster(String(q.image_file || ''))
		const h5ad = underMaster(String(q.spatial_data || ''))
		if (!IMAGE_EXT.test(png)) throw new Error('image_file must be a .png, .jpg or .jpeg')
		if (!h5ad.toLowerCase().endsWith('.h5ad')) throw new Error('spatial_data must be a .h5ad')
		return { h5ad, png }
	}
	const w2 = genomes[q.genome]?.datasets[q.dslabel]?.queries?.w2
	if (!w2?.sequenceFolder) throw new Error('ds.queries.w2.sequenceFolder not configured for this dataset')
	if (!q.sample_id || !q.wsimage) throw new Error('sample_id and wsimage required')
	// wsimage is <imageName>/<file>; only the image folder name is used
	const segs = path.normalize(String(q.wsimage)).split(path.sep)
	if (segs.length != 2 || segs.some(s => !s || s == '.' || s == '..'))
		throw new Error('wsimage must be <imageName>/<file>')
	const base = path.resolve(serverconfig.tpmasterdir, w2.sequenceFolder)
	const dir = path.resolve(base, String(q.sample_id), segs[0])
	if (!dir.startsWith(base + path.sep)) throw new Error('invalid sample_id')
	const files = await readdir(dir)
	const h5 = files.find(f => f.endsWith(w2.spatialDataFileSuffix || '.h5ad'))
	if (!h5) throw new Error('no spatial .h5ad in the image folder')
	const img = findSequenceImage(files, w2.sequenceImageSuffix)
	if (!img) throw new Error('no tissue image in the image folder')
	return { h5ad: path.join(dir, h5), png: path.join(dir, img) }
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const { h5ad, png } = await resolveFiles(genomes, q)
			const action = req.params.action
			if (action == 'image') {
				await stat(png) // 404-ish error before streaming
				res.set('Cache-Control', 'no-cache')
				res.sendFile(png)
				return
			}
			const job =
				action == 'spots'
					? { action: 'visium_spots', h5ad, png }
					: action == 'genenames'
					? { action: 'genenames', h5: h5ad }
					: action == 'genecounts'
					? { action: 'genecounts', h5: h5ad, gene: String(q.gene || '') }
					: null
			if (!job) {
				res.status(404).send('unknown action')
				return
			}
			res.status(200).json(JSON.parse(await run_python('wsi_tile.py', JSON.stringify(job))))
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({ status: 'error', error: e.message || e })
		}
	}
}
