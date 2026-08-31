/**
Unit test for 'python/src/wsi_tile.py', driven through the same node->python
bridge the server uses (run_python pipes one JSON job on stdin, reads stdout).

Covers the offline tier-math self-check ({"action":"selftest"}, the former
--test-only check), every h5ad action against the committed TermdbTest
fixture (image1_spatial.h5ad: 791 cells, 5 cell types, 31 QC-filtered cells
with no type — and NO expression: single-cell expression lives in
scrna/geneExpHdf5 instead), and the expression actions against the small
wsi_tile.test.h5ad fixture beside this spec (4 cells x 3 genes, CSR).

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
// small expression-bearing h5ad, for the X-reading actions
const exprH5ad = path.resolve('python/test/wsi_tile.test.h5ad')

tape('selftest: Zoomify tier math', async t => {
	const out = await run_python('wsi_tile.py', JSON.stringify({ action: 'selftest' }))
	t.ok(String(out).includes('self-check OK'), 'tier-math self-check passes')
	t.end()
})

tape('genenames lists the expression fixture genes in file order', async t => {
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'genenames', h5: exprH5ad })))
	t.deepEqual(out.genes, ['G1', 'G2', 'G3'], 'the three fixture genes')
	t.end()
})

tape('genenames on an expression-less spatial h5ad is empty, not an error', async t => {
	const out = JSON.parse(await run_python('wsi_tile.py', JSON.stringify({ action: 'genenames', h5: h5ad })))
	t.deepEqual(out.genes, [], 'no genes: the spatial store carries no expression')
	t.end()
})

tape('genecounts answers per-cell counts of one gene', async t => {
	const out = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ action: 'genecounts', h5: exprH5ad, gene: 'G2' }))
	)
	t.deepEqual(out.cells, { c1: 3, c3: 5 }, 'per-cell counts, zero-count cells omitted')
	t.equal(out.max, 5, 'the highest count')
	t.end()
})

tape('genecounts reports an unknown gene as a clean error', async t => {
	const out = JSON.parse(
		await run_python('wsi_tile.py', JSON.stringify({ action: 'genecounts', h5: exprH5ad, gene: 'NOPE' }))
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
