import tape from 'tape'
import { renderVolcano } from '#src/renderVolcano.ts'
import type { VolcanoRenderRequest, DataEntry } from '#types'

/*
test sections:

input validation: pixelWidth / pixelHeight / dotRadius / maxInteractiveDots / devicePixelRatio
input validation: pValueType, pValueCutoff, foldChangeCutoff
input validation: per-row fold_change and chosen p-value field
basic render: valid PNG, totalRows, plotExtent dims + dotRadiusPx
significance classification: only rows past both cutoffs are significant
dots: sorted ascending by p, carry finite pixel_x/pixel_y, preserve pass-through fields
maxInteractiveDots caps dots but not totalSignificantRows; null returns all
plotExtent axis math: symmetric x, yMin 0, padding extends the domain
minNonZeroPValue: smallest positive p, and all-zero-p fallback to 1e-300
pValueType 'original' classifies/sorts on original_p_value
both significant up (fc>0) and down (fc<0) render and appear in dots
empty rows: blank PNG, no dots, zero-spread axis fallbacks
default req: renderVolcano(rows) with no second arg
DPR device dimensions: exact w*dpr, and clamp to MAX_DEVICE_PIXELS_PER_SIDE
*/

/** Unit tests for renderVolcano. The function is mostly pure logic (validation,
 * significance classification, axis/padding math, dot extraction) wrapped around
 * one skia-canvas render; we assert on the returned VolcanoData directly and
 * decode the PNG's IHDR to check device pixel dimensions (and thus DPR clamping)
 * without pulling in a PNG-decoder dependency. */

/** Decode a base64 PNG's pixel dimensions from its IHDR chunk (width at byte
 * offset 16, height at 20, big-endian), after asserting the 8-byte signature. */
function pngSize(b64: string): { width: number; height: number } {
	const buf = Buffer.from(b64, 'base64')
	const sig = [137, 80, 78, 71, 13, 10, 26, 10]
	for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG')
	return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/** A valid baseline request; `over` shallow-merges (with a nested merge of
 * significanceThresholds) so a test states only what it varies. */
function makeReq(over: any = {}): VolcanoRenderRequest {
	const { significanceThresholds, ...rest } = over
	return {
		significanceThresholds: {
			pValueCutoff: 1.3,
			pValueType: 'adjusted',
			foldChangeCutoff: 0.3,
			...(significanceThresholds || {})
		},
		pixelWidth: 400,
		pixelHeight: 400,
		...rest
	} as VolcanoRenderRequest
}

/** One DataEntry row; `adjusted_p_value` defaults to `original_p_value`. */
function row(fold_change: number, p: number, extra: any = {}): DataEntry {
	return { fold_change, original_p_value: p, adjusted_p_value: p, ...extra }
}

/** Assert an async call rejects with a message matching `re`. */
async function rejects(t: any, fn: () => Promise<unknown>, re: RegExp, msg: string) {
	try {
		await fn()
		t.fail(`${msg} — expected throw, got none`)
	} catch (e: any) {
		t.ok(re.test(e.message), `${msg} (got: ${e.message})`)
	}
}

tape('\n', t => {
	t.comment('-***- renderVolcano specs -***-')
	t.end()
})

/* ---------------------------- input validation ---------------------------- */

tape('rejects out-of-range pixelWidth / pixelHeight', async t => {
	const rows = [row(1, 0.001)]
	for (const bad of [0, -1, 5000, NaN, Infinity]) {
		await rejects(t, () => renderVolcano(rows, makeReq({ pixelWidth: bad })), /pixelWidth/, `pixelWidth=${bad}`)
		await rejects(t, () => renderVolcano(rows, makeReq({ pixelHeight: bad })), /pixelHeight/, `pixelHeight=${bad}`)
	}
	t.end()
})

tape('rejects out-of-range dotRadius, maxInteractiveDots, devicePixelRatio', async t => {
	const rows = [row(1, 0.001)]
	await rejects(t, () => renderVolcano(rows, makeReq({ dotRadius: 0.05 })), /dotRadius/, 'dotRadius too small')
	await rejects(t, () => renderVolcano(rows, makeReq({ dotRadius: 25 })), /dotRadius/, 'dotRadius too large')
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ maxInteractiveDots: -1 })),
		/maxInteractiveDots/,
		'maxInteractiveDots negative'
	)
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ maxInteractiveDots: 60000 })),
		/maxInteractiveDots/,
		'maxInteractiveDots too large'
	)
	await rejects(t, () => renderVolcano(rows, makeReq({ devicePixelRatio: 0.5 })), /devicePixelRatio/, 'dpr < 1')
	await rejects(t, () => renderVolcano(rows, makeReq({ devicePixelRatio: 7 })), /devicePixelRatio/, 'dpr > 6')
	t.end()
})

tape('rejects invalid pValueType and non-finite thresholds', async t => {
	const rows = [row(1, 0.001)]
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ significanceThresholds: { pValueType: 'foo' } })),
		/pValueType/,
		'bad pValueType'
	)
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ significanceThresholds: { pValueCutoff: NaN } })),
		/pValueCutoff/,
		'NaN pValueCutoff'
	)
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ significanceThresholds: { pValueCutoff: -1 } })),
		/pValueCutoff/,
		'negative pValueCutoff'
	)
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ significanceThresholds: { foldChangeCutoff: NaN } })),
		/foldChangeCutoff/,
		'NaN foldChangeCutoff'
	)
	await rejects(
		t,
		() => renderVolcano(rows, makeReq({ significanceThresholds: { foldChangeCutoff: -1 } })),
		/foldChangeCutoff/,
		'negative foldChangeCutoff'
	)
	t.end()
})

tape('rejects rows with a non-finite fold_change or invalid p-value field', async t => {
	await rejects(t, () => renderVolcano([row(NaN, 0.01)], makeReq()), /row 0 fold_change/, 'NaN fold_change')
	await rejects(
		t,
		() => renderVolcano([{ original_p_value: 0.01, adjusted_p_value: 0.01 } as any], makeReq()),
		/row 0 fold_change/,
		'missing fold_change'
	)
	await rejects(
		t,
		() => renderVolcano([row(1, -0.1)], makeReq()),
		/adjusted_p_value must be a finite value/,
		'negative p'
	)
	await rejects(
		t,
		() => renderVolcano([{ fold_change: 1, original_p_value: 0.01 } as any], makeReq()),
		/adjusted_p_value must be a finite value/,
		'missing adjusted p'
	)
	t.end()
})

/* ------------------------- happy-path output + math ------------------------ */

tape('basic render: valid PNG, totalRows, plotExtent dims and dotRadiusPx', async t => {
	const rows = [row(2, 0.001), row(-1.5, 0.0001), row(0.1, 0.5)]
	const out = await renderVolcano(rows, makeReq())

	t.equal(out.totalRows, 3, 'totalRows equals input length')
	t.ok(typeof out.volcanoPng === 'string' && out.volcanoPng.length > 0, 'volcanoPng is a non-empty base64 string')
	const sz = pngSize(out.volcanoPng) // throws if not a valid PNG
	t.ok(sz.width > 0 && sz.height > 0, 'PNG decodes to positive dimensions')

	// default dotRadius 2 → radiusPx 2 → padPx 4 → w = pixelWidth + 4
	t.equal(out.plotExtent.dotRadiusPx, 2, 'dotRadiusPx is floor(dotRadius) clamped to >=1')
	t.equal(out.plotExtent.pixelWidth, 404, 'plotExtent.pixelWidth = input + 2*radiusPx')
	t.equal(out.plotExtent.pixelHeight, 404, 'plotExtent.pixelHeight = input + 2*radiusPx')
	t.equal(out.plotExtent.plotRight, 404, 'plotRight spans the full padded canvas')
	t.end()
})

tape('significance: only rows past BOTH cutoffs are significant', async t => {
	// cutoffs: -log10(p) > 1.3 (p < ~0.05) AND |fc| > 0.3
	const rows = [
		row(2, 0.001), // y=3, |fc|=2  → significant
		row(-1.5, 0.0001), // significant (down)
		row(2, 0.5), // y≈0.3, fails p cutoff → not significant
		row(0.1, 0.0001) // |fc|=0.1 fails fc cutoff → not significant
	]
	const out = await renderVolcano(rows, makeReq())
	t.equal(out.totalSignificantRows, 2, 'exactly the two rows clearing both cutoffs are significant')
	t.equal(out.dots.length, 2, 'dots holds only the significant rows')
	t.end()
})

tape('dots: sorted ascending by p, finite in-bounds pixels, pass-through fields kept', async t => {
	const rows = [
		row(2, 0.01, { gene_name: 'mid' }),
		row(2, 0.0001, { gene_name: 'low' }),
		row(-2, 0.001, { gene_name: 'high' })
	]
	const out = await renderVolcano(rows, makeReq())
	const ps = out.dots.map((d: any) => d.adjusted_p_value)
	t.deepEqual(
		ps,
		[...ps].sort((a, b) => a - b),
		'dots are sorted ascending by p-value'
	)
	t.deepEqual(
		out.dots.map((d: any) => d.gene_name),
		['low', 'high', 'mid'],
		'sort order is by p and pass-through gene_name is preserved'
	)
	const w = out.plotExtent.pixelWidth
	const h = out.plotExtent.pixelHeight
	for (const d of out.dots as any[]) {
		t.ok(Number.isFinite(d.pixel_x) && d.pixel_x >= 0 && d.pixel_x <= w, `pixel_x in [0,${w}]`)
		t.ok(Number.isFinite(d.pixel_y) && d.pixel_y >= 0 && d.pixel_y <= h, `pixel_y in [0,${h}]`)
	}
	t.end()
})

tape('maxInteractiveDots caps dots to most-significant N; null returns all', async t => {
	const rows = [row(2, 0.001), row(2, 0.0001), row(-2, 0.00001), row(2, 0.01)]
	// all four are significant; cap at 2 → keep the two smallest p-values
	const capped = await renderVolcano(rows, makeReq({ maxInteractiveDots: 2 }))
	t.equal(capped.totalSignificantRows, 4, 'totalSignificantRows reflects the full count, not the cap')
	t.equal(capped.dots.length, 2, 'dots truncated to maxInteractiveDots')
	t.deepEqual(
		capped.dots.map((d: any) => d.adjusted_p_value),
		[0.00001, 0.0001],
		'kept dots are the two most significant (smallest p)'
	)

	const all = await renderVolcano(rows, makeReq({ maxInteractiveDots: null }))
	t.equal(all.dots.length, 4, 'null maxInteractiveDots returns every significant row')
	t.end()
})

tape('plotExtent axis math: symmetric x, yMin 0, padding extends the domain', async t => {
	const rows = [row(2, 0.001), row(-1, 0.01), row(0.5, 0.02)]
	const { plotExtent: pe } = await renderVolcano(rows, makeReq())
	t.equal(pe.xMaxUnpadded, 2, 'xMaxUnpadded = max|fold_change|')
	t.equal(pe.xMinUnpadded, -2, 'x domain is symmetric about 0')
	t.equal(pe.yMinUnpadded, 0, 'y domain starts at 0')
	t.ok(pe.xMin < pe.xMinUnpadded && pe.xMax > pe.xMaxUnpadded, 'padding extends x beyond the unpadded extent')
	t.ok(pe.yMin < 0 && pe.yMax > pe.yMaxUnpadded, 'padding extends y beyond the unpadded extent')
	t.end()
})

tape('minNonZeroPValue: smallest positive p (zeros capped), all-zero falls back to 1e-300', async t => {
	const withZero = await renderVolcano([row(2, 0), row(2, 0.002), row(-2, 0.01)], makeReq())
	t.equal(withZero.plotExtent.minNonZeroPValue, 0.002, 'minNonZeroPValue is the smallest positive p')
	t.ok(Number.isFinite(withZero.plotExtent.yMax), 'p==0 rows produce a finite (capped) y, not Infinity')

	const allZero = await renderVolcano([row(2, 0), row(-2, 0)], makeReq())
	t.equal(allZero.plotExtent.minNonZeroPValue, 1e-300, 'all-zero p input falls back to 1e-300')
	t.end()
})

tape("pValueType 'original' classifies and sorts on original_p_value", async t => {
	// A: significant only by original p; B: significant only by adjusted p.
	const A = row(2, 0.0001, { gene_name: 'A' })
	A.adjusted_p_value = 0.9 // not significant under 'adjusted'
	const B = row(2, 0.9, { gene_name: 'B' })
	B.adjusted_p_value = 0.0001 // significant under 'adjusted' only

	const out = await renderVolcano([A, B], makeReq({ significanceThresholds: { pValueType: 'original' } }))
	t.equal(out.totalSignificantRows, 1, 'exactly one row is significant by original p')
	t.equal((out.dots[0] as any).gene_name, 'A', 'the row significant by ORIGINAL p is the one kept')
	t.end()
})

tape('renders both significant up (fc>0) and down (fc<0) rows', async t => {
	const rows = [row(2, 0.0001, { gene_name: 'up' }), row(-2, 0.0001, { gene_name: 'down' })]
	const out = await renderVolcano(rows, makeReq())
	t.equal(out.totalSignificantRows, 2, 'both directional rows are significant')
	const names = (out.dots as any[]).map(d => d.gene_name).sort()
	t.deepEqual(names, ['down', 'up'], 'both up and down rows appear in dots')
	pngSize(out.volcanoPng) // both stroke batches ran → still a valid PNG
	t.pass('render with both up/down batches produced a valid PNG')
	t.end()
})

/* ------------------------------ edge + DPR -------------------------------- */

tape('empty rows: blank PNG, no dots, zero-spread axis fallbacks', async t => {
	const out = await renderVolcano([] as DataEntry[], makeReq())
	t.equal(out.totalRows, 0, 'totalRows is 0')
	t.equal(out.totalSignificantRows, 0, 'no significant rows')
	t.deepEqual(out.dots, [], 'dots is empty')
	t.equal(out.plotExtent.xMaxUnpadded, 1, 'x extent falls back to 1 when there is no spread')
	t.equal(out.plotExtent.yMaxUnpadded, 1, 'y extent falls back to 1 when there is no spread')
	pngSize(out.volcanoPng)
	t.pass('blank input still produces a valid PNG')
	t.end()
})

tape('default req: renderVolcano(rows) with no second arg', async t => {
	const out = await renderVolcano([row(2, 0.001), row(-1, 0.0001)])
	t.ok(out.volcanoPng.length > 0, 'uses DEFAULT_REQ and renders')
	t.equal(out.plotExtent.pixelWidth, 404, 'DEFAULT_REQ pixelWidth 400 + padding')
	t.end()
})

tape('DPR: exact device dimensions, and clamp to MAX_DEVICE_PIXELS_PER_SIDE', async t => {
	// w = 404, dpr 2 → 808 device px exactly (no clamp: 8192/404 ≈ 20.3 >> 2).
	const exact = await renderVolcano([row(2, 0.001)], makeReq({ devicePixelRatio: 2 }))
	t.deepEqual(pngSize(exact.volcanoPng), { width: 808, height: 808 }, 'device dims = w*dpr when under the cap')

	// w = 4000 (pixelWidth 3996 + pad 4), h = 125 (pixelHeight 121 + pad 4).
	// dpr 6 would give 24000 px wide; effectiveDpr clamps to 8192/4000 = 2.048,
	// so the wide axis lands exactly on the 8192 cap (height 125*2.048 = 256).
	const clamped = await renderVolcano(
		[row(2, 0.001)],
		makeReq({ pixelWidth: 3996, pixelHeight: 121, devicePixelRatio: 6 })
	)
	const sz = pngSize(clamped.volcanoPng)
	t.equal(sz.width, 8192, 'wide axis is clamped to MAX_DEVICE_PIXELS_PER_SIDE (not 24000)')
	t.equal(sz.height, 256, 'short axis scales by the same clamped effectiveDpr')
	t.end()
})
