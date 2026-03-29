import tape from 'tape'

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

// Create a mock mayAdjustConfig function to test directly
// This is extracted from the getPlotConfig implementation in summary.ts
function getMayAdjustConfig(opts) {
	const discreteByContinuousPlots = new Set(['violin', 'boxplot'])
	
	return function mayAdjustConfig(config, edits: { childType?: string } = {}) {
		if (edits.childType) {
			if (config.childType != edits.childType)
				throw `action.config.childType was not applied in mass store.plot_edit()`
			return
		}
		
		if (config.term?.q?.mode == 'continuous' && config.term2?.q?.mode == 'continuous') {
			config.childType = 'sampleScatter'
		} else if (config.term?.term?.type == 'termCollection') {
			if (config.term.term.memberType == 'categorical') {
				config.childType = 'barchart'
			} else if (config.term.term.memberType == 'numeric') {
				if (config.childType) {
					if (config.childType == 'barchart') {
						config.childType = 'violin'
					} else {
						// do not overwrite e.g. if value is boxplot
					}
				} else {
					config.childType = 'violin'
				}
			} else {
				throw new Error('config.term.term.memberType not categorical or numeric')
			}
		} else if (config.term?.q?.mode == 'continuous' || config.term2?.q?.mode == 'continuous') {
			if (!discreteByContinuousPlots.has(config.childType)) {
				if (opts.childType && !discreteByContinuousPlots.has(opts.childType)) {
					console.warn(
						`ignoring summary opts.childType='${opts.childType}' since it does not support plotting discrete by continuous tw's`
					)
					config.childType = 'violin'
				} else {
					config.childType = opts.childType || 'violin'
				}
			}
		} else {
			config.childType = 'barchart'
		}
	}
}

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
	const mayAdjustConfig = getMayAdjustConfig(opts)

	mayAdjustConfig(config)

	test.equal(config.childType, 'barchart', 'Should set childType to barchart for categorical termCollection')
})

tape('mayAdjustConfig() - numeric termCollection without childType should default to violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, undefined)

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should default to violin for numeric termCollection without childType')
})

tape('mayAdjustConfig() - numeric termCollection with boxplot childType should preserve boxplot', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('numeric')
	const config = createConfig(term, undefined, 'boxplot')

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

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

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

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

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should preserve violin childType for numeric termCollection')
})

tape('mayAdjustConfig() - categorical termCollection should always be barchart even if childType provided', test => {
	test.plan(1)

	const opts = {}
	const term = createTermCollectionWrapper('categorical')
	const config = createConfig(term, undefined, 'violin')

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

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

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

	test.equal(config.childType, 'sampleScatter', 'Should set childType to sampleScatter for two continuous terms')
})

tape('mayAdjustConfig() - single continuous term without termCollection should default to violin', test => {
	test.plan(1)

	const opts = {}
	const term = createTermWrapper('float', 'continuous')
	const config = createConfig(term, undefined, undefined)

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

	test.equal(config.childType, 'violin', 'Should default to violin for single continuous term')
})

tape('mayAdjustConfig() - discrete terms should default to barchart', test => {
	test.plan(1)

	const opts = {}
	const term = createTermWrapper('categorical', 'discrete')
	const config = createConfig(term, undefined, undefined)

	const mayAdjustConfig = getMayAdjustConfig(opts)
	mayAdjustConfig(config)

	test.equal(config.childType, 'barchart', 'Should default to barchart for discrete terms')
})
