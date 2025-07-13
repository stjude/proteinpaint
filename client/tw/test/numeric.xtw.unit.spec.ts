import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { NumericBase } from '../numeric'
import type { RawNumTW } from '#types'

/*************************
 reusable helper functions
**************************/

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/numeric.xtw.unit -***-')
	test.end()
})

tape('fill(invalid tw)', async test => {
	// not typing with RawCatTW since these are not valid fill() argument
	const tw = {
		term: { id: 'abc', type: 'categorical' }
	}
	{
		const msg = 'should detect an incorrect term.type'
		try {
			await NumericBase.fill(tw as any, { vocabApi })
			test.fail(msg)
		} catch (e: any) {
			test.true(e.includes('non-numeric term.type'), msg + ': ' + e)
		}
	}

	test.end()
})

tape(`fill() default q.type='regular-bin'`, async test => {
	const tw: RawNumTW = {
		$id: 'test.$id',
		term: termjson.agedx,
		q: { isAtomic: true },
		isAtomic: true
	}

	try {
		const fullTw = await NumericBase.fill(tw as any, { vocabApi })
		test.equal(fullTw.type, 'NumTWRegularBin', 'should assign the correct tw.type')
		test.deepEqual(
			fullTw.q,
			{
				isAtomic: true,
				mode: 'discrete',
				type: 'regular-bin',
				bin_size: 3,
				first_bin: {
					startunbounded: true,
					stop: 2
				},
				label_offset: 1,
				hiddenValues: {}
			},
			`should fill-in numeric q with no type with default q.type='regular-bin'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})

tape.skip(`fill() q.type=custom-bin opts.defaultQ.preferredBins='median'`, async test => {
	const tw: RawNumTW = {
		$id: 'test.$id',
		term: termjson.agedx,
		q: {
			type: 'custom-bin',
			isAtomic: true
		},
		isAtomic: true
	}

	const defaultQ = {
		type: 'custom-bin',
		preferredBins: 'median',
		// supply a median value to not require a vocabApi server request,
		// since a server is not expected to be running during a unit test
		median: 8.16
	}

	try {
		const fullTw = await NumericBase.fill(tw as any, { vocabApi, defaultQ })
		test.equal(fullTw.type, 'NumTWCustomBin', 'should assign the correct tw.type')
		test.deepEqual(
			fullTw.q,
			{
				type: 'custom-bin',
				mode: 'discrete',
				isAtomic: true,
				lst: [
					{ startunbounded: true, stop: 8.16, stopinclusive: false, label: '<8.16' },
					{ start: 8.16, startinclusive: true, stopunbounded: true, label: '≥8.16' }
				],
				hiddenValues: {}
			},
			`should fill-in numeric q with no type with default q.type='regular-bin'`
		)
	} catch (e: any) {
		test.fail(e)
	}

	test.end()
})
