import tape from 'tape'
import { hicData } from './hicData.ts'
import { GenomeDataFetcher } from '../data/GenomeDataFetcher.ts'
import { DataFetcher } from '../data/DataFetcher.ts'
import { DetailDataFetcher } from '../data/DetailDataFetcher.ts'

tape('\n', test => {
	test.comment('-***- hic app integration tracks/hic -***-')
	test.end()
})

/** Run this file manually. Takes too long to run on CI.
 * Notes:
 * - Not able to test DetailDataMapper .getYFragData() and .getXFragData() methods
 * until the reference files are available on CI.
 */

/******** Data Request Functions *********/

//TODO: This may take too long on CI. Need to confirm.
//Sometimes remote file unable to fetch all data. Need guidance
tape.skip('GenomeDataFetcher - class and getData()', async test => {
	// test.plan(2)

	const mockHic = Object.assign(hicData.hic.v8, { url: 'https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic' })

	const fetcher = new GenomeDataFetcher(mockHic, false, [])
	test.ok(fetcher instanceof GenomeDataFetcher, 'Should construct DataFetcher class properly.')

	const testObj = { matrixType: 'observed', nmeth: 'NONE', resolution: 2500000 }
	const data = await fetcher.getData(testObj)
	console.log(data)

	test.end()
})

tape('DataFetcher - class and getData()', async test => {
	test.plan(3)
	const mockHic = Object.assign(
		{ url: 'https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic', nochr: false },
		hicData.hic.v8
	)
	const fetcher = new DataFetcher(mockHic, false, [])

	test.ok(fetcher instanceof DataFetcher, 'Should construct DataFetcher class properly.')
	test.equal(typeof fetcher.getData, 'function', 'Should have a fetcher.getData() function.')

	const data = await fetcher.getData({
		matrixType: 'observed',
		lead: 'chr1',
		follow: 'chr1',
		nmeth: 'KR',
		resolution: 1000000
	})
	const expected = [
		[0, 0, 58649.03125],
		[0, 1000000, 14183.319335938],
		[1000000, 1000000, 45817.88671875],
		[0, 2000000, 1918.7163085938]
	]
	const slicedData = data.items.slice(0, 4)
	test.deepEqual(slicedData, expected, 'Should fetch data from hic file properly.')
})

// Enzyme file or any other reference file not available on CI. Run test manually
tape.skip('DetailDataFetcher - getBedData()', async test => {
	test.plan(2)

	const fetcher = new DetailDataFetcher([])
	const args = {
		getdata: 1,
		getBED: 1,
		file: 'anno/hicFragment/hic.MboI.hg38.gz',
		rglst: [{ chr: 'chr1', start: 0, stop: 1000000 }]
	}
	const result = await fetcher.getBedData(args)
	const expected1st = { rest: ['0'], chr: 'chr1', start: 0, stop: 11160, rglst: [{ idx: 0 }] }
	test.deepEqual(result.items[0], expected1st, 'Should fetch data from hic file properly.')

	const expectedLast = { rest: ['2051'], chr: 'chr1', start: 995927, stop: 1000059, rglst: [{ idx: 0 }] }
	test.deepEqual(result.items[result.items.length - 1], expectedLast, 'Should fetch data from hic file properly.')
})

tape('DetailDataFetcher - fetchData()', async test => {
	test.plan(5)

	let result, expected1st, expectedLast, chrx, chry

	const fetcher = new DetailDataFetcher([])
	const mockHic = Object.assign(
		{ url: 'https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic', nochr: false },
		hicData.hic.v8
	)
	const detail = { matrixType: 'observed', nmeth: 'VC' }
	chrx = { chr: 'chr1', start: 0, stop: 1000000 }
	chry = { chr: 'chr1', start: 0, stop: 1000000 }
	result = await fetcher.fetchData(mockHic, {}, 1000000, chrx, chry)
	const expected = [
		[0, 0, 8177],
		[0, 1000000, 5187],
		[1000000, 1000000, 43952]
	]
	test.deepEqual(result.items, expected, 'Should fetch data for position from hic file properly.')

	chry = { chr: 'chr2', start: 0, stop: 1000000 }
	result = await fetcher.fetchData(mockHic, detail, 50000, chrx, chry)
	expected1st = [0, 0, 114.1276473999]
	test.deepEqual(
		result.items[0],
		expected1st,
		`Should fetch data for position when normalization and matrixtype provided from hic file properly.`
	)
	expectedLast = [1000000, 1000000, 0.5559669137001]
	test.deepEqual(
		result.items[result.items.length - 1],
		expectedLast,
		'Should fetch data for position from hic file properly.'
	)

	chrx = { chr: 'chr7', start: 16852629, stop: 17739134 }
	chry = { chr: 'chr7', start: 16852629, stop: 17739134 }
	const fragX = { start: 41670, stop: 43662 }
	const fragY = { start: 41670, stop: 43662 }
	result = await fetcher.fetchData(mockHic, detail, 5, chrx, chry, { x: fragX, y: fragY })
	expected1st = [41670, 41670, 10.236996650696]
	test.deepEqual(result.items[0], expected1st, 'Should fetch data for fragments from hic file properly.')
	expectedLast = [43660, 43660, 8.5049228668213]
	test.deepEqual(
		result.items[result.items.length - 1],
		expectedLast,
		'Should fetch data for fragments from hic file properly.'
	)
})
