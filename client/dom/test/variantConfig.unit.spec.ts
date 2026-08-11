import tape from 'tape'
import { renderVariantConfig } from '../variantConfig'
import { Menu } from '../menu'
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
	- gene column for variants of a geneset term
	- no gene column for a single gene term
	- selected variant absent from current data is preserved
	- preserved variant of a class absent from current data
	- preserved variant with gene
	- breakpoint controls are not offered for snvindel
	- breakpoint controls need a gene model source
	- breakpoint controls render for a sv term
	- breakpoint control for a term of multiple genes
	- registered breakpoint ranges are displayed
	- breakpoint ranges are applied
	- breakpoint range is not applied for an unchecked variant
	- no breakpoint range key for a snvindel
	- breakpoint menu does not hide the menu it is opened from
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

tape('gene column for variants of a geneset term', test => {
	const holder = select(document.body).append('div')
	let newConfig

	renderVariantConfig({
		holder,
		values,
		mnames: genesetMnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const tr: any = section.select('tbody').select('tr').node()
	const tds = tr.querySelectorAll('td')
	test.equal(tds.length, 5, 'row should have a checkbox cell plus 4 data cells')
	test.deepEqual(
		[tds[1].textContent, tds[2].textContent, tds[3].textContent, tds[4].textContent],
		['KRAS', 'G12D', 'MISSENSE', '5'],
		'cells should show gene, variant, class label and sample count'
	)

	// check KRAS G12D and NRAS G12D, which share the same amino acid change
	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	mnameCheckboxes[0].click()
	mnameCheckboxes[2].click()

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [
			{ key: 'M', label: 'KRAS G12D', value: 'G12D', mname: 'G12D', gene: 'KRAS' },
			{ key: 'M', label: 'NRAS G12D', value: 'G12D', mname: 'G12D', gene: 'NRAS' }
		],
		genotype: 'variant',
		mcount: 'any'
	}
	test.deepEqual(newConfig, expectedConfig, 'values should carry the gene of each selected variant')

	holder.remove()
	test.end()
})

tape('no gene column for a single gene term', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// all variants of one gene, the gene column would be redundant
	const singleGeneMnames = genesetMnames.filter(m => m.gene == 'KRAS')
	renderVariantConfig({
		holder,
		values,
		mnames: singleGeneMnames,
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const tr: any = section.select('tbody').select('tr').node()
	const tds = tr.querySelectorAll('td')
	test.equal(tds.length, 4, 'row should have a checkbox cell plus 3 data cells')
	test.equal(tds[1].textContent, 'G12D', 'first data cell should be the variant')

	const mnameCheckboxes: any = section.select('tbody').selectAll('input[type="checkbox"]').nodes()
	mnameCheckboxes[0].click()
	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	test.deepEqual(
		newConfig.values,
		[{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D', gene: 'KRAS' }],
		'label should omit the gene, but the value should still carry it'
	)

	holder.remove()
	test.end()
})

tape('selected variant absent from current data is preserved', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// G12D is selected but is not in the current variant list, e.g. because
	// another filter term excludes all of its samples
	const currentMnames = mnames.filter(m => m.mname != 'G12D')
	renderVariantConfig({
		holder,
		values,
		mnames: currentMnames,
		selectedValues: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const trs: any = section.select('tbody').selectAll('tr').nodes()
	test.equal(trs.length, currentMnames.length + 1, 'preserved variant should be added to the list')

	const preservedTr = trs[trs.length - 1]
	const tds = preservedTr.querySelectorAll('td')
	test.deepEqual(
		[tds[1].textContent, tds[2].textContent, tds[3].textContent],
		['G12D', 'MISSENSE', '0'],
		'preserved variant should show a zero sample count'
	)
	test.ok(
		preservedTr.querySelector('[data-testid="sjpp-variantConfig-mname-absent"]'),
		'preserved variant should be flagged as absent from current data'
	)
	test.equal(preservedTr.querySelector('input[type="checkbox"]').checked, true, 'preserved variant should be checked')
	// only class M is checked, so the frameshift variant is filtered out and
	// the count is the missense variant plus the preserved one
	const toggle: any = section.select('div').node()
	test.ok(toggle.textContent.includes('(2)'), 'toggle count should include the preserved variant')
	test.equal(window.getComputedStyle(preservedTr).display, 'table-row', 'preserved variant should be visible')

	// applying without touching anything must not widen the selection to the class
	const applyBtn: any = holder.select('button').node()
	applyBtn.click()
	test.deepEqual(
		newConfig,
		{
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'any'
		},
		'apply should keep the preserved variant instead of falling back to its class'
	)

	// unchecking it is a deliberate action and still falls back to the classes
	preservedTr.querySelector('input[type="checkbox"]').click()
	applyBtn.click()
	test.deepEqual(
		newConfig.values,
		[{ key: 'M', label: 'MISSENSE', value: 'M' }],
		'unchecking the preserved variant should fall back to the checked class'
	)

	holder.remove()
	test.end()
})

tape('preserved variant of a class absent from current data', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// neither the variant nor its class is present in the current data
	const otherClasses: TermValues = { F: { key: 'F', label: 'FRAMESHIFT' } }
	renderVariantConfig({
		holder,
		values: otherClasses,
		mnames: [{ mname: 'K100fs', class: 'F', samplecount: 1 }],
		selectedValues: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		dt: 1,
		callback: config => (newConfig = config)
	})

	// the class is preserved too, so that the variant can be displayed and kept
	const classTrs: any = holder
		.select('[data-testid="sjpp-variantConfig-class"]')
		.select('tbody')
		.selectAll('tr')
		.nodes()
	test.equal(classTrs.length, 2, 'the absent class should be added to the class list')
	test.equal(classTrs[1].querySelector('input[type="checkbox"]').checked, true, 'the preserved class should be checked')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()
	test.deepEqual(
		newConfig.values,
		[{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
		'apply should keep the preserved variant'
	)

	holder.remove()
	test.end()
})

tape('preserved variant with gene', test => {
	const holder = select(document.body).append('div')
	let newConfig

	// NRAS G12D is selected but absent from the current data, while
	// KRAS G12D is present; the two must not be conflated
	const currentMnames = genesetMnames.filter(m => !(m.gene == 'NRAS' && m.mname == 'G12D'))
	renderVariantConfig({
		holder,
		values,
		mnames: currentMnames,
		selectedValues: [{ key: 'M', label: 'NRAS G12D', value: 'G12D', mname: 'G12D', gene: 'NRAS' }],
		dt: 1,
		callback: config => (newConfig = config)
	})

	const section = holder.select('[data-testid="sjpp-variantConfig-mname"]')
	const trs: any = section.select('tbody').selectAll('tr').nodes()
	const checked = trs.filter((tr: any) => tr.querySelector('input[type="checkbox"]').checked)
	test.equal(checked.length, 1, 'only the preserved variant should be checked')
	const tds = checked[0].querySelectorAll('td')
	test.deepEqual(
		[tds[1].textContent, tds[2].textContent],
		['NRAS', 'G12D'],
		'the preserved variant should keep its gene'
	)

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()
	test.deepEqual(
		newConfig.values,
		[{ key: 'M', label: 'NRAS G12D', value: 'G12D', mname: 'G12D', gene: 'NRAS' }],
		'apply should keep the preserved gene-scoped variant'
	)

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

// amino acid changes of a term with multiple genes, note the same
// mname is present in two genes
const genesetMnames = [
	{ mname: 'G12D', class: 'M', samplecount: 5, gene: 'KRAS' },
	{ mname: 'G12V', class: 'M', samplecount: 3, gene: 'KRAS' },
	{ mname: 'G12D', class: 'M', samplecount: 2, gene: 'NRAS' }
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

/**************
 * sv/fusion breakpoint range controls
 **************/

// classes and variants of a fusion term, where the mname is the partner gene and the
// breakpoints are those of the events of that partner (see BreakpointEntry)
const fusionValues: TermValues = {
	Fuserna: { key: 'Fuserna', label: 'Fusion transcript' }
}
const fusionMnames = [
	{
		mname: 'ABL1',
		class: 'Fuserna',
		samplecount: 30,
		breakpoints: [
			{ pos: 23290100, partnerChr: 'chr9', partnerPos: 130713016, samplecount: 20 },
			{ pos: 23183000, partnerChr: 'chr9', partnerPos: 130854000, samplecount: 10 }
		]
	},
	// a partner without a charted breakpoint, e.g. of a query lacking coordinates
	{ mname: 'FGFR1', class: 'Fuserna', samplecount: 2, noPositionCount: 2 }
]
const getGeneModels = async () => [
	{
		isoform: 'NM_004327',
		chr: 'chr22',
		start: 23180000,
		stop: 23318000,
		strand: '+',
		isdefault: true,
		exon: [
			[23180000, 23180200],
			[23290000, 23290300]
		]
	}
]

tape('breakpoint controls are not offered for snvindel', test => {
	const holder = select(document.body).append('div')
	renderVariantConfig({ holder, values, mnames, dt: 1, gene: 'KRAS', getGeneModels, callback: () => {} })
	test.equal(
		holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint"]').node(),
		null,
		'no breakpoint control for a snvindel term'
	)
	test.equal(
		holder.selectAll('[data-testid="sjpp-variantConfig-partnerBreakpoint-btn"]').nodes().length,
		0,
		'no partner breakpoint column for a snvindel term'
	)
	holder.remove()
	test.end()
})

tape('breakpoint controls need a gene model source', test => {
	const holder = select(document.body).append('div')
	// a caller that cannot look up isoform models, e.g. one without a genome, gets no
	// breakpoint control rather than a chart it cannot draw
	renderVariantConfig({ holder, values: fusionValues, mnames: fusionMnames, dt: 5, gene: 'BCR', callback: () => {} })
	test.equal(
		holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint"]').node(),
		null,
		'no breakpoint control without getGeneModels'
	)
	holder.remove()
	test.end()
})

tape('breakpoint controls render for a sv term', test => {
	const holder = select(document.body).append('div')
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		gene: 'BCR',
		getGeneModels,
		callback: () => {}
	})
	const selfDiv = holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint"]')
	test.ok(selfDiv.node(), 'renders the control for the breakpoint of the term gene')
	test.ok(selfDiv.text().includes('BCR breakpoint'), 'names the gene of the term')
	test.equal(
		holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint-btn"]').text(),
		'any position',
		'no range is registered yet'
	)
	const partnerBtns = holder.selectAll('[data-testid="sjpp-variantConfig-partnerBreakpoint-btn"]').nodes()
	test.equal(partnerBtns.length, 2, 'renders a partner breakpoint control for each variant')
	test.equal((partnerBtns[0] as HTMLElement).textContent, 'any position', 'variant with breakpoints is selectable')
	test.equal(
		(partnerBtns[1] as HTMLElement).textContent,
		'n/a',
		'variant without a charted breakpoint cannot be restricted'
	)
	holder.remove()
	test.end()
})

tape('breakpoint control for a term of multiple genes', test => {
	const holder = select(document.body).append('div')
	// a range on the term gene is not scoped to a gene, so the control is only offered
	// when the term has one gene, which the caller signals by passing arg.gene
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		getGeneModels,
		callback: () => {}
	})
	test.equal(
		holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint"]').node(),
		null,
		'no control for the breakpoint of the term gene'
	)
	test.equal(
		holder.selectAll('[data-testid="sjpp-variantConfig-partnerBreakpoint-btn"]').nodes().length,
		2,
		'partner breakpoints are still selectable, as each is scoped to its own variant'
	)
	holder.remove()
	test.end()
})

tape('registered breakpoint ranges are displayed', test => {
	const holder = select(document.body).append('div')
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		gene: 'BCR',
		getGeneModels,
		selfBreakpointRange: { chr: 'chr22', start: 23180000, stop: 23200000 },
		selectedValues: [
			{
				key: 'Fuserna',
				label: 'ABL1',
				value: 'ABL1',
				mname: 'ABL1',
				partnerBreakpointRange: { chr: 'chr9', start: 130713016, stop: 130887675 }
			}
		],
		callback: () => {}
	})
	test.equal(
		holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint-btn"]').text(),
		'chr22:23,180,000-23,200,000',
		'range of the term gene is displayed'
	)
	const partnerBtns = holder.selectAll('[data-testid="sjpp-variantConfig-partnerBreakpoint-btn"]').nodes()
	test.equal(
		(partnerBtns[0] as HTMLElement).textContent,
		'chr9:130,713,016-130,887,675',
		'range of the partner gene is displayed on its variant'
	)
	test.equal((partnerBtns[1] as HTMLElement).textContent, 'n/a', 'other variants are unaffected')
	holder.remove()
	test.end()
})

tape('breakpoint ranges are applied', test => {
	const holder = select(document.body).append('div')
	let config: any
	const partnerRange = { chr: 'chr9', start: 130713016, stop: 130887675 }
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		gene: 'BCR',
		getGeneModels,
		selfBreakpointRange: { chr: 'chr22', start: 23180000, stop: 23200000 },
		selectedValues: [
			{ key: 'Fuserna', label: 'ABL1', value: 'ABL1', mname: 'ABL1', partnerBreakpointRange: partnerRange }
		],
		callback: c => (config = c)
	})
	;(holder.select('.sjpp_apply_btn').node() as HTMLButtonElement).click()
	test.deepEqual(
		config.selfBreakpointRange,
		{ chr: 'chr22', start: 23180000, stop: 23200000 },
		'range of the term gene is applied'
	)
	test.equal(config.values.length, 1, 'the checked variant is applied')
	test.deepEqual(config.values[0].partnerBreakpointRange, partnerRange, 'range of the partner gene rides on it')
	holder.remove()
	test.end()
})

tape('breakpoint range is not applied for an unchecked variant', test => {
	const holder = select(document.body).append('div')
	let config: any
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		gene: 'BCR',
		getGeneModels,
		callback: c => (config = c)
	})
	// no variant is checked, so the class is applied and carries no partner range;
	// the key is still present for the term gene, so that a cleared range can be told
	// from a dt that has no such control at all
	;(holder.select('.sjpp_apply_btn').node() as HTMLButtonElement).click()
	test.equal(config.values.length, 1, 'the class is applied')
	test.equal('partnerBreakpointRange' in config.values[0], false, 'the class carries no partner range')
	test.equal('selfBreakpointRange' in config, true, 'the key of the term gene range is present')
	test.equal(config.selfBreakpointRange, undefined, 'and is undefined when no range is registered')
	holder.remove()
	test.end()
})

tape('no breakpoint range key for a snvindel', test => {
	const holder = select(document.body).append('div')
	let config: any
	renderVariantConfig({ holder, values, mnames, dt: 1, callback: c => (config = c) })
	;(holder.select('.sjpp_apply_btn').node() as HTMLButtonElement).click()
	test.equal('selfBreakpointRange' in config, false, 'no breakpoint range key for a dt without the control')
	holder.remove()
	test.end()
})

tape('breakpoint menu does not hide the menu it is opened from', async test => {
	/* the ui is rendered inside a menu, e.g. the tvs edit menu. every Menu hides itself
	on a mousedown outside of it, unless the clicked menu declares it as a parent or
	ancestor (see setRelatedMenus in dom/menu.js). without that declaration, clicking a
	non-interactive part of the breakpoint chart closed every other open menu */
	const parentTip = new Menu({ padding: '0px' })
	parentTip.show(100, 100)
	const holder = parentTip.d.append('div')
	renderVariantConfig({
		holder,
		values: fusionValues,
		mnames: fusionMnames,
		dt: 5,
		gene: 'BCR',
		getGeneModels,
		callback: () => {}
	})
	;(holder.select('[data-testid="sjpp-variantConfig-selfBreakpoint-btn"]').node() as HTMLElement).click()
	// the chart is rendered after the isoform models are fetched
	await new Promise(resolve => setTimeout(resolve, 0))
	const menuDiv = [...document.querySelectorAll('.sja_menu_div')].find(d =>
		d.querySelector('[data-testid="sjpp-isoformRangeSelect-marks"]')
	) as HTMLElement
	test.ok(menuDiv, 'the breakpoint chart is shown in a menu')
	test.equal((menuDiv as any).parent_menu, parentTip.d.node(), 'the menu declares the one it was opened from')
	// mousedown on a part of the chart with no handler of its own, which is the case
	// that propagates to the document body and hides other menus
	const info = menuDiv.querySelector('[data-testid="sjpp-isoformRangeSelect-info"]') as HTMLElement
	info.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
	test.equal(parentTip.d.style('display'), 'block', 'the menu it was opened from stays open')
	menuDiv.remove()
	parentTip.destroy()
	test.end()
})
