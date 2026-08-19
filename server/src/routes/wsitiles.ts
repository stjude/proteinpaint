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
import type { RouteApi, RoutePayload } from '#types' // route registration types
import { run_python } from '@sjcrh/proteinpaint-python' // spawns wsi_tile.py per job
import { readFile, unlink, copyFile, mkdir, stat } from 'fs/promises' // async fs for cache/tile IO
import { existsSync, statSync } from 'fs' // sync checks inside slidePath()

/** slide formats accepted from the w2 wsiFolder root (matches the
 wsiBySample listing) plus OME-TIFF, the spatial fallback when no
 tiffFileSuffix is configured */
const W2_SLIDE_EXT = /\.(svs|ome\.tiff?)$/i
import { createHash } from 'crypto' // sha1 for cache file names
import path from 'path' // all slide/cache path resolution
import serverconfig from '#src/serverconfig.js' // tpmasterdir, cachedir, feature gates

// register this module as a route; request/response shapes are loose (any)
export const payload: RoutePayload = {
	init,
	request: { typeId: 'WSImagesRequest' },
	response: { typeId: 'any' }
}

// one endpoint, `action` selects meta/tile/boundaries/genecounts; z/x/y only for tile
export const api: RouteApi = {
	endpoint: `wsitiles/:action/:z?/:x?/:y?`,
	methods: { get: payload, post: payload }
}

// promise-flavored existence check (stat resolves = exists)
const exists = (p: string) =>
	stat(p).then(
		() => true,
		() => false
	)

// Flat .jpg files under the CacheManager-registered 'wsitiles' subdir of
// serverconfig.cachedir, so the existing TTL sweep evicts them (it is
// non-recursive, hence a flat name rather than nested z/x/y dirs).
// Keyed by slide path + mtime, so regenerating a slide file in place starts a
// fresh tile set instead of serving stale tiles of the old file.
function tileCachePath(slide: string, mtime: number, plane: string, z: string, x: string, y: string): string {
	const key = createHash('sha1').update(`${slide}:${mtime}`).digest('hex') // stable id per slide version
	return path.join(serverconfig.cachedir, 'wsitiles', `${key}_${plane}_${z}_${x}_${y}.jpg`) // one file per tile
}

// Same path resolution the old wsimages.ts used, kept inside node.
function slidePath(genomes: any, q: any): string {
	// direct path (runpp ?SVS=...), relative to tpmasterdir, gated in serverconfig
	if (q.slide) {
		// dev/testing switch: arbitrary tpmasterdir-relative slide paths
		if (!serverconfig.features?.wsi?.allowDirectSlidePath)
			throw new Error('direct slide path disabled (set features.wsi.allowDirectSlidePath)')
		const base = path.resolve(serverconfig.tpmasterdir) // the only allowed root
		const full = path.resolve(base, q.slide) // resolve, collapsing any ../
		// traversal guard: the resolved path must stay inside tpmasterdir
		if (full !== base && !full.startsWith(base + path.sep)) throw new Error('slide path escapes tpmasterdir')
		return full
	}
	const g = genomes[q.genome] // look up the genome object
	if (!g) throw new Error('Invalid genome name')
	const ds = g.datasets[q.dslabel] // then the dataset within it
	if (!ds) throw new Error('Invalid dataset name')
	const wsimage = q.wsimage // slide path relative to the sample folder
	if (!wsimage) throw new Error('No wsimage param provided')

	// w2 plot: wsimage is relative to the sample's subfolder in either root —
	// folder (spatial) or wsiFolder (plain), both laid out as
	// <sample>/<imageName>/<file>. imageType ('spatial'|'wsi', carried from the
	// image's type in the wsiBySample response) pins the lookup to that root, so
	// same-named paths in both roots can't select the wrong slide; without it
	// (older links) the first root holding the file wins
	if (ds.queries?.w2?.folder || ds.queries?.w2?.wsiFolder) {
		const w2 = ds.queries.w2 // the w2 config: roots + file suffixes
		const w2sample = q.sample_id ?? q.sampleId // sample folder name
		if (!w2sample) throw new Error('sample_id required with ds.queries.w2')
		// require the documented <imageName>/<slide file> shape: exactly two plain
		// segments. Otherwise wsimage='.' would resolve to the sample directory
		// itself, pass the existence check, and widen the companion-file scope
		// (dirname of the slide) to a whole image root
		const segs = path.normalize(String(wsimage)).split(path.sep) // e.g. ['image1','x.ome.tif']
		if (segs.length != 2 || segs.some(s => !s || s == '.' || s == '..'))
			throw new Error('wsimage must be <imageName>/<slide file>')
		// the file must be the kind of slide its root serves
		const isSpatialSlide = (f: string) => (w2.tiffFileSuffix ? f.endsWith(w2.tiffFileSuffix) : W2_SLIDE_EXT.test(f))
		const isWsiSlide = (f: string) => W2_SLIDE_EXT.test(f)
		// candidate roots to search, each paired with its slide-kind check;
		// imageType pins to one root, absent imageType searches both in order
		const roots: Array<[string | undefined, (f: string) => boolean]> =
			q.imageType == 'spatial'
				? [[w2.folder, isSpatialSlide]]
				: q.imageType == 'wsi'
				? [[w2.wsiFolder, isWsiSlide]]
				: [
						[w2.folder, isSpatialSlide],
						[w2.wsiFolder, isWsiSlide]
				  ]
		let full: string | undefined // last candidate path, for the error case
		for (const [root, isSlide] of roots) {
			if (!root || !isSlide(segs[1])) continue // root not configured / wrong slide kind
			const base = path.resolve(serverconfig.tpmasterdir, root) // absolute root dir
			// String(): numeric-looking sample names arrive as numbers from query parsing
			const p = path.resolve(base, String(w2sample), segs[0], segs[1]) // root/<sample>/<image>/<file>
			if (!p.startsWith(base + path.sep)) throw new Error('slide path escapes w2 folder') // traversal guard
			full = p // remember the candidate even if it does not exist
			if (existsSync(p) && statSync(p).isFile()) return p // must be a real regular file
		}
		if (!full) throw new Error('wsimage is not a slide file of the requested image type')
		return full // let downstream produce the not-found error for the last candidate
	}

	// legacy WSImages datasets: slides live under a tileserver mount, not tpmasterdir
	const sampleId = q.sample_id ?? q.sampleId // per-sample slide folder
	const aiProjectId = q.ai_project_id ?? q.aiProjectId // or an AI-tool project folder
	if (!sampleId && !aiProjectId) throw new Error('sample_id/sampleId or ai_project_id/aiProjectId required')
	const mount = serverconfig.features?.tileserver?.mount // the slide root for this mode
	if (!mount) throw new Error('No mount configured (serverconfig.features.tileserver.mount)')
	const w = ds.queries.WSImages // per-dataset subfolders under the mount
	const sub = sampleId
		? path.join(`${w.imageBySampleFolder}/${sampleId}`, wsimage) // sample-addressed slide
		: path.join(`${w.aiToolImageFolder}/`, wsimage) // project-addressed slide
	const base = path.resolve(mount) // absolute mount root
	const full = path.resolve(base, sub) // resolve, collapsing any ../
	// traversal guard: resolved path must stay inside the mount
	if (full !== base && !full.startsWith(base + path.sep)) throw new Error('slide path escapes mount')
	return full
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const q = req.query // slide-addressing + per-action params
			const slide = slidePath(genomes, q) // resolve + validate the slide first, whatever the action

			// companion files (?file=, relative to tpmasterdir) must stay inside the
			// selected slide's own image folder in dataset mode — companions are
			// co-located with their slide by layout, and this stops a valid slide
			// query from reading arbitrary csv/h5 files of other datasets under
			// tpmasterdir. The gated direct-path mode keeps the tpmasterdir scope,
			// since its URL contract takes arbitrary tpmasterdir-relative paths.
			const companionBase = q.slide ? path.resolve(serverconfig.tpmasterdir) : path.dirname(slide)

			if (req.params.action == 'boundaries') {
				// serve a boundary CSV (e.g. Xenium cell/nucleus_boundaries.csv)
				const file = String(q.file || '') // tpmasterdir-relative companion path
				if (!file.toLowerCase().endsWith('.csv')) {
					// only csv files may be served by this action
					res.status(400).send({ status: 'error', error: 'boundaries file must be a .csv' })
					return
				}
				const full = path.resolve(serverconfig.tpmasterdir, file) // absolute path of the request
				if (!full.startsWith(companionBase + path.sep)) {
					// outside the slide's image folder (or tpmasterdir in direct mode)
					res.status(400).send({ status: 'error', error: 'boundaries path escapes the slide folder' })
					return
				}
				let csv: string
				try {
					csv = await readFile(full, 'utf8') // whole csv into memory (they are small)
				} catch (e: any) {
					// distinguish a missing file (404) from a read failure (500)
					res.status(e?.code === 'ENOENT' ? 404 : 500).send({
						status: 'error',
						error: e?.code === 'ENOENT' ? 'boundaries file not found' : e.message || String(e)
					})
					return
				}
				// cacheable for an hour; boundary files change with the slide, rarely
				res.status(200).set('Content-Type', 'text/csv').set('Cache-Control', 'public, max-age=3600').send(csv)
				return
			}

			if (req.params.action == 'genecounts' || req.params.action == 'genenames') {
				// both actions read the 10x cell_feature_matrix HDF5 (?file= relative
				// to tpmasterdir). genecounts (+ ?gene=) answers per-cell counts of
				// one gene: {cells:{cell_id:count},max} or {error} when the gene is
				// absent; genenames answers {genes:[...]} — every gene in the file,
				// letting the client discover/validate genes instead of trusting config
				const file = String(q.file || '') // tpmasterdir-relative h5 path
				if (!file.toLowerCase().endsWith('.h5')) {
					// only hdf5 files may be queried by these actions
					res.status(400).send({ status: 'error', error: 'gene expression file must be a .h5' })
					return
				}
				const full = path.resolve(serverconfig.tpmasterdir, file) // absolute path of the request
				if (!full.startsWith(companionBase + path.sep)) {
					// same slide-folder scoping as the boundaries action
					res.status(400).send({ status: 'error', error: 'gene expression path escapes the slide folder' })
					return
				}
				// hand the h5 (+ gene for genecounts) to python; its stdout is the JSON answer
				const job =
					req.params.action == 'genecounts'
						? { action: 'genecounts', h5: full, gene: String(q.gene || '') }
						: { action: 'genenames', h5: full }
				const out = await run_python('wsi_tile.py', JSON.stringify(job))
				res.status(200).json(JSON.parse(out)) // relay python's JSON verbatim
				return
			}

			if (req.params.action == 'meta') {
				// slide geometry (dimensions/mpp/levels/planes) straight from python
				const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'meta', slide })))
				// version: the client puts it in tile URLs, so a regenerated slide
				// also busts the browser's immutable tile cache
				out.version = (await stat(slide)).mtimeMs
				res.status(200).json(out)
				return
			}

			if (req.params.action == 'tile') {
				// Zoomify tile address from the URL path segments
				const zi = Number.parseInt(req.params.z, 10)
				const xi = Number.parseInt(req.params.x, 10)
				const yi = Number.parseInt(req.params.y, 10)
				if (![zi, xi, yi].every(n => Number.isFinite(n) && n >= 0)) {
					// non-numeric or negative coordinates never map to a tile
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
					(await stat(slide)).mtimeMs, // current slide version keys the cache
					plane === undefined ? '' : String(plane),
					String(zi),
					String(xi),
					String(yi)
				)
				let jpg: Buffer // the tile bytes to send
				if (await exists(cacheFile)) {
					jpg = await readFile(cacheFile) // cache hit: no python involved
				} else {
					// cache miss: python renders the tile and prints its temp jpg path
					const tmp = (
						await run_python('wsi_tile.py', JSON.stringify({ action: 'tile', slide, z: zi, x: xi, y: yi, plane }))
					).trim()
					await mkdir(path.dirname(cacheFile), { recursive: true }) // ensure the cache dir exists
					await copyFile(tmp, cacheFile).catch(() => {}) // best-effort; races are harmless
					jpg = await readFile(tmp) // serve from the temp file this time
					await unlink(tmp).catch(() => {}) // python's temp file is no longer needed
				}
				res
					.status(200)
					.set('Content-Type', 'image/jpeg')
					// immutable: the URL carries v=<mtime>, so the bytes never change for a URL
					.set('Cache-Control', 'public, max-age=31536000, immutable')
					.send(jpg)
				return
			}

			res.status(404).send('unknown action') // no matching :action
		} catch (e: any) {
			console.warn(e) // keep the server log informative
			res.status(500).send({ status: 'error', error: e.message || e }) // one error shape for the client
		}
	}
}
