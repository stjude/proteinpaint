/**
Unit test for 'python/src/wsi_tile.py', driven through the same node->python
bridge the server uses (run_python pipes one JSON job on stdin, reads stdout).

Covers the offline tier-math self-check ({"action":"selftest"}, the former
--test-only check) and every h5ad action against the committed TermdbTest
fixture (image1_spatial.h5ad: 791 cells, 5 cell types, genes
ACE2/ACTA2/PTPRC, 31 QC-filtered cells with no type).

Run as follows (from 'proteinpaint/'):
    node python/test/wsi_tile.unit.spec.ts
The default python3 must have the packages of python/requirements.txt (as in
CI); locally, point at a suitable interpreter with
    PP_PYTHON=/path/to/python node python/test/wsi_tile.unit.spec.ts
*/

import fs from 'fs'
import path from 'path'
import tape from 'tape'
import { run_python, setPythonBinPath } from '@sjcrh/proteinpaint-python'

// local convenience: use the same interpreter the dev server is configured with
if (process.env.PP_PYTHON) setPythonBinPath(process.env.PP_PYTHON)

// the committed spatial fixture; the spec runs from the repo root
const h5ad = path.resolve('server/test/tp/files/hg38/TermdbTest/spatial/TCGA-22-1017/image1/image1_spatial.h5ad')

tape('selftest: Zoomify tier math', async t => {
	const out = await run_python('wsi_tile.py', JSON.stringify({ action: 'selftest' }))
	t.ok(String(out).includes('self-check OK'), 'tier-math self-check passes')
	t.end()
})

tape('genenames lists the fixture genes in file order', async t => {
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'genenames', h5: h5ad })))
	t.deepEqual(out.genes, ['ACE2', 'ACTA2', 'PTPRC'], 'the three fixture genes')
	t.end()
})

tape('genecounts answers per-cell counts of one gene', async t => {
	const out = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ action: 'genecounts', h5: h5ad, gene: 'PTPRC' }))
	)
	t.equal(Object.keys(out.cells).length, 594, '594 fixture cells express PTPRC')
	t.equal(out.max, 9, 'their highest count is 9')
	t.ok(
		Object.values(out.cells).every(n => Number.isInteger(n) && (n as number) > 0),
		'every reported count is a positive integer (zero-count cells omitted)'
	)
	t.end()
})

tape('genecounts reports an unknown gene as a clean error', async t => {
	const out = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ action: 'genecounts', h5: h5ad, gene: 'NOPE' }))
	)
	t.ok(String(out.error).includes("gene 'NOPE' not found"), 'error names the missing gene')
	t.end()
})

tape('h5ad_celltypes lists the distinct types, sorted', async t => {
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_celltypes', h5ad })))
	t.deepEqual(out.cellTypes, ['B cells', 'Fibroblasts', 'Macrophages', 'T cells', 'Tumor'], 'the five fixture types')
	t.end()
})

tape('h5ad_annotations maps annotated cells to their types', async t => {
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const types = Object.values(out.cells)
	t.equal(types.length, 760, '760 annotated cells (791 minus the 31 QC-filtered)')
	t.ok(types.every(Boolean), 'no empty types (QC-filtered cells are omitted)')
	t.end()
})

tape('h5ad_csv regenerates the boundary CSVs', async t => {
	for (const [kind, rows] of [
		['cell', 10283],
		['nucleus', 10281]
	] as const) {
		const tmp = String(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_csv', h5ad, kind }))).trim()
		const lines = fs.readFileSync(tmp, 'utf8').trim().split('\n')
		fs.unlinkSync(tmp) // the caller (node route) deletes the temp file; so does the test
		t.equal(lines[0], '"cell_id","vertex_x","vertex_y"', `${kind}: expected header`)
		t.equal(lines.length - 1, rows, `${kind}: ${rows} vertex rows`)
	}
	t.end()
})

tape('h5ad_csv rejects an unknown polygon kind without leaking a temp file', async t => {
	try {
		await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_csv', h5ad, kind: 'bogus' }))
		t.fail('expected the unknown kind to be rejected')
	} catch (err) {
		t.ok(String(err).includes('bogus_boundaries'), 'error names the missing polygon store')
	}
	t.end()
})

tape('nhood computes squidpy-style neighborhood enrichment over a selection', async t => {
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const ids = Object.keys(ann.cells) // the 760 annotated fixture cells
	const job = { action: 'nhood', h5ad, ids: [...ids, 'not-a-cell'], k: 6, perms: 50, seed: 1 }
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify(job)))
	t.deepEqual(out.types, ['B cells', 'Fibroblasts', 'Macrophages', 'T cells', 'Tumor'], 'types sorted, matrix order')
	t.equal(out.cells, 760, 'unknown ids are ignored')
	t.equal(out.skipped, 0, 'no unannotated cells among the selected')
	t.equal(out.k, 6, 'k nearest neighbours')
	t.equal(out.perms, 50, 'permutation count echoed')
	const total = out.count.flat().reduce((a: number, b: number) => a + b, 0)
	t.equal(total, 760 * 6, 'directed kNN graph: one edge per cell per neighbour')
	t.ok(out.zscore.length == 5 && out.zscore.every((r: any[]) => r.length == 5), '5x5 z-score matrix')
	t.ok(
		out.zscore.flat().every((z: any) => z === null || Number.isFinite(z)),
		'z-scores finite or null'
	)
	t.deepEqual(out.typeCounts.length, 5, 'one composition count per type')
	t.equal(
		out.typeCounts.reduce((a: number, b: number) => a + b, 0),
		760,
		'typeCounts sums to the selection size'
	)
	const again = JSON.parse(await run_python('wsi_tile.py', JSON.stringify(job)))
	t.deepEqual(again.zscore, out.zscore, 'same seed reproduces the z-scores')
	t.end()
})

tape('nhood rejects a selection with fewer than two cell types', async t => {
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const ids = Object.keys(ann.cells).filter(id => ann.cells[id] == 'Tumor')
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'nhood', h5ad, ids, perms: 10 })))
	t.ok(String(out.error).includes('at least 2 cell types'), 'error names the requirement')
	t.end()
})

tape('nhood reports a zero-variance pair as null without failing', async t => {
	// two cells of different types: k drops to 1, every permutation swaps the
	// two labels and the edge counts never change, so std is 0 for every pair
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const byType: { [t: string]: string } = {}
	for (const [id, type] of Object.entries(ann.cells) as [string, string][]) if (!byType[type]) byType[type] = id
	const ids = [byType['Tumor'], byType['B cells']]
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'nhood', h5ad, ids, perms: 10 })))
	t.notOk(out.error, 'no error (a numpy divide warning must not leak to stderr)')
	t.equal(out.k, 1, 'k capped at cells - 1')
	t.ok(
		out.zscore.flat().every((z: any) => z === null),
		'every z-score is null'
	)
	t.end()
})

tape('similar finds a window as its own best match when searched against itself', async t => {
	// coarse-to-fine self-check: tile the fixture, take one window's own cells
	// as the query, then search the same image for it -- the true answer is
	// exactly that window, so it must come back distance ~0, cheapScore ~1
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const allIds = Object.keys(ann.cells)
	const wide = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ action: 'nhood', h5ad, ids: allIds, k: 6, perms: 20, seed: 1 }))
	)
	const scan = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: wide.types,
				typeCounts: wide.typeCounts,
				count: wide.count,
				window: 100,
				stride: 50,
				topK: 6,
				// this bootstrap step only wants SOME real window to build the next
				// query from; the whole-image cell count (`wide`) is nowhere near a
				// 100x100 sub-window's, so the default +-10% size filter would empty
				// it out here -- neutralize it (0/1 always sit inside [n*0, n*2])
				sizeTolerance: 1
			})
		)
	)
	t.ok(scan.windows.length > 1, 'more than one window scanned the fixture')
	const chosen = scan.windows[0] // any one real window's own cells become the new query
	const query = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: chosen.ids, k: 6, perms: 200, seed: 1 })
		)
	)
	const selfSearch = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: query.types,
				typeCounts: query.typeCounts,
				count: query.count,
				zscore: query.zscore,
				k: 6,
				perms: 200,
				seed: 1,
				window: 100,
				stride: 50,
				topK: 6
			})
		)
	)
	t.deepEqual(selfSearch.types, query.types, 'window result aligned to the query type vocabulary')
	t.equal(selfSearch.refCells, query.cells, 'refCells echoes the query cell count')
	t.equal(selfSearch.sizeTolerance, 0.1, 'default +-10% size tolerance, not overridden here')
	const best = selfSearch.windows[0]
	t.ok(best.cheapScore > 0.999, `top match is (near) cosine-identical to the query (got ${best.cheapScore})`)
	t.ok(best.distance !== null && best.distance < 0.5, `top match has a small rigorous distance (got ${best.distance})`)
	const overlap = best.ids.filter((id: string) => chosen.ids.includes(id)).length
	t.equal(overlap, chosen.ids.length, "the winning window is exactly the query's own window")

	// same-sample search: without excludeIds the trivial self-match (the
	// exact reference window, 100% overlap) wins, as just shown above.
	// Passing the reference's own ids as excludeIds must drop that window
	// (and any other candidate more than half made of reference cells) so a
	// same-sample search returns a DIFFERENT niche instead of finding itself
	const excluded = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: query.types,
				typeCounts: query.typeCounts,
				count: query.count,
				zscore: query.zscore,
				k: 6,
				perms: 200,
				seed: 1,
				window: 100,
				stride: 50,
				topK: 6,
				excludeIds: chosen.ids
			})
		)
	)
	t.equal(excluded.excluded, true, 'excluded flag reports the overlap check was active')
	t.ok(
		excluded.windows.every((w: any) => {
			const frac = w.ids.filter((id: string) => chosen.ids.includes(id)).length / w.ids.length
			return frac <= 0.5
		}),
		'no returned window is more than half made of the excluded reference cells'
	)
	t.notDeepEqual(
		excluded.windows[0]?.ids,
		best.ids,
		'the trivial self-match is gone -- the top result is a genuinely different window'
	)
	t.end()
})

tape('similar excludeIds is a no-op across samples (empty/absent)', async t => {
	// sanity: omitting excludeIds (the normal cross-sample case) must behave
	// exactly as before -- excluded stays false, nothing is dropped by it
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 5, seed: 1 })
		)
	)
	const out = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: wide.types,
				typeCounts: wide.typeCounts,
				count: wide.count,
				k: 6,
				perms: 5,
				window: 100,
				stride: 50,
				topK: 5,
				sizeTolerance: 1
			})
		)
	)
	t.equal(out.excluded, false, 'excluded is false when excludeIds is omitted')
	t.end()
})

tape('similar excludes a candidate outside the size tolerance, by default +-10%', async t => {
	// deterministic setup: a window wider than the fixture's own spatial
	// extent always has exactly ONE grid position, covering every cell of the
	// query's vocabulary -- so its cell count is known exactly (= the query's
	// own `cells`), with no dependence on how cells happen to be distributed
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 20, seed: 1 })
		)
	)
	const wholeExtentScan = (typeCounts: number[], sizeTolerance?: number) =>
		run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: wide.types,
				typeCounts,
				count: wide.count,
				window: 1000, // larger than the fixture's ~212x209 µm extent: exactly one grid window
				stride: 1000,
				topK: 1,
				perms: 10, // the rigorous stage isn't under test here
				...(sizeTolerance == null ? {} : { sizeTolerance })
			})
		).then(JSON.parse)

	const exact = await wholeExtentScan(wide.typeCounts)
	t.equal(exact.windows.length, 1, 'the single whole-extent window matches its own exact cell count')
	t.equal(exact.windows[0].cells, wide.cells, 'and its cell count is exactly the query size (0% diff)')

	const halved = wide.typeCounts.map((n: number) => Math.round(n / 2)) // same mix, half the cells
	const excluded = await wholeExtentScan(halved)
	t.equal(
		excluded.windows.length,
		0,
		'a query at half the real window size is outside the default +-10% tolerance -- excluded despite an identical type mix'
	)

	const included = await wholeExtentScan(halved, 1.5) // +-150%: the same halved query, now well inside tolerance
	t.equal(included.windows.length, 1, 'the SAME halved query is included once sizeTolerance is widened past the gap')
	t.equal(included.sizeTolerance, 1.5, 'sizeTolerance is echoed back as given')
	t.end()
})

tape('similar rejects a query with fewer than two cell types', async t => {
	const out = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'similar', h5ad, types: ['Tumor'], typeCounts: [5], count: [[0]] })
		)
	)
	t.ok(String(out.error).includes('at least 2 query cell types'), 'error names the requirement')
	t.end()
})

tape('similar rejects a query vocabulary absent from the target image', async t => {
	const out = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: ['Not-A-Type-1', 'Not-A-Type-2'],
				typeCounts: [3, 3],
				count: [
					[0, 3],
					[3, 0]
				]
			})
		)
	)
	t.ok(String(out.error).includes('fewer than 2 cells'), 'error names the requirement')
	t.end()
})

tape('similar requires a candidate to actually contain every requiredType, not just weight it in', async t => {
	// window=20/stride=10 tiles the fixture small enough that some real
	// windows naturally lack a type the wide selection has (rare types don't
	// reach every corner) -- requiring that type must drop exactly those
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 5, seed: 1 })
		)
	)
	const scanArgs = {
		action: 'similar',
		h5ad,
		types: wide.types,
		typeCounts: wide.typeCounts,
		count: wide.count,
		k: 1,
		perms: 5,
		window: 20,
		stride: 10,
		topK: 20,
		sizeTolerance: 1 // isolate the requiredTypes effect from the size filter
	}
	const unfiltered = JSON.parse(await run_python('wsi_tile.py', JSON.stringify(scanArgs)))
	const required = 'Macrophages' // present overall, but not in every small window (verified below)
	t.ok(wide.types.includes(required), 'sanity: the fixture actually has this type')
	const missingSomewhere = unfiltered.windows.some((w: any) => !w.ids.some((id: string) => ann.cells[id] == required))
	t.ok(missingSomewhere, 'sanity: at least one unfiltered window lacks it (else this test proves nothing)')

	const filtered = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ ...scanArgs, requiredTypes: [required] }))
	)
	t.deepEqual(filtered.requiredTypes, [required], 'requiredTypes echoed back')
	t.ok(filtered.scanned < unfiltered.scanned, 'requiring the type shrinks the candidate pool, not just the ranking')
	t.ok(filtered.windows.length > 0, 'at least one real window does contain it')
	t.ok(
		filtered.windows.every((w: any) => w.ids.some((id: string) => ann.cells[id] == required)),
		'every returned window genuinely contains at least one cell of the required type'
	)
	t.end()
})

tape('similar rejects a requiredTypes entry outside the query’s own vocabulary', async t => {
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 5, seed: 1 })
		)
	)
	const out = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: wide.types,
				typeCounts: wide.typeCounts,
				count: wide.count,
				requiredTypes: ['Not-A-Real-Type']
			})
		)
	)
	t.ok(String(out.error).includes('requiredTypes'), 'error names the requirement')
	t.end()
})

tape('similar typeWeights reweights the cheap score, defaults to 1 (no effect)', async t => {
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 5, seed: 1 })
		)
	)
	const scanArgs = {
		action: 'similar',
		h5ad,
		types: wide.types,
		typeCounts: wide.typeCounts,
		count: wide.count,
		k: 1,
		perms: 5,
		window: 20,
		stride: 10,
		topK: 20,
		sizeTolerance: 1 // isolate the weighting effect from the size filter
	}
	const macroCountOf = (w: any) => w.ids.filter((id: string) => ann.cells[id] == 'Macrophages').length

	const baseline = JSON.parse(await run_python('wsi_tile.py', JSON.stringify(scanArgs)))
	t.deepEqual(
		baseline.typeWeights,
		wide.types.map(() => 1),
		'default weights are all 1 (no requested effect)'
	)

	const zeroed = wide.types.map((t: string) => (t == 'Macrophages' ? 0 : 1))
	const zeroedScan = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ ...scanArgs, typeWeights: zeroed })))
	t.deepEqual(zeroedScan.typeWeights, zeroed, 'typeWeights echoed back as given')
	t.equal(macroCountOf(zeroedScan.windows[0]), 0, 'weight 0 on Macrophages: top match ignores Macrophages entirely')

	const boosted = wide.types.map((t: string) => (t == 'Macrophages' ? 5 : 1))
	const boostedScan = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ ...scanArgs, typeWeights: boosted })))
	const boostedMacroCounts = boostedScan.windows.map(macroCountOf)
	t.equal(
		boostedMacroCounts[0],
		Math.max(...boostedMacroCounts),
		'weight 5 on Macrophages: top match has the highest Macrophage count among ALL returned candidates, not just a local one'
	)
	t.notEqual(
		boostedScan.windows[0].cheapScore,
		baseline.windows[0].cheapScore,
		'weighting actually changed the top score relative to the unweighted baseline'
	)
	t.end()
})

tape('similar rejects typeWeights of the wrong length or a negative weight', async t => {
	const ann = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'h5ad_annotations', h5ad })))
	const wide = JSON.parse(
		await run_python(
			'wsi_tile.py',
			JSON.stringify({ action: 'nhood', h5ad, ids: Object.keys(ann.cells), k: 6, perms: 5, seed: 1 })
		)
	)
	const run = (typeWeights: number[]) =>
		run_python(
			'wsi_tile.py',
			JSON.stringify({
				action: 'similar',
				h5ad,
				types: wide.types,
				typeCounts: wide.typeCounts,
				count: wide.count,
				typeWeights
			})
		).then(JSON.parse)

	const wrongLength = await run([1, 1])
	t.ok(String(wrongLength.error).includes('typeWeights'), 'wrong-length error names the parameter')

	const negative = await run(wide.types.map((_: string, i: number) => (i == 0 ? -1 : 1)))
	t.ok(String(negative.error).includes('non-negative'), 'negative-weight error is explicit')
	t.end()
})
