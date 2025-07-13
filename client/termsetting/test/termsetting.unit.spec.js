import tape from 'tape'
import { fillTermWrapper } from '#termsetting'
import { vocabInit } from '#termdb/vocabulary'
import { getExample } from '#termdb/test/vocabData'

const vocab = getExample()
const vocabApi = vocabInit({ state: { vocab } })

const features = JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}')

/*
Tests:
	fillTermWrapper - continuous term
 */

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termsetting.unit -***-')
	test.end()
})

tape('fillTermWrapper - continuous term', async function (test) {
	test.timeoutAfter(100)
	test.plan(11)

	let defaultQ, expectedQ, testMsg

	////////// undefined tw.q.mode
	const tw = {
		term: structuredClone(await vocabApi.getterm('d'))
	}
	await fillTermWrapper(tw, vocabApi)
	test.equal(tw.q.mode, 'discrete', 'should set q.mode=discrete when q.mode is undefined and defaultQ is not supplied')
	test.equal(tw.isAtomic, true, 'should set tw.isAtomic=true')
	test.equal(tw.q.isAtomic, true, 'should set tw.q.isAtomic=true')
	test.deepEqual(
		tw.q,
		{
			isAtomic: true,
			mode: 'discrete',
			type: 'regular-bin',
			bin_size: 0.2,
			stopinclusive: true,
			first_bin: {
				startunbounded: true,
				stop: 0.2,
				stopinclusive: true
			},
			hiddenValues: {}
		},
		'should fill q with bin info when q.mode=discrete'
	)

	/////////// defined tw.q.mode
	const tw2 = {
		term: structuredClone(await vocabApi.getterm('d')),
		q: { mode: 'continuous' }
	}
	await fillTermWrapper(tw2, vocabApi)
	test.equal(tw2.q.mode, 'continuous', 'should not change q.mode when q.mode is defined and defaultQ is not supplied')
	test.deepEqual(
		tw2.q,
		{
			mode: 'continuous',
			isAtomic: true,
			hiddenValues: {}
		},
		'should not fill q with bin info when mode=continuous'
	)

	/////////// defaultQ.preferredBins='median'
	defaultQ = {
		numeric: {
			mode: 'discrete',
			type: 'custom-bin',
			preferredBins: 'median'
		}
	}
	expectedQ = {
		mode: 'discrete',
		type: 'custom-bin',
		isAtomic: true,
		lst: [
			{
				startunbounded: true,
				stop: 0.45,
				stopinclusive: false,
				label: '<0.45'
			},
			{
				start: 0.45,
				startinclusive: true,
				stopunbounded: true,
				label: '≥0.45'
			}
		],
		hiddenValues: {}
	}
	const tw3 = {
		term: structuredClone(await vocabApi.getterm('d'))
	}
	await fillTermWrapper(tw3, vocabApi, structuredClone(defaultQ))
	test.deepEqual(tw3.q, expectedQ, 'should fill q with defaultQ when defaultQ.preferredBins=median')
	const tw4 = {
		term: structuredClone(await vocabApi.getterm('d')),
		q: { mode: 'continuous' }
	}
	await fillTermWrapper(tw4, vocabApi, structuredClone(defaultQ))
	test.deepEqual(tw4.q, expectedQ, 'should overwrite tw.q with defaultQ when defaultQ.preferredBins=median')

	defaultQ = {
		numeric: {
			mode: 'discrete',
			type: 'regular-bin',
			preferredBins: 'median'
		}
	}
	testMsg = 'should throw error when defaultQ.type is not custom-bin for preferredBins=median'
	try {
		const tw5 = {
			term: structuredClone(await vocabApi.getterm('d'))
		}
		await fillTermWrapper(tw5, vocabApi, defaultQ)
		test.fail(testMsg)
	} catch (e) {
		test.equal(e, '.type must be custom-bin when .preferredBins=median', testMsg)
	}

	/////////// defaultQ.preferredBins='less'
	const tw6 = {
		term: structuredClone(await vocabApi.getterm('d'))
	}
	defaultQ = {
		numeric: {
			test: 'apple',
			preferredBins: 'less'
		}
	}
	await fillTermWrapper(tw6, vocabApi, defaultQ)
	test.deepEqual(
		tw6.q,
		Object.assign(
			{
				type: 'regular-bin',
				bin_size: 0.4,
				stopinclusive: true,
				first_bin: { startunbounded: true, stop: 0.2, stopinclusive: true },
				hiddenValues: {}
			},
			{
				isAtomic: true,
				mode: 'discrete',
				test: 'apple'
			}
		),
		'should fill tw.q with tw.term.bins.less when defaultQ.preferredBins=less'
	)

	/////////// defaultQ, undefined .preferredBins
	const tw7 = {
		term: structuredClone(await vocabApi.getterm('d'))
	}
	defaultQ = { numeric: { mode: 'continuous' } }
	await fillTermWrapper(tw7, vocabApi, defaultQ)
	test.deepEqual(
		tw7.q,
		{
			isAtomic: true,
			mode: 'continuous',
			hiddenValues: {}
		},
		'should merge defaultQ into tw.q when defaultQ.preferredBins is not defined'
	)
})
