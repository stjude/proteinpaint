import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../termCollection.ts'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

function getTermCollectionDetails(overrides: any = {}) {
	return {
		name: 'Test Collection',
		type: 'gene',
		memberType: 'gene',
		termlst: [
			{ id: 'gene1', name: 'TP53', values: { tissue: 'Lung' } },
			{ id: 'gene2', name: 'KRAS', values: { tissue: 'Colon' } },
			{ id: 'gene3', name: 'BRCA1', values: { tissue: 'Breast' } }
		],
		categoryKeys: [
			{ key: 'tissue', shown: true },
			{ key: 'expression', shown: false }
		],
		propsByTermId: {
			gene1: { color: '#FF0000' },
			gene2: { color: '#00FF00' }
		},
		...overrides
	}
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/termCollection -***-')
	test.end()
})

tape('init() should render term list table with all terms from details.termlst', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails()

	await handler.init({
		holder,
		callback: () => {},
		app: {},
		details
	})

	const table = holder.select('table')
	test.ok(table.node(), 'Should render a table')

	const rows = table.selectAll('tbody tr')
	test.equal(rows.size(), 3, 'Should render three rows for three terms')

	const rowTexts = rows.nodes().map((row: any) => row.textContent.trim())
	test.ok(rowTexts[0].includes('TP53'), 'First row should contain TP53')
	test.ok(rowTexts[1].includes('KRAS'), 'Second row should contain KRAS')
	test.ok(rowTexts[2].includes('BRCA1'), 'Third row should contain BRCA1')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should render category table when details.categoryKeys is present', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails()

	await handler.init({
		holder,
		callback: () => {},
		app: {},
		details
	})

	const tables = holder.selectAll('table')
	test.equal(tables.size(), 2, 'Should render two tables when categoryKeys is present')

	const categoryTable = tables.nodes()[1]
	const categoryRows = d3s.select(categoryTable).selectAll('tbody tr')
	test.equal(categoryRows.size(), 2, 'Should render two rows for two categories')

	const categoryTexts = categoryRows.nodes().map((row: any) => row.textContent.trim())
	test.ok(categoryTexts[0].includes('tissue'), 'Should display tissue category key')
	test.ok(categoryTexts[1].includes('expression'), 'Should display expression category key')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should call callback with selected terms, categoryKeys, and properties', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails()
	let callbackResult: any

	await handler.init({
		holder,
		callback: result => {
			callbackResult = result
		},
		app: {},
		details
	})

	// Simulate selecting first two terms
	const termsTable = holder.selectAll('table').nodes()[0] as HTMLElement
	const checkboxes = termsTable.querySelectorAll('tbody input[type="checkbox"]')
	;(checkboxes[0] as any).checked = true
	;(checkboxes[1] as any).checked = true
	;(checkboxes[2] as any).checked = false

	// Simulate category selection state
	const categoryTable = holder.selectAll('table').nodes()[1] as HTMLElement
	const categoryCheckboxes = categoryTable.querySelectorAll('tbody input[type="checkbox"]')
	;(categoryCheckboxes[0] as any).checked = true
	;(categoryCheckboxes[1] as any).checked = false

	// Click Select button
	const selectBtn = holder.select('[data-testid="sjpp-term-collection-select"]').node() as any
	selectBtn.click()

	test.equal(callbackResult?.type, 'termCollection', 'Should set type to termCollection')
	test.equal(callbackResult?.name, 'Test Collection', 'Should pass collection name')
	test.equal(callbackResult?.memberType, 'gene', 'Should pass memberType')
	test.deepEqual(callbackResult?.termIds, ['gene1', 'gene2'], 'Should pass selected term IDs')
	test.equal(callbackResult?.termlst.length, 2, 'Should pass selected term list with correct length')
	test.equal(callbackResult?.termlst[0].name, 'TP53', 'First selected term should be TP53')
	test.equal(callbackResult?.termlst[1].name, 'KRAS', 'Second selected term should be KRAS')
	test.deepEqual(
		callbackResult?.categoryKeys,
		[
			{ key: 'tissue', shown: true },
			{ key: 'expression', shown: false }
		],
		'Should pass updated categoryKeys with shown status'
	)
	test.deepEqual(
		callbackResult?.propsByTermId,
		{ gene1: { color: '#FF0000' }, gene2: { color: '#00FF00' } },
		'Should pass propsByTermId for selected terms only'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should not render category table when details.categoryKeys is missing', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails({ categoryKeys: undefined })

	await handler.init({
		holder,
		callback: () => {},
		app: {},
		details
	})

	const tables = holder.selectAll('table')
	test.equal(tables.size(), 1, 'Should render only one table when categoryKeys is missing')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() disables the Select button for an invalid collection', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails()
	let callbackResult: any

	await handler.init({
		holder,
		callback: result => {
			callbackResult = result
		},
		app: {},
		details
	})

	const selectBtn = holder.select('[data-testid="sjpp-term-collection-select"]').node() as HTMLButtonElement
	const getChecks = (tableIdx: number) =>
		[
			...(holder.selectAll('table').nodes()[tableIdx] as HTMLElement).querySelectorAll('tbody input[type="checkbox"]')
		] as HTMLInputElement[]
	const terms = () => getChecks(0)
	const categories = () => getChecks(1)

	test.equal(selectBtn.disabled, false, 'enables the button for the default selection')

	terms()[0].click() // deselect TP53, leaving two variables
	test.equal(selectBtn.disabled, false, 'stays enabled with two selected variables')
	terms()[1].click() // deselect KRAS, leaving a lone variable
	test.equal(selectBtn.disabled, true, 'disables the button with a single selected variable')
	test.ok(`${selectBtn.title}`.includes('two variables'), `titles the button with the reason: ${selectBtn.title}`)
	selectBtn.click()
	test.equal(callbackResult, undefined, 'a disabled button does not submit the selection')

	terms()[1].click() // restore KRAS
	test.equal(selectBtn.disabled, false, 're-enables the button with two selected variables')
	categories()[0].click()
	test.equal(selectBtn.disabled, false, 'stays enabled with one selected category')
	categories()[1].click()
	test.equal(selectBtn.disabled, true, 'disables the button without a selected category')
	test.ok(`${selectBtn.title}`.includes('category'), `titles the button with the reason: ${selectBtn.title}`)

	categories()[1].click() // restore the category
	test.equal(selectBtn.disabled, false, 're-enables the button for a valid collection')
	selectBtn.click()
	test.deepEqual(callbackResult?.termIds, ['gene2', 'gene3'], 'submits the selected variables')
	test.deepEqual(
		callbackResult?.categoryKeys,
		[
			{ key: 'tissue', shown: false },
			{ key: 'expression', shown: true }
		],
		'submits the selected categories'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('fraction selection returns a raw fraction wrapper and retains every member', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails({
		type: 'numeric',
		memberType: 'numeric',
		categoryKeys: undefined
	})
	let callbackResult: any

	await handler.init({
		holder,
		callback: result => {
			callbackResult = result
		},
		app: {},
		details,
		usecase: { target: 'barchart', detail: 'term2' },
		termCollectionSelectionMode: 'fraction'
	})

	test.ok(holder.text().includes('Denominator'), 'renders the denominator selector')
	test.ok(holder.text().includes('Numerator'), 'renders the numerator selector')
	const rows = holder.selectAll('tbody tr').nodes() as HTMLElement[]
	const numerator = rows[1].querySelector('[data-testid="sjpp-term-collection-numerator"]') as HTMLInputElement
	numerator.click()
	;(holder.select('[data-testid="sjpp-term-collection-fraction-select"]').node() as HTMLButtonElement).click()

	test.equal(callbackResult?.type, 'TermCollectionTWFraction', 'returns a fraction wrapper')
	test.deepEqual(callbackResult?.q.denominators, ['gene1', 'gene2', 'gene3'], 'defaults all members as denominators')
	test.deepEqual(callbackResult?.q.numerators, ['gene1', 'gene2'], 'returns the selected numerators')
	test.equal(callbackResult?.term.termlst.length, 3, 'keeps the complete source member list')
	test.deepEqual(callbackResult?.term.termIds, ['gene1', 'gene2', 'gene3'], 'keeps every source member ID')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('fraction selection clears and disables the numerator of a deselected denominator', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()
	const details = getTermCollectionDetails({
		type: 'numeric',
		memberType: 'numeric',
		categoryKeys: undefined
	})
	let callbackResult: any

	await handler.init({
		holder,
		callback: result => {
			callbackResult = result
		},
		app: {},
		details,
		usecase: { target: 'barchart', detail: 'term2' },
		termCollectionSelectionMode: 'fraction'
	})

	const getNumerators = () =>
		holder.selectAll('[data-testid="sjpp-term-collection-numerator"]').nodes() as HTMLInputElement[]
	const getDenominators = () =>
		holder.selectAll('[data-testid="sjpp-term-collection-denominator"]').nodes() as HTMLInputElement[]

	// gene1 is the default numerator, deselecting it as a denominator leaves no numerator
	getDenominators()[0].click()
	test.equal(getNumerators()[0].checked, false, 'clears the numerator of a deselected denominator')
	test.equal(getNumerators()[0].disabled, true, 'disables the numerator of a deselected denominator')

	const selectBtn = holder.select('[data-testid="sjpp-term-collection-fraction-select"]').node() as HTMLButtonElement
	test.equal(selectBtn.disabled, true, 'disables the Select button without a numerator')
	selectBtn.click()
	test.equal(callbackResult, undefined, 'does not submit a fraction without a numerator')

	getDenominators()[0].click() // restore the denominator
	test.equal(getNumerators()[0].disabled, false, 'enables the numerator when its denominator is restored')
	test.equal(getNumerators()[0].checked, false, 'does not silently restore the numerator')
	getNumerators()[1].click()
	;(holder.select('[data-testid="sjpp-term-collection-fraction-select"]').node() as HTMLButtonElement).click()
	test.deepEqual(callbackResult?.q.numerators, ['gene2'], 'submits the edited numerator selection')
	test.deepEqual(
		callbackResult?.q.denominators,
		['gene1', 'gene2', 'gene3'],
		'submits the restored denominator selection'
	)

	if (test['_ok']) holder.remove()
	test.end()
})
