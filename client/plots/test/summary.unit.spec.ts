import tape from 'tape'
import { getPlotConfig } from '../summary'

/*
Tests:
	mayAdjustConfig() - categorical termCollection should set childType to barchart
	mayAdjustConfig() - numeric termCollection without childType should default to violin
	mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot
	mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin
	mayAdjustConfig() - two continuous terms should set childType to sampleScatter
	mayAdjustConfig() - single continuous term should default to violin
	mayAdjustConfig() - discrete terms should default to barchart
*/

/*************************
 reusable helper functions
**************************/

// Mock fillTermWrapper to return the term wrapper as-is
// This allows us to bypass the async vocabApi calls in tests
import * as termsetting from '#termsetting'
const originalFillTermWrapper = termsetting.fillTermWrapper
function mockFillTermWrapper() {
	// @ts-ignore - Override the fillTermWrapper function for testing
	termsetting.fillTermWrapper = async (tw, vocabApi, q?) => {
		// Just return the term wrapper as-is, assuming it's already "filled"
		if (q && !tw.q) tw.q = q
		return tw
	}
}
function restoreFillTermWrapper() {
	// @ts-ignore
	termsetting.fillTermWrapper = originalFillTermWrapper
}

// Create minimal mock for app parameter
function getMockApp() {
	return {
		vocabApi: {
			termdbConfig: {
				queries: {},
				state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } },
				uiLabels: {}
			}
		}
	}
}

// Create minimal term wrapper for testing (already "filled")
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

// Create termCollection term wrapper (already "filled")
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

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/summary -***-')
	test.end()
})

tape.onFinish(() => {
	restoreFillTermWrapper()
})

tape('mayAdjustConfig() - categorical termCollection should set childType to barchart', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('categorical')
	}

	const config = await getPlotConfig(opts, app)
	// Call mayAdjustConfig to test the logic
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'barchart', 'Should set childType to barchart for categorical termCollection')
})

tape('mayAdjustConfig() - numeric termCollection without childType should default to violin', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric')
	}

	const config = await getPlotConfig(opts, app)
	// Reset childType to test default behavior
	config.childType = undefined
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should default to violin for numeric termCollection without childType')
})

tape('mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = 'boxplot'
	config.mayAdjustConfig(config)

	test.equal(
		config.childType,
		'boxplot',
		'Should preserve boxplot childType for numeric termCollection when explicitly set'
	)
})

tape('mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = 'barchart'
	config.mayAdjustConfig(config)

	test.equal(
		config.childType,
		'violin',
		'Should overwrite barchart to violin for numeric termCollection (wrong type)'
	)
})

tape('mayAdjustConfig() - numeric termCollection with violin childType should preserve violin', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = 'violin'
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should preserve violin childType for numeric termCollection')
})

tape('mayAdjustConfig() - categorical termCollection should always be barchart even if childType provided', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('categorical')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = 'violin'
	config.mayAdjustConfig(config)

	test.equal(
		config.childType,
		'barchart',
		'Should overwrite to barchart for categorical termCollection regardless of provided childType'
	)
})

tape('mayAdjustConfig() - two continuous terms should set childType to sampleScatter', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('float', 'continuous'),
		term2: createTermWrapper('float', 'continuous')
	}

	const config = await getPlotConfig(opts, app)
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'sampleScatter', 'Should set childType to sampleScatter for two continuous terms')
})

tape('mayAdjustConfig() - single continuous term without termCollection should default to violin', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('float', 'continuous')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = undefined
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should default to violin for single continuous term')
})

tape('mayAdjustConfig() - discrete terms should default to barchart', async test => {
	test.plan(1)
	mockFillTermWrapper()

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('categorical', 'discrete')
	}

	const config = await getPlotConfig(opts, app)
	config.childType = undefined
	config.mayAdjustConfig(config)

	test.equal(config.childType, 'barchart', 'Should default to barchart for discrete terms')
})
