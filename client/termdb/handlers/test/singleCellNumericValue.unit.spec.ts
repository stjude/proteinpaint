import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../singleCellNumericValue.ts'
import { SINGLECELL_NUMERIC_VALUE } from '#types'

/*************************
 reusable helper functions
**************************/

function getHolder() {
    return d3s.select('body').append('div')
}

function createMockApp(termType2terms: any[] = []) {
	return {
		vocabApi: {
			termdbConfig: {
				termType2terms: {
					[SINGLECELL_NUMERIC_VALUE]: termType2terms
				}
			}
		}
	}
}

function createMockUsecase(config: any = {}) {
	return {
		specialCase: {
			config
		}
	}
}

function createMockTerm(overrides: any = {}) {
	return {
		name: 'test_term',
		plot: 'test_plot',
		sample: undefined,
		...overrides
	}
}

function createValidOpts(overrides: any = {}) {
	return {
		callback: () => {},
		app: createMockApp(),
		holder: getHolder(),
		usecase: createMockUsecase(),
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/singleCellNumericValue -***-')
	test.end()
})

// ===== Constructor Tests =====
tape('constructor: creates SearchHandler instance', function (test) {
	const handler = new SearchHandler()
	test.ok(handler instanceof SearchHandler, 'creates instance of SearchHandler')
	test.equal(handler.callback, undefined, 'callback starts as undefined')
	test.equal(handler.app, undefined, 'app starts as undefined')
	test.end()
})

// ===== ValidateOpts Tests =====
tape('validateOpts: accepts valid opts object', function (test) {
	const handler = new SearchHandler()
	const opts = createValidOpts()
	test.doesNotThrow(
		() => handler.validateOpts(opts),
		'validateOpts accepts valid options'
	)
	test.end()
})

tape('validateOpts: throws error for missing callback', function (test) {
	const handler = new SearchHandler()
	const opts = createValidOpts({ callback: null })
	test.throws(
		() => handler.validateOpts(opts),
		/callback is required/,
		'throws error when callback is null'
	)
	test.end()
})

tape('validateOpts: throws error for missing app', function (test) {
	const handler = new SearchHandler()
	const opts = createValidOpts({ app: null })
	test.throws(
		() => handler.validateOpts(opts),
		/app is required/,
		'throws error when app is null'
	)
	test.end()
})

tape('validateOpts: throws error for missing holder', function (test) {
	const handler = new SearchHandler()
	const opts = createValidOpts({ holder: null })
	test.throws(
		() => handler.validateOpts(opts),
		/holder is required/,
		'throws error when holder is null'
	)
	test.end()
})

tape('validateOpts: throws error for missing usecase', function (test) {
	const handler = new SearchHandler()
	const opts = createValidOpts({ usecase: null })
	test.throws(
		() => handler.validateOpts(opts),
		/usecase is required/,
		'throws error when usecase is null'
	)
	test.end()
})

tape('validateOpts: throws error for missing termType2terms', function (test) {
	const handler = new SearchHandler()
	const app = {
		vocabApi: {
			termdbConfig: {}
		}
	}
	const opts = createValidOpts({ app })
	test.throws(
		() => handler.validateOpts(opts),
		/termType2terms is required/,
		'throws error when termType2terms is missing'
	)
	test.end()
})

// ===== MakeTerm Tests =====
tape('makeTerm: creates term from raw term', function (test) {
	const handler = new SearchHandler()
	const rawTerm = createMockTerm({ sample: 'sample1' })
	const result = handler.makeTerm(rawTerm, {})
	
	test.equal(result.name, 'test_term', 'preserves term name')
	test.equal(result.plot, 'test_plot', 'preserves term plot')
	test.equal(result.sample, 'sample1', 'preserves original sample')
	test.end()
})

tape('makeTerm: adds sample from usecase config when term missing sample', function (test) {
	const handler = new SearchHandler()
	const rawTerm = createMockTerm({ sample: undefined })
	const usecaseConfig = { sample: 'usecase_sample' }
	const result = handler.makeTerm(rawTerm, usecaseConfig)
	
	test.equal(result.sample, 'usecase_sample', 'uses sample from usecase config')
	test.end()
})

tape('makeTerm: does not override term sample with usecase config sample', function (test) {
	const handler = new SearchHandler()
	const rawTerm = createMockTerm({ sample: 'term_sample' })
	const usecaseConfig = { sample: 'usecase_sample' }
	const result = handler.makeTerm(rawTerm, usecaseConfig)
	
	test.equal(result.sample, 'term_sample', 'preserves term sample over usecase config')
	test.end()
})

tape('makeTerm: does not mutate original term', function (test) {
	const handler = new SearchHandler()
	const rawTerm = createMockTerm({ sample: undefined })
	const usecaseConfig = { sample: 'usecase_sample' }
	const result = handler.makeTerm(rawTerm, usecaseConfig)
	
	test.equal((rawTerm as any).sample, undefined, 'original term is not mutated')
	test.notEqual(result, rawTerm, 'returns new term object')
	test.end()
})

// ===== Init Tests =====
tape('init: throws error when no terms in termType2terms', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const opts = createValidOpts({
		holder,
		app: createMockApp([]) // empty terms array
	})
	
	await handler.init(opts)
	
	const errorDiv = holder.select('div')
	const hasError = errorDiv.node() !== null
	test.ok(hasError, 'displays error message when no terms available')
	test.end()
})

tape('init: displays error with correct message format', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const opts = createValidOpts({
		holder,
		app: createMockApp([])
	})
	
	await handler.init(opts)
	
	// Check that an error was displayed (sayerror appends to holder)
	const divCount = holder.selectAll('div').size()
	test.ok(divCount > 0, 'error message appended to holder')
	test.end()
})

tape('init: sets callback and app on instance', async function (test) {
	const handler = new SearchHandler()
	const callback = () => {}
	const app = createMockApp([createMockTerm()])
	const opts = createValidOpts({ callback, app })
	
	await handler.init(opts)
	
	test.equal(handler.callback, callback, 'callback set on instance')
	test.equal(handler.app, app, 'app set on instance')
	test.end()
})

tape('init: creates term divs for available terms', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' }),
		createMockTerm({ name: 'term2', plot: 'plot2' })
	]
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms)
	})
	
	await handler.init(opts)
	
	const termLabels = holder.selectAll('.termlabel')
	test.equal(termLabels.size(), 2, 'creates label for each term')
	test.end()
})

tape('init: filters terms by plots when sample.plots provided', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' }),
		createMockTerm({ name: 'term2', plot: 'plot2' }),
		createMockTerm({ name: 'term3', plot: 'plot3' })
	]
	const usecaseConfig = {
		sample: {
			plots: ['plot1', 'plot2']
		}
	}
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	const termLabels = holder.selectAll('.termlabel')
	test.equal(termLabels.size(), 2, 'displays only terms matching filtered plots')
	test.end()
})

tape('init: filters terms by usecase.name when provided', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' }),
		createMockTerm({ name: 'term2', plot: 'plot2' }),
		createMockTerm({ name: 'term3', plot: 'plot2' })
	]
	const usecaseConfig = {
		name: 'plot2'
	}
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	const termLabels = holder.selectAll('.termlabel')
	test.equal(termLabels.size(), 2, 'displays only terms matching usecase.name')
	test.end()
})

tape('init: displays all terms when no filter provided', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' }),
		createMockTerm({ name: 'term2', plot: 'plot2' }),
		createMockTerm({ name: 'term3', plot: 'plot3' })
	]
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms)
	})
	
	await handler.init(opts)
	
	const termLabels = holder.selectAll('.termlabel')
	test.equal(termLabels.size(), 3, 'displays all terms when no filter applied')
	test.end()
})

tape('init: label includes plot name for multiple plots or no meta', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' })
	]
	const usecaseConfig = {
		sample: {
			plots: ['plot1', 'plot2'] // multiple plots
		}
	}
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	const label = holder.select('.termlabel').text()
	test.ok(label.includes('term1'), 'label includes term name')
	test.ok(label.includes('plot1'), 'label includes plot name for multiple plots')
	test.end()
})

tape('init: label excludes plot name when single plot or isMeta', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' })
	]
	const usecaseConfig = {
		sample: {
			plots: ['plot1'],
			isMetaResult: true
		}
	}
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	const label = holder.select('.termlabel').text()
	test.equal(label, 'term1', 'label is just term name for single plot with meta')
	test.end()
})

tape('init: callback invoked with correct term on click', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const callbackResult: { captured: any } = { captured: null }
	const callback = (term: any) => {
		callbackResult.captured = term
	}
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1', sample: 'sample1' })
	]
	const opts = createValidOpts({
		holder,
		callback,
		app: createMockApp(terms)
	})
	
	await handler.init(opts)
	
	// Simulate click on term label
	const labelNode = holder.select('.termlabel').node() as HTMLElement
	if (labelNode) {
		const clickEvent = new MouseEvent('click')
		labelNode.dispatchEvent(clickEvent)
	}
	
	test.ok(callbackResult.captured, 'callback was invoked')
	test.equal(callbackResult.captured?.name, 'term1', 'callback receives correct term')
	test.end()
})

tape('init: callback term includes sample from usecase if not in term', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const callbackResult: { captured: any } = { captured: null }
	const callback = (term: any) => {
		callbackResult.captured = term
	}
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1', sample: undefined })
	]
	const usecaseConfig = {
		sample: 'usecase_sample'
	}
	const opts = createValidOpts({
		holder,
		callback,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	// Simulate click
	const labelNode = holder.select('.termlabel').node() as HTMLElement
	if (labelNode) {
		const clickEvent = new MouseEvent('click')
		labelNode.dispatchEvent(clickEvent)
	}
	
	test.equal(callbackResult.captured?.sample, 'usecase_sample', 'callback term includes usecase sample')
	test.end()
})

tape('init: applies termdiv and pill styling classes', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [createMockTerm()]
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms)
	})
	
	await handler.init(opts)
	
	const termdiv = holder.select('.termdiv')
	const label = holder.select('.termlabel')
	
	test.ok(termdiv.node() !== null, 'applies termdiv class')
	test.ok(label.classed('sja_filter_tag_btn'), 'applies sja_filter_tag_btn class')
	test.ok(label.classed('sja_tree_click_term'), 'applies sja_tree_click_term class')
	test.ok(label.classed('ts_pill'), 'applies ts_pill class')
	test.end()
})

tape('init: deduplicates terms in filtered set', async function (test) {
	const handler = new SearchHandler()
	const holder = getHolder()
	const terms = [
		createMockTerm({ name: 'term1', plot: 'plot1' }),
		createMockTerm({ name: 'term1', plot: 'plot1' }) // duplicate
	]
	const usecaseConfig = {
		sample: {
			plots: ['plot1']
		}
	}
	const opts = createValidOpts({
		holder,
		app: createMockApp(terms),
		usecase: createMockUsecase(usecaseConfig)
	})
	
	await handler.init(opts)
	
	const termLabels = holder.selectAll('.termlabel')
	test.equal(termLabels.size(), 1, 'deduplicates identical terms')
	test.end()
})

