import tape from 'tape'
import { hicData } from './hicData.ts'
//import { GenomeDataFetcher } from '../data/GenomeDataFetcher.ts'
import { DataFetcher } from '../../../tracks/hic/data/DataFetcher.ts'
//import { DetailDataFetcher } from '../../../tracks/hic/data/DetailDataFetcher.ts'
//import { DetailDataMapper } from '../../../tracks/hic/data/DetailDataMapper.ts'

tape('\n', test => {
	test.pass('-***- hic app integration tracks/hic -***-')
	test.end()
})

/******** Data Request Functions *********/

tape.skip('GenomeDataFetcher - class and getData()', test => {
	// test.plan(2)
	//TODO

	test.end()
})

tape('DataFetcher - class and getData()', test => {
	// test.plan(2)
	const mockHic = Object.assign(
		{ url: 'https://proteinpaint.stjude.org/ppdemo/hg19/hic/hic_demo.hic', nochr: false },
		hicData.hic.v8
	)
	const fetcher = new DataFetcher(mockHic, false, [])

	test.ok(fetcher instanceof DataFetcher, 'Should construct DataFetcher class properly.')
	test.equal(typeof fetcher.getData, 'function', 'Should have a fetcher.getData() function.')

	test.end()
})

tape.skip('DetailDataFetcher - class and getData()', test => {
	// test.plan(2)
	//TODO

	test.end()
})
