/*
 wsitiles.ts — WSI tiles/metadata without the tile server or redis. Only the
 ProteinPaint node server runs. Per request it calls run_python('wsi_tile.py'),
 which writes ONE JPEG to a temp path and prints that path back on stdout; node
 reads the file, sends it to the client, and deletes it.

 The OpenLayers `Zoomify` client works unchanged — only the tile URL and the
 metadata source live here (the tiatoolbox tileserver/wsimages stack is gone).

 Two ways to point at a slide:
 - Dataset (production): ds.queries.w2 roots (folder/wsiFolder, relative to
   tpmasterdir). Query: genome, dslabel, wsimage, sample_id, imageType.
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
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

// one endpoint, `action` selects meta/tile/boundaries/annotations/genecounts/
// genenames; z/x/y only for tile
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

	throw new Error('ds.queries.w2 not configured for this dataset')
}

// distinct cell_type answers cached per h5ad, valid while its mtime is
// unchanged — avoids re-spawning python on every meta request
const cellTypesCache = new Map<string, { mtime: number; types?: string[] }>()

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

			if (req.params.action == 'boundaries' || req.params.action == 'annotations') {
				// both read the image's consolidated spatial .h5ad (?file=, relative
				// to tpmasterdir). boundaries regenerates a polygon CSV (?kind=
				// cell | nucleus; safe as CSV — ids and numbers only); annotations
				// answers {cells:{cell_id:type}} as JSON, since cell types are free
				// text that CSV comma-splitting would corrupt
				const file = String(q.file || '') // tpmasterdir-relative h5ad path
				if (!file.toLowerCase().endsWith('.h5ad')) {
					// only consolidated h5ad stores may be queried by these actions
					res.status(400).send({ status: 'error', error: `${req.params.action} file must be a .h5ad` })
					return
				}
				const full = path.resolve(serverconfig.tpmasterdir, file) // absolute path of the request
				if (!full.startsWith(companionBase + path.sep)) {
					// outside the slide's image folder (or tpmasterdir in direct mode)
					res.status(400).send({ status: 'error', error: `${req.params.action} path escapes the slide folder` })
					return
				}
				try {
					if (req.params.action == 'annotations') {
						// python's stdout is the JSON answer; relay verbatim
						const out = await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad: full }))
						res.status(200).set('Cache-Control', 'public, max-age=3600').json(JSON.parse(out))
						return
					}
					// python regenerates the polygon CSV from the h5ad into a temp
					// file (same print-a-path contract as tile jobs)
					const kind = q.kind == 'nucleus' ? 'nucleus' : 'cell' // which polygon set
					const tmp = (await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_csv', h5ad: full, kind }))).trim()
					let csv: string
					try {
						csv = await readFile(tmp, 'utf8') // the regenerated csv
					} finally {
						await unlink(tmp).catch(() => {}) // always remove the generated temp file
					}
					// cacheable for an hour; the h5ad changes with the slide, rarely
					res.status(200).set('Content-Type', 'text/csv').set('Cache-Control', 'public, max-age=3600').send(csv)
				} catch (e: any) {
					// distinguish a missing file (404) from a read failure (500)
					res.status(e?.code === 'ENOENT' ? 404 : 500).send({
						status: 'error',
						error: e?.code === 'ENOENT' ? `${req.params.action} file not found` : e.message || String(e)
					})
				}
				return
			}

			if (req.params.action == 'genecounts' || req.params.action == 'genenames') {
				// both actions read the consolidated spatial .h5ad (?file= relative
				// to tpmasterdir). genecounts (+ ?gene=) answers per-cell counts of
				// one gene: {cells:{cell_id:count},max} or {error} when the gene is
				// absent; genenames answers {genes:[...]} — every gene in the file,
				// letting the client discover/validate genes instead of trusting config
				const file = String(q.file || '') // tpmasterdir-relative h5ad path
				if (!file.toLowerCase().endsWith('.h5ad')) {
					// only consolidated h5ad stores may be queried by these actions
					res.status(400).send({ status: 'error', error: 'gene expression file must be a .h5ad' })
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
				// ?cellAnnotations=<h5ad>: also report the distinct cell_type values
				// of that consolidated store (same scoping as the boundaries action),
				// so the client can build a type picker up front. Unreadable file /
				// no types = no cellTypes field, meta still works.
				if (q.cellAnnotations) {
					try {
						const src = String(q.cellAnnotations) // the consolidated h5ad
						const full = path.resolve(serverconfig.tpmasterdir, src)
						if (!src.toLowerCase().endsWith('.h5ad')) throw new Error('not a .h5ad')
						if (!full.startsWith(companionBase + path.sep)) throw new Error('path escapes the slide folder')
						// scan the file only when its mtime changed; else answer from cache
						const mtime = (await stat(full)).mtimeMs
						let hit = cellTypesCache.get(full)
						if (!hit || hit.mtime !== mtime) {
							// python reads the distinct types out of the h5ad
							const types = JSON.parse(
								await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_celltypes', h5ad: full }))
							).cellTypes
							hit = { mtime, types }
							cellTypesCache.set(full, hit) // one entry per annotations source
						}
						if (hit.types) out.cellTypes = hit.types
					} catch (e: any) {
						console.warn(`meta cellTypes: ${e.message || e}`) // non-fatal, geometry is the answer
					}
				}
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
