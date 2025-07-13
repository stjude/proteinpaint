import tape from 'tape'
import * as d3 from 'd3-selection'
import { MultiTermWrapperEditUI } from '../MultiTermWrapperEditUI.ts'
import { vocabInit } from '../../termdb/vocabulary'
import { termjson } from '../../test/testdata/termjson.ts'
import { detectGte } from '../../test/test.helpers.js'

/**
 * Tests
 * 	- Default Multi term edit UI
 *  - Render with terms
 *	- All terms cleared
 */

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return d3.select('body').append('div').style('max-width', '800px').style('border', '1px solid #555')
}

function getTestOpts(_opts, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const state = {
		vocab: { route: 'termdb', genome, dslabel },
		termfilter: {},
		activeCohort: 0
	}
	const app = Object.assign(_opts.app || {}, {
		getState() {
			return state
		},
		opts: { state }
	})
	const vocabApi = _opts.vocabApi || vocabInit({ app, state })
	app.vocabApi = vocabApi

	const opts = {
		app,
		vocabApi,
		holder: _opts.holder,
		twList: [],
		headerText: 'Test top text',
		buttonLabel: 'Test button label',
		customInputs: {
			placeholder: 'Test placeholder'
		},
		callback: () => {
			//Comment so the linter doesn't complain
		}
	} as any

	Object.assign(opts, _opts)

	return opts
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- dom/MultiTermEditUI -***-')
	test.end()
})

tape('Default Multi term edit UI', async test => {
	test.timeoutAfter(1000)

	const holder = getHolder() as any
	const testOpts = getTestOpts({ holder })
	const ui = new MultiTermWrapperEditUI(testOpts)
	await ui.renderUI()

	const menu = holder.selectAll('div[data-testid="sjpp-multi-tw-edit-ui"]')._parents
	test.equal(menu.length, 1, 'Should render edit UI')

	const header = ui.dom.header.node()
	test.ok(header && header.textContent == testOpts.headerText, 'Should render header with custom text')

	test.equal(holder.selectAll('.sja_filter_tag_btn.add_term_btn').size(), 1, 'Should render add term (+) button')

	const submitBtn = ui.dom.submitBtn.node()
	test.ok(
		submitBtn && submitBtn.textContent == testOpts.buttonLabel && submitBtn!.disabled,
		'Should render disabled submit button with custom text'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Render with terms and .maxNum', async test => {
	test.timeoutAfter(1000)

	const holder = getHolder() as any
	const testOpts = getTestOpts({
		holder,
		maxNum: 3,
		twList: [{ term: termjson['agedx'] }, { term: termjson['os'] }, { term: termjson['Arrhythmias'] }]
	})
	const ui = new MultiTermWrapperEditUI(testOpts)
	await ui.renderUI()

	const pills = await detectGte({
		elem: ui.dom.tws.node(),
		selector: '.term_name_btn',
		count: 3
	})
	test.equal(pills.length, 3, 'Should render 3 term pills')
	test.equal(pills.filter(p => p.classList.contains('add_term_btn')).length, 0, 'Should not render add term (+) button')

	const submitBtn = ui.dom.submitBtn.node()
	test.equal(submitBtn?.disabled, false, 'Should enable submit button when terms are selected')

	test.equal(ui.dom.footer.node()?.innerHTML, '3 terms selected', 'Should render footer with term count')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('All terms cleared', async test => {
	test.timeoutAfter(1000)

	const holder = getHolder() as any
	const testOpts = getTestOpts({
		holder,
		maxNum: 3,
		twList: [{ term: termjson['agedx'] }, { term: termjson['os'] }, { term: termjson['Arrhythmias'] }]
	})
	const ui = new MultiTermWrapperEditUI(testOpts)
	await ui.renderUI()

	ui.twList = []
	ui.update(ui)

	const submitBtn = ui.dom.submitBtn.node()
	test.equal(submitBtn?.disabled, false, 'Should enable submit button when all input terms are removed')

	test.equal(ui.dom.footer.node()?.innerHTML, 'Terms removed', 'Should show user message when terms are removed')

	if (test['_ok']) holder.remove()
	test.end()
})
