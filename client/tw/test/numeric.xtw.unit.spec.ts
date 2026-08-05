import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson'
import { NumericBase } from '../numeric'
import { TwRouter } from '../TwRouter.ts'
import type { RawNumTW } from '#types'

/*************************
 reusable helper functions
**************************/

const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })

/* the pill states a tw's status through the class that TwRouter routes it to, as the termsetting
handler does. bin_size and first_bin are supplied so that no preset or server request is needed */
async function getRegularBinXtw(bin_size: number, valueConversion?: any) {
	const term = structuredClone(termjson.agedx)
	if (valueConversion) term.valueConversion = valueConversion
	const tw: RawNumTW = {
		$id: 'test.$id',
		term,
		q: { type: 'regular-bin', bin_size, first_bin: { startunbounded: true, stop: bin_size }, isAtomic: true },
		isAtomic: true
	} as any
	return TwRouter.init(await NumericBase.fill(tw as any, { vocabApi }))
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/numeric.xtw.unit -***-')
	test.end()
})

tape('fill(invalid tw)', async test => {
	// not typing with RawQualTW since these are not valid fill() argument
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

tape('NumRegularBin.getStatus()', async test => {
	/* a term with valueConversion{} stores its values in one unit (e.g. day) and is read by users in
	another (e.g. year). q.bin_size is stored in the term's own unit, so the pill, which is read by a
	user, has to state it in the user-facing one and name that unit */
	const dayToYear = { fromUnit: 'day', toUnit: 'year', scaleFactor: 1 / 365.25 }

	const converted = await getRegularBinXtw(1826.25, dayToYear)
	test.deepEqual(
		converted.getStatus(),
		{ text: 'bin size=5 years' },
		`should state the bin size of a converted term in its user-facing unit`
	)

	// a bin size that is not a whole number of the user-facing unit is rounded, as an input shows it
	const rounded = await getRegularBinXtw(1000, dayToYear)
	test.deepEqual(rounded.getStatus(), { text: 'bin size=2.74 years' }, `should round the bin size of a converted term`)

	const unconverted = await getRegularBinXtw(3)
	test.deepEqual(
		unconverted.getStatus(),
		{ text: 'bin size=3' },
		`should state the stored bin size, with no unit, for a term without valueConversion`
	)

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
