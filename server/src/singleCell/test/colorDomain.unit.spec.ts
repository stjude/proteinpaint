import tape from 'tape'
import { getNumericColorDomain } from '../colorDomain.ts'

const cells = (values: unknown[]) => values.map(category => ({ category })) as any

// The outlier makes a percentile computed from just [min,max] visibly incorrect.
const distribution = cells([-5, 0, 1, 2, 3, 1000])

tape('numeric canvas color domain: automatic, fixed and percentile', test => {
	test.deepEqual(getNumericColorDomain(distribution, {} as any), [-5, 1000], 'automatic uses full range')
	test.deepEqual(getNumericColorDomain(distribution, {
		colorScaleMode: 'fixed', colorScaleMinFixed: 0, colorScaleMaxFixed: 10
	} as any), [0, 10], 'fixed bounds preserve zero and override data extrema')
	test.deepEqual(getNumericColorDomain(distribution, {
		colorScaleMode: 'percentile', colorScalePercentile: 50
	} as any), [-5, 2], 'percentile uses all cells rather than extrema')
	for (const [percentile, max] of [[0, -5], [100, 1000]]) {
		test.deepEqual(getNumericColorDomain(distribution, {
			colorScaleMode: 'percentile', colorScalePercentile: percentile
		} as any), [-5, max], `supports percentile ${percentile}`)
	}
	test.deepEqual(distribution.map(c => c.category), [-5, 0, 1, 2, 3, 1000], 'does not reorder or mutate cell data')
	test.end()
})

tape('numeric canvas color domain: invalid values and degenerate distributions', test => {
	test.deepEqual(getNumericColorDomain(cells(['', ' ', null, undefined, 'NA', Infinity, '0', '4']), {
		colorScaleMode: 'percentile', colorScalePercentile: 50
	} as any), [0, 4], 'missing values do not enter percentile distribution; zero does')
	test.deepEqual(getNumericColorDomain(cells([7]), { colorScaleMode: 'percentile' } as any), [7, 7], 'supports one cell')
	test.deepEqual(getNumericColorDomain(cells([2, 2, 2]), { colorScaleMode: 'percentile' } as any), [2, 2], 'supports constant values')
	test.throws(() => getNumericColorDomain([], {} as any), /No numeric data/, 'rejects empty distribution')
	for (const settings of [
		{ colorScaleMode: 'fixed', colorScaleMinFixed: null, colorScaleMaxFixed: 1 },
		{ colorScaleMode: 'fixed', colorScaleMinFixed: 2, colorScaleMaxFixed: 1 },
		{ colorScaleMode: 'fixed', colorScaleMinFixed: 0, colorScaleMaxFixed: Infinity },
		{ colorScaleMode: 'percentile', colorScalePercentile: -1 },
		{ colorScaleMode: 'percentile', colorScalePercentile: 101 },
		{ colorScaleMode: 'percentile', colorScalePercentile: NaN },
		{ colorScaleMode: 'unknown' }
	]) test.throws(() => getNumericColorDomain(distribution, settings as any), /color scale/i, 'rejects invalid scale settings')
	test.end()
})
