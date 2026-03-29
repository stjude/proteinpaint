import tape from 'tape'
import { getPlotConfig } from '../summary'

/*
Tests:
	mayAdjustConfig() - categorical termCollection should set childType to barchart
	mayAdjustConfig() - numeric termCollection without childType should default to violin
	mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot
	mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin
	mayAdjustConfig() - numeric termCollection with edits.childType should not modify
	mayAdjustConfig() - should throw for unknown memberType
*/

/*************************
 reusable helper functions
**************************/

// Create minimal mock for app parameter
function getMockApp() {
	return {
		vocabApi: {
			termdbConfig: {
				queries: {},
				state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } }
			}
		}
	}
}

// Create minimal term wrapper for testing
function createTermWrapper(type: string, mode?: string) {
	const tw: any = {
		term: { type, id: 'test-term', name: 'Test Term' }
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
				{ id: 'member1', name: 'Member 1', type: memberType == 'numeric' ? 'float' : 'categorical' }
			]
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

tape('mayAdjustConfig() - categorical termCollection should set childType to barchart', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('categorical')
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'barchart', 'Should set childType to barchart for categorical termCollection')
})

tape('mayAdjustConfig() - numeric termCollection without childType should default to violin', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric')
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'violin', 'Should default to violin for numeric termCollection without childType')
})

tape('mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric'),
		childType: 'boxplot'
	}

	const config = await getPlotConfig(opts, app)

	test.equal(
		config.childType,
		'boxplot',
		'Should preserve boxplot childType for numeric termCollection when explicitly set'
	)
})

tape('mayAdjustConfig() - numeric termCollection with barchart childType should overwrite to violin', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric'),
		childType: 'barchart'
	}

	const config = await getPlotConfig(opts, app)

	test.equal(
		config.childType,
		'violin',
		'Should overwrite barchart to violin for numeric termCollection (wrong type)'
	)
})

tape('mayAdjustConfig() - numeric termCollection with violin childType should preserve violin', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('numeric'),
		childType: 'violin'
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'violin', 'Should preserve violin childType for numeric termCollection')
})

tape('mayAdjustConfig() - categorical termCollection should always be barchart even if childType provided', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermCollectionWrapper('categorical'),
		childType: 'violin'
	}

	const config = await getPlotConfig(opts, app)

	test.equal(
		config.childType,
		'barchart',
		'Should overwrite to barchart for categorical termCollection regardless of provided childType'
	)
})

tape('mayAdjustConfig() - two continuous terms should set childType to sampleScatter', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('float', 'continuous'),
		term2: createTermWrapper('float', 'continuous')
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'sampleScatter', 'Should set childType to sampleScatter for two continuous terms')
})

tape('mayAdjustConfig() - single continuous term without termCollection should default to violin', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('float', 'continuous')
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'violin', 'Should default to violin for single continuous term')
})

tape('mayAdjustConfig() - discrete terms should default to barchart', async test => {
	test.plan(1)

	const app = getMockApp()
	const opts = {
		term: createTermWrapper('categorical', 'discrete')
	}

	const config = await getPlotConfig(opts, app)

	test.equal(config.childType, 'barchart', 'Should default to barchart for discrete terms')
})
