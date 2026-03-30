import tape from 'tape'
import { mayAdjustConfig } from '../summary.ts'

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

	test.equal(
		config.childType,
		'violin',
		'Should overwrite barchart to violin for numeric termCollection (wrong type)'
	)
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
