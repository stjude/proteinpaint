/********************************************
Unit test for sort_grin2_data() in 'python/src/grin2PpWrapper.py'

Regression guard: genes with no lesions of a type have a NaN p-value, and
pandas Series.argsort() maps NaN -> position -1. The old implementation
(data.iloc[min_p_values.argsort()]) therefore reselected the last row for every
NaN gene, corrupting the significance ordering of the Top Genes table. The fix
sorts ascending with NaN forced last; this test pins that behavior.

Requires a python3 with pandas/numpy on PATH (same as the other python specs).
Run (from 'proteinpaint/'):
    node python/test/grin2Sort.unit.spec.ts
*********************************************/

import tape from 'tape'
import { spawn } from 'child_process'
import path from 'path'

const srcDir = path.join(import.meta.dirname, '..', 'src')

// import sort_grin2_data and print the resulting gene order as JSON
const pySnippet = `
import sys, json
sys.path.insert(0, ${JSON.stringify(srcDir)})
import numpy as np, pandas as pd
from grin2PpWrapper import sort_grin2_data

# mix of real p-values and NaN (genes with no lesions of the type)
df = pd.DataFrame({
    'gene':  ['ATP1B2','PIK3CA-DT','TTN-AS1','ETFRF1','TAF7','PCDHGA1','CDH3'],
    'chrom': ['chr17','chr3','chr2','chr12','chr5','chr5','chr16'],
    'p.nsubj.mutation': [0.102, 1.0, 4.84e-211, np.nan, 5.74e-5, 8.59e-234, np.nan],
})
print(json.dumps(list(sort_grin2_data(df)['gene'])))
`

function runSort(): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise(resolve => {
		const ps = spawn('python3', ['-c', pySnippet])
		let stdout = '',
			stderr = ''
		ps.stdout.on('data', d => (stdout += d))
		ps.stderr.on('data', d => (stderr += d))
		ps.on('close', code => resolve({ code: code ?? -1, stdout, stderr }))
	})
}

tape('sort_grin2_data orders by ascending p-value with NaN p-values last', async t => {
	const { code, stdout, stderr } = await runSort()
	if (code !== 0) {
		t.fail(`python exited ${code}: ${stderr}`)
		t.end()
		return
	}

	const order = JSON.parse(stdout.trim())
	t.deepEqual(
		order,
		// significant genes lead in ascending p order; the two NaN-p genes (ETFRF1,
		// CDH3) trail, in their original input order (stable sort)
		['PCDHGA1', 'TTN-AS1', 'TAF7', 'ATP1B2', 'PIK3CA-DT', 'ETFRF1', 'CDH3'],
		'most significant first; NaN-p genes last (guards the argsort+NaN corruption)'
	)
	t.end()
})
