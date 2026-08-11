import tape from 'tape'
import { renderVariantConfig } from '../variantConfig'
import type { TermValues, BaseValue } from '#types'
import { select } from 'd3-selection'
import { detectGt } from '../../test/test.helpers.js'

/*
test sections:
    - basic render: snvindel
	- basic render: cnv
    - callback
    - unselect values
    - preselected values
    - wildtype toggle
	- not tested toggle
	- no mutations
    - single mutation count
    - multiple mutation count
	- maf filter
	- specific variants (mnames) render
	- specific variants (mnames) callback
	- preselected specific variant
	- filter variant list by checked classes
	- check-all box respects class filter
	- classes are used when no variant is checked
	- checked variant overrides other checked classes
	- variants of multiple classes override class selection
	- variant table cell content
	- wildtype ignores checked variants
	- variant list stays folded on class change; count ignores selection
*/

tape('\n', test => {
	test.comment('-***- dom/variantConfig unit tests-***-')
	test.end()
})

tape('basic render: snvindel', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: () => {}
	})

	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio = genotypeDiv.selectAll('input[type="radio"]').nodes()
	test.equal(genotypeRadio.length, 3, 'should render 3 genotype radio buttons')

	const variantsDiv = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const table = variantsDiv.select('table')
	const rows = table.select('tbody').selectAll('tr')
	test.equal(rows.nodes().length, Object.keys(values).length, 'all variants should appear in table')
	const checkboxes = rows.selectAll('input[type="checkbox"]')
	const checked = checkboxes.nodes().filter((c: any) => c.checked)
	test.equal(checked.length, Object.keys(values).length, 'all rows should be checked')

	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	test.equal(countRadio.length, 3, 'should render 3 mutation count radio buttons')
	const selectedCount = countRadio.find(r => r.checked)
	test.equal(selectedCount.value, 'any', 'selected radio button should be any')

	const applyBtn = holder.select('button').node()
	test.ok(applyBtn, 'should render apply button')

	holder.remove()
	test.end()
})

tape('basic render: cnv', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values: values2,
		dt: 4,
		callback: () => {}
	})

	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio = genotypeDiv.selectAll('input[type="radio"]').nodes()
	test.equal(genotypeRadio.length, 3, 'should render 3 genotype radio buttons')

	const variantsDiv = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const table = variantsDiv.select('table')
	const rows = table.select('tbody').selectAll('tr')
	test.equal(rows.nodes().length, Object.keys(values2).length, 'all variants should appear in table')
	const checkboxes = rows.selectAll('input[type="checkbox"]')
	const checked = checkboxes.nodes().filter((c: any) => c.checked)
	test.equal(checked.length, Object.keys(values2).length, 'all rows should be checked')

	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	test.equal(countRadio.length, 0, 'should not render mutation count radio buttons')

	const applyBtn = holder.select('button').node()
	test.ok(applyBtn, 'should render apply button')

	holder.remove()
	test.end()
})

tape('callback', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
			{ key: 'N', label: 'NONSENSE', value: 'N' },
			{ key: 'D', label: 'PROTEINDEL', value: 'D' }
		],
		genotype: 'variant',
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have all variants')

	holder.remove()
	test.end()
})

tape('unselect values', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const table = holder.select('table')
	const checkboxes = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	checkboxes.forEach((d: any, i) => {
		// unselect the last two variants
		if (i == 2 || i == 3) d.click()
	})

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		genotype: 'variant',
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have 2 variants')

	holder.remove()
	test.end()
})

tape('preselected values', test => {
	const holder = select(document.body).append('div')
	let newConfig

	const selectedValues: BaseValue[] = Object.entries(values)
		.map(([k, v]) => {
			return { key: k, label: v.label, value: k }
		})
		.filter((v, i) => i == 0 || i == 1)

	renderVariantConfig({
		holder,
		values,
		selectedValues,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const table = holder.select('table')
	const rows = table.select('tbody').selectAll('tr')
	const checkboxes = rows.selectAll('input[type="checkbox"]')
	const checked = checkboxes.nodes().filter((c: any) => c.checked)
	test.equal(checked.length, 2, '2 rows should be checked')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		genotype: 'variant',
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have 2 variants')

	holder.remove()
	test.end()
})

tape('wildtype toggle', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio: any = genotypeDiv.selectAll('input[type="radio"]').nodes()
	test.equal(genotypeRadio.length, 3, 'should render 3 genotype radio buttons')
	const selectedGenotype: any = genotypeRadio.find((r: any) => r.checked)
	test.equal(selectedGenotype.value, 'variant', 'selected genotype should be variant')

	const variantsDiv: any = holder.select('[data-testid="sjpp-variantConfig-variant"]').node()
	test.equal(window.getComputedStyle(variantsDiv).display, 'block', 'should display variants div')

	// select wildtype genotype
	genotypeRadio.find(r => r.value == 'wt').click()
	test.equal(window.getComputedStyle(variantsDiv).display, 'none', 'should not display variants div')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [],
		genotype: 'wt'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have wildtype genotype')

	holder.remove()
	test.end()
})

tape('not tested toggle', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio: any = genotypeDiv.selectAll('input[type="radio"]').nodes()

	const variantsDiv: any = holder.select('[data-testid="sjpp-variantConfig-variant"]').node()
	test.equal(window.getComputedStyle(variantsDiv).display, 'block', 'should display variants div')

	// select not tested genotype
	genotypeRadio.find(r => r.value == 'nt').click()
	test.equal(window.getComputedStyle(variantsDiv).display, 'none', 'should not display variants div')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [],
		genotype: 'nt'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have not tested genotype')

	holder.remove()
	test.end()
})

tape('no mutations', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values: {},
		dt: 1,
		callback: () => {}
	})

	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio: any = genotypeDiv.selectAll('input[type="radio"]').nodes()
	test.equal(genotypeRadio.length, 3, 'should render 3 genotype radio buttons')
	const selectedGenotype: any = genotypeRadio.find((r: any) => r.checked)
	test.equal(selectedGenotype.value, 'variant', 'selected genotype should be variant')

	const variantsDiv: any = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const table = variantsDiv.select('table').node()
	test.notOk(table, 'should not display variants table')
	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	test.equal(countRadio.length, 0, 'should not display mutation count radio buttons')

	test.equal(variantsDiv.text(), 'No SNV/indel found', 'should display no SNV/indel found message')

	const applyBtn: any = holder.select('button')
	test.ok(applyBtn.property('disabled'), 'apply button should be disabled')

	// select wildtype genotype
	genotypeRadio.find(r => r.value == 'wt').click()
	test.notOk(applyBtn.property('disabled'), 'apply button should not be disabled')

	holder.remove()
	test.end()
})

tape('single mutation count', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const variantsDiv = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	// select single mutation count
	countRadio.find(r => r.value == 'single').click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	test.equal(newConfig.mcount, 'single', 'mcount should be single')

	holder.remove()
	test.end()
})

tape('multiple mutation count', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const variantsDiv = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	// select multiple mutation count
	countRadio.find(r => r.value == 'multiple').click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	test.equal(newConfig.mcount, 'multiple', 'mcount should be multiple')

	holder.remove()
	test.end()
})

tape('maf filter', async test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		dt: 1,
		mafFilter,
		callback: config => (newConfig = config)
	})

	const variantsDiv = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const mafFilterDiv = variantsDiv.select('.sja_filter_container')
	const tvsPills = await detectGt({ target: mafFilterDiv.node(), selector: '.tvs_pill' })
	test.equal(tvsPills.length, 2, 'should render 2 maf tvs pills')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	test.deepEqual(newConfig.mafFilter, activeMafFilter, 'should set .mafFilter in config')

	holder.remove()
	test.end()
})

tape('specific variants (mnames) render', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: () => {}
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	test.ok(section.node(), 'should render specific variants section')

	const toggle: any = section.select('div').node()
	const listWrapper: any = toggle.nextSibling
	test.ok(toggle.textContent.includes(`(${mnames.length})`), 'toggle label should quote the variant count')
	test.equal(window.getComputedStyle(listWrapper).display, 'none', 'list should be collapsed by default')
	toggle.click()
	test.equal(window.getComputedStyle(listWrapper).display, 'block', 'list should expand on toggle click')

	// variant checkboxes live in the table body (thead holds the check-all box)
	const checkboxes = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	test.equal(checkboxes.length, mnames.length, 'all specific variants should appear in list')
	const checked = checkboxes.filter((c: any) => c.checked)
	test.equal(checked.length, 0, 'no specific variants should be checked by default')

	holder.remove()
	test.end()
})

tape('specific variants (mnames) callback', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	// check the G12D checkbox
	const checkboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	checkboxes[0].click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		genotype: 'variant',
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'checked specific variant should override all checked classes')

	holder.remove()
	test.end()
})

tape('preselected specific variant', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames,
		selectedValues: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		dt: 1,
		callback: config => (newConfig = config)
	})

	// the class of the selected specific variant should be checked
	const table = holder.select('table')
	const classCheckboxes = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const checkedClasses = classCheckboxes.filter((c: any) => c.checked)
	test.equal(checkedClasses.length, 1, 'only the class of the selected variant should be checked')
	test.equal((classCheckboxes[0] as any).checked, true, 'the checked class should be MISSENSE')

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const toggle: any = section.select('div').node()
	const listWrapper: any = toggle.nextSibling
	test.equal(
		window.getComputedStyle(listWrapper).display,
		'block',
		'list should be expanded when a variant is selected'
	)
	const checkboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const checked = checkboxes.filter((c: any) => c.checked)
	test.equal(checked.length, 1, 'the preselected specific variant should be checked')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		genotype: 'variant',
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have only the specific variant')

	holder.remove()
	test.end()
})

tape('filter variant list by checked classes', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: () => {}
	})

	const table = holder.select('table')
	const classCheckboxes: any = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	// expand the list
	const toggle: any = section.select('div').node()
	toggle.click()
	// variant rows of the list table (mnames fixture order: G12D/M, G12V/M, K100fs/F)
	const trs: any = section.select('tbody').selectAll('tr').nodes()
	const mnameCheckboxes: any = trs.map((tr: any) => tr.querySelector('input[type="checkbox"]'))
	const rowDisplays = () => trs.map((tr: any) => window.getComputedStyle(tr).display)

	test.deepEqual(
		rowDisplays(),
		['table-row', 'table-row', 'table-row'],
		'all variants visible when all classes are checked'
	)
	test.ok(toggle.textContent.includes('(3)'), 'toggle label should quote 3 variants')

	// uncheck FRAMESHIFT class
	classCheckboxes[1].click()
	test.deepEqual(
		rowDisplays(),
		['table-row', 'table-row', 'none'],
		'frameshift variant hidden when its class is unchecked'
	)
	test.ok(toggle.textContent.includes('(2)'), 'toggle label should update to 2 variants')

	// check the G12D variant, then uncheck MISSENSE class
	mnameCheckboxes[0].click()
	classCheckboxes[0].click()
	test.deepEqual(rowDisplays(), ['none', 'none', 'none'], 'missense variants hidden when their class is unchecked')
	test.equal(mnameCheckboxes[0].checked, false, 'unchecking a class should clear its checked variants')

	// uncheck remaining classes; with no class checked, the variant list is cleared
	classCheckboxes[2].click()
	classCheckboxes[3].click()
	test.deepEqual(rowDisplays(), ['none', 'none', 'none'], 'variant list cleared when no class is checked')
	test.ok(toggle.textContent.includes('(0)'), 'toggle label should update to 0 variants')

	// re-checking a class restores its variants, unchecked
	classCheckboxes[0].click()
	test.deepEqual(
		rowDisplays(),
		['table-row', 'table-row', 'none'],
		'missense variants shown again when class is re-checked'
	)
	test.equal(mnameCheckboxes[0].checked, false, 'restored variant should remain unchecked')
	test.ok(toggle.textContent.includes('(2)'), 'toggle label should update to 2 variants again')

	holder.remove()
	test.end()
})

tape('check-all box respects class filter', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const table = holder.select('table')
	const classCheckboxes: any = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	// uncheck FRAMESHIFT class, then check all variants via the check-all box
	classCheckboxes[1].click()
	const checkAll: any = section.select('thead').select('input[type="checkbox"]').node()
	checkAll.click()

	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	test.equal(mnameCheckboxes[0].checked, true, 'visible G12D should be checked')
	test.equal(mnameCheckboxes[1].checked, true, 'visible G12V should be checked')
	test.equal(mnameCheckboxes[2].checked, false, 'hidden frameshift variant should not stay checked')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' },
			{ key: 'M', label: 'G12V', value: 'G12V', mname: 'G12V' }
		],
		genotype: 'variant',
		mcount: 'any'
	}
	test.deepEqual(newConfig, expectedConfig, 'only the visible checked variants are used, classes are overridden')

	holder.remove()
	test.end()
})

tape('classes are used when no variant is checked', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// variants are available but none is checked, so the class selection applies
	renderVariantConfig({
		holder,
		values,
		mnames,
		selectedValues: [
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		dt: 1,
		callback: config => (newConfig = config)
	})

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'MISSENSE', value: 'M' },
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
		],
		genotype: 'variant',
		mcount: 'any'
	}
	test.deepEqual(newConfig, expectedConfig, 'apply should reproduce the class-only selection')

	holder.remove()
	test.end()
})

tape('checked variant overrides other checked classes', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// a legacy selection mixing a class-wide entry and a specific variant
	renderVariantConfig({
		holder,
		values,
		mnames,
		selectedValues: [
			{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
			{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }
		],
		dt: 1,
		callback: config => (newConfig = config)
	})

	const table = holder.select('table')
	const classCheckboxes: any = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const checkedClasses = classCheckboxes.filter((c: any) => c.checked)
	test.equal(checkedClasses.length, 2, 'both selected classes should be checked')

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	test.equal(mnameCheckboxes[0].checked, true, 'the selected variant should be checked')

	// apply without touching anything
	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		genotype: 'variant',
		mcount: 'any'
	}
	test.deepEqual(newConfig, expectedConfig, 'checked variant should be used alone, dropping the class-wide entry')

	// unchecking the variant falls back to the checked classes
	mnameCheckboxes[0].click()
	applyBtn.click()
	test.deepEqual(
		newConfig,
		{
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' }
			],
			genotype: 'variant',
			mcount: 'any'
		},
		'unchecking the variant should fall back to the checked classes'
	)

	holder.remove()
	test.end()
})

tape('variants of multiple classes override class selection', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	// check G12D (missense) and K100fs (frameshift)
	mnameCheckboxes[0].click()
	mnameCheckboxes[2].click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' },
			{ key: 'F', label: 'K100fs', value: 'K100fs', mname: 'K100fs' }
		],
		genotype: 'variant',
		mcount: 'any'
	}
	test.deepEqual(newConfig, expectedConfig, 'only the checked variants are used, across classes')

	holder.remove()
	test.end()
})

tape('variant table cell content', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: () => {}
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const tr: any = section.select('tbody').select('tr').node()
	const tds = tr.querySelectorAll('td')
	test.equal(tds.length, 4, 'row should have a checkbox cell plus 3 data cells')
	test.deepEqual(
		[tds[1].textContent, tds[2].textContent, tds[3].textContent],
		['G12D', 'MISSENSE', '5'],
		'cells should show variant, class label and sample count'
	)

	holder.remove()
	test.end()
})

tape('wildtype ignores checked variants', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	mnameCheckboxes[0].click()

	// switch to wildtype genotype
	const genotypeDiv = holder.select('[data-testid="sjpp-variantConfig-genotype"]')
	const genotypeRadio: any = genotypeDiv.selectAll('input[type="radio"]').nodes()
	genotypeRadio.find((r: any) => r.value == 'wt').click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [],
		genotype: 'wt'
	}
	test.deepEqual(newConfig, expectedConfig, 'wildtype config should not include checked variants')

	holder.remove()
	test.end()
})

tape('variant list stays folded on class change; count ignores selection', test => {
	const holder = select(document.body).append('div')

	renderVariantConfig({
		holder,
		values,
		mnames,
		dt: 1,
		callback: () => {}
	})

	const table = holder.select('table')
	const classCheckboxes: any = table.select('tbody').selectAll('input[type="checkbox"]').nodes()
	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const toggle: any = section.select('div').node()
	const listWrapper: any = toggle.nextSibling

	// uncheck FRAMESHIFT class while the list is folded
	classCheckboxes[1].click()
	test.equal(window.getComputedStyle(listWrapper).display, 'none', 'list should stay folded after a class change')
	test.ok(toggle.textContent.includes('(2)'), 'count should update while folded')

	// checking a variant does not change the quoted count
	toggle.click()
	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	mnameCheckboxes[0].click()
	test.ok(toggle.textContent.includes('(2)'), 'count should reflect visible variants, not selections')

	holder.remove()
	test.end()
})

/*********
Variables
*********/

const values: TermValues = {
	M: { key: 'M', label: 'MISSENSE' },
	F: { key: 'F', label: 'FRAMESHIFT' },
	N: { key: 'N', label: 'NONSENSE' },
	D: { key: 'D', label: 'PROTEINDEL' }
}

// amino acid changes, sorted by descending sample count
const mnames = [
	{ mname: 'G12D', class: 'M', samplecount: 5 },
	{ mname: 'G12V', class: 'M', samplecount: 3 },
	{ mname: 'K100fs', class: 'F', samplecount: 1 }
]

const values2: TermValues = {
	CNV_amp: { key: 'CNV_amp', label: 'Gain' },
	CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' },
	CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' }
}

const activeMafFilter = {
	type: 'tvslst',
	join: 'or',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }],
				term: {
					id: 'tumor_DNA_WGS',
					name: 'Tumor WGS',
					parent_id: null,
					isleaf: true,
					type: 'float',
					min: 0,
					max: 1
				}
			}
		},
		{
			type: 'tvs',
			tvs: {
				ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }],
				term: {
					id: 'tumor_DNA_WES',
					name: 'Tumor WES',
					parent_id: null,
					isleaf: true,
					type: 'float',
					min: 0,
					max: 1
				}
			}
		}
	]
}

const mafFilter = {
	filter: activeMafFilter,
	terms: [
		{
			id: 'tumor_DNA_WGS',
			name: 'Tumor WGS',
			parent_id: null,
			isleaf: true,
			type: 'float',
			min: 0,
			max: 1,
			tvs: {
				ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }]
			}
		},
		{
			id: 'tumor_DNA_WES',
			name: 'Tumor WES',
			parent_id: null,
			isleaf: true,
			type: 'float',
			min: 0,
			max: 1,
			tvs: {
				ranges: [{ start: 0.1, startinclusive: true, stopunbounded: true }]
			}
		}
	],
	active: activeMafFilter
}
