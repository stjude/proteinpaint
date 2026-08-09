import tape from 'tape'
import { PlotBase } from '../PlotBase.ts'

/* Tests:
    - plot-scoped vocabApi
*/

// stands in for the Vocab class, whose create() returns a plot-scoped instance
// by prototypal inheritance, see client/termdb/Vocab.js
function getTestVocabApi() {
	return {
		appSignal: new AbortController().signal,
		getAbortSignal() {
			return this.appSignal
		},
		create(getPlotAbortSignal) {
			return Object.create(this, { getAbortSignal: { value: () => getPlotAbortSignal() } })
		}
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/PlotBase -***-')
	test.end()
})

tape('plot-scoped vocabApi', function (test) {
	const vocabApi = getTestVocabApi()
	const plotSignal = new AbortController().signal
	const api: any = { getAbortSignal: () => plotSignal }

	const plot = new PlotBase({ app: { vocabApi } }, api)
	const scoped = plot.vocabApi as any
	test.equal(typeof scoped, 'object', `should assign a vocabApi to the plot`)
	test.equal(Object.getPrototypeOf(scoped), vocabApi, `should inherit from the app-level vocabApi`)
	test.equal(scoped.getAbortSignal(), plotSignal, `should return the plot's abort signal`)
	test.notEqual(scoped.getAbortSignal(), vocabApi.appSignal, `should not return the app-level abort signal`)

	// rx assigns the api to the component instance after the class constructor runs,
	// so the abort signal must be looked up lazily and not captured at construction
	const plot1 = new PlotBase({ app: { vocabApi } })
	plot1.api = api
	test.equal(
		(plot1.vocabApi as any).getAbortSignal(),
		plotSignal,
		`should use the api that rx assigns after the constructor`
	)

	const plot2 = new PlotBase({})
	test.equal(plot2.vocabApi, undefined, `should not assign a vocabApi when the app does not have one`)

	test.end()
})
