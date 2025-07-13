import tape from 'tape'
import { prepData } from '../cnv'
import { mayInitCnv } from '../makeTk'

/***
test sections:

prepData()
mayInitCnv()
*/

tape('\n', test => {
	test.comment('-***- mds3/cnv unit-***-')
	test.end()
})

tape('mayInitCnv()', test => {
	{
		const tk: any = {
			mds: {},
			custom_variants: [{ dt: 1 }]
		}
		mayInitCnv(tk)
		test.false(tk.cnv, 'tk.cnv{} is not set')
	}
	{
		const tk: any = {
			mds: { termdbConfig: { queries: { cnv: {} } } },
			glider: { append: () => {} }
		}
		mayInitCnv(tk)
		test.true(tk.cnv, 'tk.cnv{} is set from native ds')
	}
	{
		const tk: any = {
			mds: {},
			custom_variants: [{ dt: 4, class: 's' }],
			glider: { append: () => {} }
		}
		mayInitCnv(tk)
		test.true(tk.cnv, 'tk.cnv{} is set from custom cnv data')
		test.false(tk.cnv.cnvGainCutoff, 'tk.cnv.cnvGainCutoff is not set for custom non-numeric cnv')
	}
	{
		const tk: any = {
			mds: {},
			custom_variants: [{ dt: 4, class: 's', value: 1 }],
			glider: { append: () => {} }
		}
		mayInitCnv(tk)
		test.true(tk.cnv, 'tk.cnv{} is set from custom cnv data')
		test.equal(tk.cnv.cnvGainCutoff, 0, 'tk.cnv.cnvGainCutoff=0 for custom numeric cnv')
	}
	test.end()
})

tape('prepData()', test => {
	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: { cnvs: cnvNumeric } }, mockTk, mockBlock)
		test.deepEqual(cnvLst, cnvNumericProcessed, 'get expected processed cnv data')
		test.equal(samples, undefined, 'no sample')
		test.equal(absoluteMax, 1, 'absoluteMax=1')
	}
	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: { cnvs: cnvSample } }, mockTk, mockBlock)
		test.deepEqual(cnvLst, cnvSampleProcessed, 'get expected processed cnv data')
		test.equal((samples as any[]).length, 1, 'returned 1 sample') // avoid tsc err

		test.equal(absoluteMax, 1, 'absoluteMax=1')
	}
	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: { cnvs: cnvCategory } }, mockTk, mockBlock)
		test.deepEqual(cnvLst, cnvCategoryProcessed, 'get expected processed cnv data')
		test.equal(samples, undefined, 'no sample')
		test.equal(absoluteMax, 0, 'absoluteMax=0')
	}

	test.end()
})

const mockTk = {
	cnv: {
		absoluteValueRenderMax: 1
	}
}
const mockBlock = {
	seekcoord: () => {
		return [{ x: 1 }]
	}
}

function helpProcessCnv(lst) {
	const out: any = structuredClone(lst)
	for (let i = 0; i < out.length; i++) {
		out[i].x1 = out[i].x2 = 1
		out[i].y = i
	}
	return out
}

// cnv data by numeric values
const cnvNumeric = [
	{ chr: 'chr1', start: 100, stop: 200, value: 1, class: 'CNV_amp' },
	{ chr: 'chr1', start: 200, stop: 300, value: -1, class: 'CNV_loss' },
	{ chr: 'chr1', start: 300, stop: 400, value: -1, class: 'CNV_loss' }
]
const cnvNumericProcessed = helpProcessCnv(cnvNumeric)

// cnv with sample
const cnvSample = [
	{ chr: 'chr1', start: 100, stop: 201, value: 1, class: 'CNV_amp', samples: [{ sample_id: '1' }] },
	{ chr: 'chr1', start: 200, stop: 301, value: -1, class: 'CNV_loss', samples: [{ sample_id: '1' }] },
	{ chr: 'chr1', start: 300, stop: 400, value: -1, class: 'CNV_loss', samples: [{ sample_id: '1' }] }
]
const cnvSampleProcessed = helpProcessCnv(cnvSample)
for (const c of cnvSampleProcessed) delete c.y // FIXME why .y is missing

// cnv data not using numeric values but by class (category)
const cnvCategory = [
	{ chr: 'chr1', start: 100, stop: 200, class: 'CNV_amp' },
	{ chr: 'chr1', start: 200, stop: 300, class: 'CNV_loss' },
	{ chr: 'chr1', start: 300, stop: 400, class: 'CNV_loss' }
]
const cnvCategoryProcessed = helpProcessCnv(cnvCategory)
