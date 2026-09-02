import tape from 'tape'
import { getPlotConfig, mayAdjustConfig, isScatterToggleVisible } from '../summary.ts'

/*
Tests:
	mayAdjustConfig() - categorical termCollection should set childType to barchart
	mayAdjustConfig() - numeric termCollection without childType should default to violin
	mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot
	mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin
	mayAdjustConfig() - two continuous terms should set childType to sampleScatter
	mayAdjustConfig() - single continuous term should default to violin
	mayAdjustConfig() - discrete terms should default to barchart
	isScatterToggleVisible() - resolves the comma-joined cohort key, requires dynamicScatter and two numeric terms
*/

/*************************
 reusable helper functions
**************************/

// Create minimal term wrapper for testing
function createTermWrapper(type: string, mode?: string) {
	const tw: any = {
		term: {
			type,
			id: 'test-term',
			name: 'Test Term',
			values: {}
		}
	}
	if (mode) {
		tw.q = { mode }
	}
	return tw
}

// Create termCollection term wrapper
function createTermCollectionWrapper(memberType: 'categorical' | 'numeric') {
	return {
		term: {
			type: 'termCollection',
			id: 'test-collection',
			name: 'Test Collection',
			memberType,
			termlst: [
				{
					id: 'member1',
					name: 'Member 1',
					type: memberType == 'numeric' ? 'float' : 'categorical',
					values: {}
				}
			],
			values: {}
		},
		q: { mode: memberType == 'numeric' ? 'continuous' : 'discrete' }
	}
}

function createFractionWrapper(mode: 'continuous' | 'discrete' = 'continuous') {
	const tw: any = createTermCollectionWrapper('numeric')
	tw.type = 'TermCollectionTWFraction'
	tw.q =
		mode === 'continuous'
			? { mode, denominators: ['member1'], numerators: ['member1'] }
			: {
					mode,
					type: 'custom-bin',
					lst: [
						{ startunbounded: true, stop: 0.5 },
						{ start: 0.5, stopunbounded: true, startinclusive: true }
					],
					denominators: ['member1'],
					numerators: ['member1']
			  }
	return tw
}

// Create a minimal config object for testing
function createConfig(term, term2?, childType?) {
	return {
		chartType: 'summary',
		childType: childType || 'barchart',
		term,
		term2,
		groups: [],
		settings: {}
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/summary -***-')
	test.end()
})

tape('mayAdjustConfig() - categorical termCollection should set childType to barchart', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('categorical')
	const config = createConfig(term)

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'barchart', 'Should set childType to barchart for categorical termCollection')
})

tape('mayAdjustConfig() - numeric termCollection without childType should default to violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, undefined)

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'violin', 'Should default to violin for numeric termCollection without childType')
})

tape('mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, 'boxplot')

	mayAdjustConfig(config, opts)

	test.equal(
		config.childType,
		'boxplot',
		'Should preserve boxplot childType for numeric termCollection when explicitly set'
	)
})

tape('mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, 'barchart')

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'violin', 'Should overwrite barchart to violin for numeric termCollection (wrong type)')
})

tape('mayAdjustConfig() - numeric termCollection with violin childType should preserve violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, 'violin')

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'violin', 'Should preserve violin childType for numeric termCollection')
})

tape('mayAdjustConfig() - categorical termCollection should always be barchart even if childType provided', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('categorical')
	const config = createConfig(term, undefined, 'violin')

	mayAdjustConfig(config, opts)

	test.equal(
		config.childType,
		'barchart',
		'Should overwrite to barchart for categorical termCollection regardless of provided childType'
	)
})

tape('mayAdjustConfig() - two continuous terms should set childType to sampleScatter', test => {
	test.plan(1)

	const opts = {}
	const term = createTermWrapper('float', 'continuous')
	const term2 = createTermWrapper('float', 'continuous')
	const config = createConfig(term, term2)

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'sampleScatter', 'Should set childType to sampleScatter for two continuous terms')
})

tape('mayAdjustConfig() - single continuous term without termCollection should default to violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermWrapper('float', 'continuous')
	const config = createConfig(term, undefined, undefined)

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'violin', 'Should default to violin for single continuous term')
})

tape('mayAdjustConfig() - discrete terms should default to barchart', test => {
	test.plan(1)

	const opts = {}
	const term = createTermWrapper('categorical', 'discrete')
	const config = createConfig(term, undefined, undefined)

	mayAdjustConfig(config, opts)

	test.equal(config.childType, 'barchart', 'Should default to barchart for discrete terms')
})

tape('mayAdjustConfig() - continuous fraction collection behaves as one numeric term', test => {
	const config = createConfig(createFractionWrapper(), undefined, 'barchart')
	mayAdjustConfig(config, {})
	test.equal(config.childType, 'violin', 'routes a single continuous fraction to a scalar violin')
	test.end()
})

tape('mayAdjustConfig() - two continuous fraction/numeric terms use scatter', test => {
	const config = createConfig(createFractionWrapper(), createTermWrapper('float', 'continuous'))
	mayAdjustConfig(config, {})
	test.equal(config.childType, 'sampleScatter', 'routes two scalar continuous terms to scatter')
	test.end()
})

tape('getPlotConfig() applies opts.getPlotConfig_mutateSummary before validating and filling terms', async test => {
	test.plan(3)
	let callbackCalls = 0
	const app: any = {
		opts: {
			getPlotConfig_mutateSummary: async opts => {
				callbackCalls++
				await Promise.resolve()
				opts.term = createTermWrapper('categorical', 'discrete')
			}
		},
		vocabApi: {
			termdbConfig: { uiLabels: {} },
			getTwMinCopy: tw => tw
		},
		getState: () => ({ termdbConfig: {} })
	}

	const config = await getPlotConfig({}, app)

	test.equal(callbackCalls, 1, 'calls the Mass summary-config mutator once')
	test.equal(config.term.term.id, 'test-term', 'uses the primary term supplied asynchronously by the mutator')
	test.equal(config.childType, 'barchart', 'returns a valid summary config after applying the mutation')
})

/*
	isScatterToggleVisible() — regression coverage for the summary "Scatter" toggle visibility.
	Two prior bugs are guarded here (see client/plots/summary.ts and client/mass/charts.ts getActiveCohortStr):
	  1. supportedChartTypes is keyed by the sorted cohort KEYS joined with commas, not by the cohort's
	     shortLabel — so combined cohorts (keys "ABC","XYZ" -> "ABC,XYZ", shortLabel "ABC+XYZ") were losing
	     the toggle when it was looked up by shortLabel.
	  2. The toggle builds a dynamic two-term scatter, so it must require `dynamicScatter`, not
	     `sampleScatter` — the latter is also reported for a cohort that only has a premade plot, which
	     would offer an unsupported toggle.
*/

const numericTw = { term: { type: 'float', id: 'x', name: 'X', values: {} } }
const categoricalTw = { term: { type: 'categorical', id: 'c', name: 'C', values: {} } }

// build an appState shaped as getActiveCohortStr()/getCurrentCohortChartTypes() read it. `cohortKeys` are
// the raw (unsorted) keys of the active cohort; `shortLabel` is deliberately different from the comma key.
function makeCohortAppState(cohortKeys: string[], supportedChartTypes: Record<string, string[]>, shortLabel: string) {
	return {
		activeCohort: 0,
		termdbConfig: {
			selectCohort: { values: [{ keys: cohortKeys, shortLabel }] },
			supportedChartTypes
		}
	}
}

tape('isScatterToggleVisible: shows the toggle for a combined cohort keyed by its comma-joined keys', test => {
	// keys given out of order to prove they are sorted before joining: "XYZ","ABC" -> "ABC,XYZ"
	const appState = makeCohortAppState(
		['XYZ', 'ABC'],
		{ 'ABC,XYZ': ['summary', 'sampleScatter', 'dynamicScatter'] },
		'ABC+XYZ' // the old (wrong) shortLabel key — absent from supportedChartTypes
	)
	test.equal(
		isScatterToggleVisible(appState, numericTw, numericTw),
		true,
		'combined cohort should keep the toggle when dynamicScatter is supported under the comma key'
	)
	test.end()
})

tape(
	'isScatterToggleVisible: hides the toggle for a prebuilt-only cohort (sampleScatter but not dynamicScatter)',
	test => {
		const appState = makeCohortAppState(
			['ABC'],
			{ ABC: ['summary', 'sampleScatter'] }, // premade plot enables sampleScatter, but no dynamic scatter
			'ABC'
		)
		test.equal(
			isScatterToggleVisible(appState, numericTw, numericTw),
			false,
			'a cohort with only a premade scatter must not offer the dynamic two-term toggle'
		)
		test.end()
	}
)

tape('isScatterToggleVisible: requires both terms to be numeric even when dynamicScatter is supported', test => {
	const appState = makeCohortAppState(['ABC'], { ABC: ['summary', 'dynamicScatter'] }, 'ABC')
	test.equal(isScatterToggleVisible(appState, numericTw, numericTw), true, 'two numeric terms -> visible')
	test.equal(isScatterToggleVisible(appState, numericTw, categoricalTw), false, 'a non-numeric term2 -> hidden')
	test.equal(isScatterToggleVisible(appState, categoricalTw, numericTw), false, 'a non-numeric term -> hidden')
	test.end()
})

tape('isScatterToggleVisible: datasets without cohort selection use the empty-string key', test => {
	// getActiveCohortStr returns '' when there is no selectCohort, so supportedChartTypes is keyed by ''
	const appState = { termdbConfig: { supportedChartTypes: { '': ['summary', 'dynamicScatter'] } } }
	test.equal(
		isScatterToggleVisible(appState, numericTw, numericTw),
		true,
		'a non-subcohort dataset should resolve the empty-string key'
	)
	test.end()
})
