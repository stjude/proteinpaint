import test from 'tape'
import { PercentileMapper } from '#plots/disco/data/PercentileMapper.ts'
//import Data from '#plots/disco/data/Data.ts'

test('PercentileMapper.map() should return correct percentiles for positive and negative values', t => {
	const mapper = new PercentileMapper()
	const data: Array<number> = [1, -1, 2, -2]

	const percentiles = mapper.map(data, 80)

	t.equal(percentiles.positive, 1.8, '80th percentile of positive values should be 1.8')
	t.equal(percentiles.negative, -1.8, '80th percentile of negative values should be -1.8')

	t.end()
})

test('PercentileMapper.map( should return correct percentile for just positive values', t => {
	const mapper = new PercentileMapper()

	const data: Array<number> = [1, 2, 3, 4]

	const percentile = mapper.map(data, 80)

	t.equal(percentile.positive, 3.4000000000000004, '80th percentile should be 3.4000000000000004')

	t.end()
})

test('PercentileMapper.map( should return correct percentile for just negative values', t => {
	const mapper = new PercentileMapper()

	const data: Array<number> = [-1, -2, -3, -4]

	const percentile = mapper.map(data, 80)

	t.equal(percentile.negative, -3.4000000000000004, '80th percentile should be -3.4000000000000004')

	t.end()
})
