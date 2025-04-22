import tape from 'tape'
import { prepData } from '../cnv'

/***
test sections:

prepData()
*/

tape('\n', test => {
	test.pass('-***- mds3/cnv unit-***-')
	test.end()
})

tape('prepData()', test => {
	test.timeoutAfter(100)

	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: cnvNumeric }, mockTk, mockBlock)
		test.deepEqual(cnvLst, cnvNumericProcessed, 'get expected processed cnv data')
		test.equal(samples, undefined, 'no sample')
		test.equal(absoluteMax, 1, 'absoluteMax=1')
	}
	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: cnvSample }, mockTk, mockBlock)
		// FIXME
		//test.deepEqual(cnvLst, cnvSampleProcessed,'get expected processed cnv data')
		test.equal((samples as any[]).length, 1, 'returned 1 sample') // avoid tsc err

		test.equal(absoluteMax, 1, 'absoluteMax=1')
	}
	{
		const [samples, cnvLst, absoluteMax] = prepData({ cnv: cnvCategory }, mockTk, mockBlock)
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
	seekcoord: (chr: string, pos: number) => {
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
	{ chr: 'chr1', start: 100, stop: 200, value: 1, class: 'CNV_amp', samples: [{ sample_id: '1' }] },
	{ chr: 'chr1', start: 200, stop: 300, value: -1, class: 'CNV_loss', samples: [{ sample_id: '1' }] },
	{ chr: 'chr1', start: 300, stop: 400, value: -1, class: 'CNV_loss', samples: [{ sample_id: '1' }] }
]
const cnvSampleProcessed = helpProcessCnv(cnvSample)

// cnv data not using numeric values but by class (category)
const cnvCategory = [
	{ chr: 'chr1', start: 100, stop: 200, class: 'CNV_amp' },
	{ chr: 'chr1', start: 200, stop: 300, class: 'CNV_loss' },
	{ chr: 'chr1', start: 300, stop: 400, class: 'CNV_loss' }
]
const cnvCategoryProcessed = helpProcessCnv(cnvCategory)
