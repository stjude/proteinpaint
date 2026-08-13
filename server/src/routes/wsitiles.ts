/*
 wsitiles.ts — WSI tiles/metadata without the tile server or redis. Only the
 ProteinPaint node server runs. Per request it calls run_python('wsi_tile.py'),
 which writes ONE JPEG to a temp path and prints that path back on stdout; node
 reads the file, sends it to the client, and deletes it.

 The OpenLayers `Zoomify` client works unchanged — only the tile URL and the
 metadata source move here from the old tileserver.ts / wsimages.ts.

 Two ways to point at a slide:
 - Dataset (production): serverconfig.features.tileserver.mount as the slide
   root + ds.queries.WSImages.{imageBySampleFolder,aiToolImageFolder} sub-path.
   Query: genome, dslabel, wsimage, sample_id | ai_project_id.
 - Direct path (e.g. runpp ?image_file=SVS/slide.svs): query `slide`, resolved relative
   to serverconfig.tpmasterdir (traversal outside it is rejected). Gated behind
   serverconfig.features.wsi.allowDirectSlidePath — a dev/testing switch.

 Endpoints:
   GET wsitiles/meta               -> { slide_dimensions, mpp, tileSize }
   GET wsitiles/tile/:z/:x/:y      -> image/jpeg
*/
import type { RouteApi, RoutePayload } from '#types'
import { run_python } from '@sjcrh/proteinpaint-python'
import { readFile, unlink, copyFile, mkdir, stat } from 'fs/promises'
import { createHash } from 'crypto'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'WSImagesRequest' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: `wsitiles/:action/:z?/:x?/:y?`,
	methods: { get: payload, post: payload }
}

const exists = (p: string) =>
	stat(p).then(
		() => true,
		() => false
	)

// Flat .jpg files under the CacheManager-registered 'wsitiles' subdir of
// serverconfig.cachedir, so the existing TTL sweep evicts them (it is
// non-recursive, hence a flat name rather than nested z/x/y dirs).
// potential pitfall: keyed by slide path only — replacing a slide file in place would
// serve stale tiles until the tiles age out; clear the subdir if that happens.
function tileCachePath(slide: string, plane: string, z: string, x: string, y: string): string {
	const key = createHash('sha1').update(slide).digest('hex')
	return path.join(serverconfig.cachedir, 'wsitiles', `${key}_${plane}_${z}_${x}_${y}.jpg`)
}

// Same path resolution the old wsimages.ts used, kept inside node.
function slidePath(genomes: any, q: any): string {
	// direct path (runpp ?SVS=...), relative to tpmasterdir, gated in serverconfig
	if (q.slide) {
		if (!serverconfig.features?.wsi?.allowDirectSlidePath)
			throw new Error('direct slide path disabled (set features.wsi.allowDirectSlidePath)')
		const base = path.resolve(serverconfig.tpmasterdir)
		const full = path.resolve(base, q.slide)
		if (full !== base && !full.startsWith(base + path.sep)) throw new Error('slide path escapes tpmasterdir')
		return full
	}
	const g = genomes[q.genome]
	if (!g) throw new Error('Invalid genome name')
	const ds = g.datasets[q.dslabel]
	if (!ds) throw new Error('Invalid dataset name')
	const wsimage = q.wsimage
	if (!wsimage) throw new Error('No wsimage param provided')

	// w2 plot: ds.queries.w2.folder (relative to tpmasterdir) holds one subfolder
	// per sample, containing that sample's slide files: folder/<sample>/<fileName>
	if (ds.queries?.w2?.folder) {
		const w2sample = q.sample_id ?? q.sampleId
		if (!w2sample) throw new Error('sample_id required with ds.queries.w2')
		const base = path.resolve(serverconfig.tpmasterdir, ds.queries.w2.folder)
		// String(): numeric-looking sample names arrive as numbers from query parsing
		const full = path.resolve(base, String(w2sample), wsimage)
		if (!full.startsWith(base + path.sep)) throw new Error('slide path escapes w2 folder')
		return full
	}

	const sampleId = q.sample_id ?? q.sampleId
	const aiProjectId = q.ai_project_id ?? q.aiProjectId
	if (!sampleId && !aiProjectId) throw new Error('sample_id/sampleId or ai_project_id/aiProjectId required')
	const mount = serverconfig.features?.tileserver?.mount
	if (!mount) throw new Error('No mount configured (serverconfig.features.tileserver.mount)')
	const w = ds.queries.WSImages
	const sub = sampleId
		? path.join(`${w.imageBySampleFolder}/${sampleId}`, wsimage)
		: path.join(`${w.aiToolImageFolder}/`, wsimage)
	const base = path.resolve(mount)
	const full = path.resolve(base, sub)
	if (full !== base && !full.startsWith(base + path.sep)) throw new Error('slide path escapes mount')
	return full
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query
			const slide = slidePath(genomes, q)

			if (req.params.action == 'boundaries') {
				// serve a boundary CSV (e.g. Xenium cell/nucleus_boundaries.csv);
				// the file path is always relative to serverconfig.tpmasterdir
				const file = String(q.file || '')
				if (!file.toLowerCase().endsWith('.csv')) {
					res.status(400).send({ status: 'error', error: 'boundaries file must be a .csv' })
					return
				}
				const base = path.resolve(serverconfig.tpmasterdir)
				const full = path.resolve(base, file)
				if (!full.startsWith(base + path.sep)) {
					res.status(400).send({ status: 'error', error: 'boundaries path escapes tpmasterdir' })
					return
				}
				const csv = await readFile(full, 'utf8')
				res.status(200).set('Content-Type', 'text/csv').set('Cache-Control', 'public, max-age=3600').send(csv)
				return
			}

			if (req.params.action == 'genecounts') {
				// per-cell counts of one gene from a 10x cell_feature_matrix HDF5
				// (?file= relative to tpmasterdir, ?gene= gene name); python answers
				// {cells:{cell_id:count},max} or {error} when the gene is absent
				const file = String(q.file || '')
				if (!file.toLowerCase().endsWith('.h5')) {
					res.status(400).send({ status: 'error', error: 'gene expression file must be a .h5' })
					return
				}
				const base = path.resolve(serverconfig.tpmasterdir)
				const full = path.resolve(base, file)
				if (!full.startsWith(base + path.sep)) {
					res.status(400).send({ status: 'error', error: 'gene expression path escapes tpmasterdir' })
					return
				}
				const out = await run_python(
					'wsi_tile.py',
					JSON.stringify({ action: 'genecounts', h5: full, gene: String(q.gene || '') })
				)
				res.status(200).json(JSON.parse(out))
				return
			}

			if (req.params.action == 'meta') {
				const out = await run_python('wsi_tile.py', JSON.stringify({ action: 'meta', slide }))
				res.status(200).json(JSON.parse(out))
				return
			}

			if (req.params.action == 'tile') {
				const zi = Number.parseInt(req.params.z, 10)
				const xi = Number.parseInt(req.params.x, 10)
				const yi = Number.parseInt(req.params.y, 10)
				if (![zi, xi, yi].every(n => Number.isFinite(n) && n >= 0)) {
					res.status(400).send({ status: 'error', error: 'invalid tile coordinates' })
					return
				}

				// z-plane of a 3D OME-TIFF stack; omitted = python's default (middle plane)
				const plane = Number.isInteger(Number(q.plane)) && Number(q.plane) >= 0 ? Number(q.plane) : undefined

				// Each (slide,plane,z,x,y) tile is generated by python once, then cached on
				// disk and served from there — panning/zoom-back never re-spawns python,
				// and the browser caches it too (immutable). This is what keeps a
				// zoom-in from flooding the server with slow per-tile spawns.
				const cacheFile = tileCachePath(
					slide,
					plane === undefined ? '' : String(plane),
					String(zi),
					String(xi),
					String(yi)
				)
				let jpg: Buffer
				if (await exists(cacheFile)) {
					jpg = await readFile(cacheFile)
				} else {
					const tmp = (
						await run_python('wsi_tile.py', JSON.stringify({ action: 'tile', slide, z: zi, x: xi, y: yi, plane }))
					).trim()
					await mkdir(path.dirname(cacheFile), { recursive: true })
					await copyFile(tmp, cacheFile).catch(() => {}) // best-effort; races are harmless
					jpg = await readFile(tmp)
					await unlink(tmp).catch(() => {})
				}
				res
					.status(200)
					.set('Content-Type', 'image/jpeg')
					.set('Cache-Control', 'public, max-age=31536000, immutable')
					.send(jpg)
				return
			}

			res.status(404).send('unknown action')
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({ status: 'error', error: e.message || e })
		}
	}
}
