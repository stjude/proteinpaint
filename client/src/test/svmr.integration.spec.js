import tape from 'tape'
import * as d3s from 'd3-selection'
import { runproteinpaint } from '../../test/front.helpers'
import { sleep } from '../../test/test.helpers.js'
import { type2lst } from '../svmr.c.js'
import card from '../../../front/public/cards/fusioneditor.json'

/****************
Fusion Editor integration tests

Uses the example input of the Fusion Editor card in the app drawer, front/public/cards/fusioneditor.json:
hg38, one sample, 47 products, 2 of them without a rating. Runs on hg38-test, whose gene database has none of the example isoforms,
so it also tests that the editor still shows all products without gene models.

- example input renders on hg38-test
- type menu of a product lists the accepted terms and changes the product type
- rating menu of a product without a rating selects NA
*****************/

const call = card.ppcalls.find(c => c.runargs?.fusioneditor?.input)
const fusionInput = call?.runargs.fusioneditor.input || ''

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

async function waitFor(fn, maxTime = 15000) {
	const start = Date.now()
	while (Date.now() - start < maxTime) {
		const v = fn()
		if (v) return v
		await sleep(100)
	}
	return null
}

// collect uncaught errors while the editor runs, the editor has no callback to report them
function catchErrors() {
	const errors = []
	const onError = e => errors.push(e.message || String(e.error))
	const onRejection = e => errors.push(e.reason?.message || String(e.reason))
	window.addEventListener('error', onError)
	window.addEventListener('unhandledrejection', onRejection)
	return {
		errors,
		stop() {
			window.removeEventListener('error', onError)
			window.removeEventListener('unhandledrejection', onRejection)
		}
	}
}

// the editor is loaded once and shared by the tests below
let holder
async function loadEditor() {
	if (holder) return holder
	holder = getHolder()
	runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38-test',
		fusioneditor: { input: fusionInput, dataname: 'test' }
	})
	// the sample button is labeled with the sample count after all products are shown
	await waitFor(() => [...holder.querySelectorAll('button')].find(b => b.textContent == '1 sample'))
	return holder
}

const typeLabels = new Set(type2lst.map(t => t.label))
function getTypeTexts(holder) {
	return [...holder.querySelectorAll('svg text')].filter(
		t => typeLabels.has(t.textContent) || t.textContent == 'Intronic'
	)
}

tape('\n', function (test) {
	test.comment('-***- Fusion Editor -***-')
	test.end()
})

tape('example input renders on hg38-test', async test => {
	test.timeoutAfter(20000)
	test.ok(fusionInput, 'should find the example input in the Fusion Editor card')
	test.equal(call.runargs.genome, 'hg38', 'should have hg38 as the card genome')

	const caught = catchErrors()
	const holder = await loadEditor()
	caught.stop()
	test.deepEqual(caught.errors, [], 'should not throw')

	const buttons = [...holder.querySelectorAll('button')].map(b => b.textContent)
	test.ok(buttons.includes('1 sample'), 'should show the sample count')

	const errorText = [...holder.querySelectorAll('.sja_errorbar')].map(e => e.textContent).join('\n')
	test.ok(
		/\d+ invalid isoforms/.test(errorText),
		'should report the isoforms missing from the hg38-test gene database: ' + errorText.slice(0, 80)
	)

	// the same as on the full hg38 genome, as the grouping does not depend on gene models
	test.deepEqual(
		[...holder.querySelectorAll('.sja_clb2')].map(b => b.textContent.replace(/\s+/g, ' ')),
		['HQ in-frame 7', 'HQ truncation 8', 'LQ in-frame 10', 'LQ truncation 8', 'NA in-frame 2'],
		'should show the number of events of each rating and category'
	)

	const typeTexts = getTypeTexts(holder)
	test.ok(typeTexts.length > 0, 'should show the functional effect of products')
	for (const label of [
		'ENHANCER_PROX',
		'GENE_PROX',
		'GENIC',
		'HALF_INTERGENIC',
		'INTERGENIC',
		'Intronic',
		'INVERTED_REPEAT',
		'TRUNCATING'
	]) {
		test.ok(
			typeTexts.some(t => t.textContent == label),
			`should show a product with ${label}`
		)
	}
	test.end()
})

// hovering over the genes of a product row shows the product edit menu
async function openProductMenu(rowText) {
	const rowRects = rowText.parentNode.querySelectorAll('rect[fill-opacity="0"]')
	const rect = rowRects[rowRects.length - 1]
	rect.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
	// identify the menus by an option that only one of them has
	const findSelect = value =>
		[...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value == value))
	await waitFor(() => findSelect('HALF_INTERGENIC'))
	return {
		typeSelect: findSelect('HALF_INTERGENIC'),
		ratingSelect: findSelect('Major'),
		close: () => rect.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
	}
}

function change(select, value) {
	select.value = value
	select.dispatchEvent(new Event('change'))
}

tape('type menu of a product lists the accepted terms and changes the product type', async test => {
	test.timeoutAfter(20000)
	const holder = await loadEditor()
	const label = getTypeTexts(holder).find(t => t.textContent == 'GENE_PROX')
	if (!label) {
		test.fail('should find a product with GENE_PROX')
		return test.end()
	}
	const menu = await openProductMenu(label)
	if (!menu.typeSelect) {
		test.fail('should show the type menu')
		return test.end()
	}
	test.deepEqual(
		[...menu.typeSelect.options].map(o => o.value),
		type2lst.map(t => t.label),
		'should list the accepted terms'
	)
	test.equal(menu.typeSelect.value, 'GENE_PROX', 'should select the type of the product')

	change(menu.typeSelect, 'ITD')
	test.equal(label.textContent, 'ITD', 'should show the new type in the product row')
	change(menu.typeSelect, 'GENE_PROX')
	test.equal(label.textContent, 'GENE_PROX', 'should show the type that is changed back')

	test.equal(menu.ratingSelect?.value, 'HQ', 'should select the rating of the product')
	menu.close()
	test.end()
})

tape('rating menu of a product without a rating selects NA', async test => {
	test.timeoutAfter(20000)
	const holder = await loadEditor()
	// the rating is the first text of a product row
	const naTexts = [...holder.querySelectorAll('svg text')].filter(t => t.textContent == 'NA')
	test.equal(naTexts.length, 2, 'should show NA as the rating of the 2 products without a rating')
	if (!naTexts.length) return test.end()

	const menu = await openProductMenu(naTexts[0])
	if (!menu.ratingSelect) {
		test.fail('should show the rating menu')
		return test.end()
	}
	test.deepEqual(
		[...menu.ratingSelect.options].map(o => o.value),
		['HQ', 'LQ', 'RT', 'bad', 'Major', 'NA'],
		'should list the ratings'
	)
	test.equal(menu.ratingSelect.value, 'NA', 'should select NA')
	change(menu.ratingSelect, 'LQ')
	test.equal(naTexts[0].textContent, 'LQ', 'should show the new rating in the product row')
	change(menu.ratingSelect, 'NA')
	test.equal(naTexts[0].textContent, 'NA', 'should show the rating that is changed back')
	menu.close()
	if (test._ok) holder.remove()
	test.end()
})
