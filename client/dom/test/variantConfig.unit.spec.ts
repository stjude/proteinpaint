import tape from 'tape'
import { renderVariantConfig } from '../variantConfig'
import type { TermValues, BaseValue } from '#types'
import { select } from 'd3-selection'

/*
test sections:
    - basic render: snvindel
	- basic render: cnv
    - callback
    - unselect values
    - preselected values
    - genotype toggle
	- no mutations
	- any mutation count
    - single mutation count
    - multiple mutation count
*/

const values: TermValues = {
	M: { key: 'M', label: 'MISSENSE' },
	F: { key: 'F', label: 'FRAMESHIFT' },
	N: { key: 'N', label: 'NONSENSE' },
	D: { key: 'D', label: 'PROTEINDEL' }
}

const values2: TermValues = {
	CNV_amp: { key: 'CNV_amp', label: 'Gain' },
	CNV_loss: { key: 'CNV_loss', label: 'Heterozygous Deletion' },
	CNV_amplification: { key: 'CNV_amplification', label: 'Amplification' }
}

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
	test.equal(genotypeRadio.length, 2, 'should render 2 genotype radio buttons')

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
	test.equal(genotypeRadio.length, 2, 'should render 2 genotype radio buttons')

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
		wt: false,
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
		wt: false,
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
		wt: false,
		mcount: 'any'
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have 2 variants')

	holder.remove()
	test.end()
})

tape('genotype toggle', test => {
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
	test.equal(genotypeRadio.length, 2, 'should render 2 genotype radio buttons')
	const selectedGenotype: any = genotypeRadio.find((r: any) => r.checked)
	test.equal(selectedGenotype.value, 'mutated', 'selected genotype should be mutated')

	const variantsDiv: any = holder.select('[data-testid="sjpp-variantConfig-variant"]').node()
	test.equal(window.getComputedStyle(variantsDiv).display, 'block', 'should display variants div')

	// select wildtype genotype
	genotypeRadio.find(r => r.value == 'wildtype').click()
	test.equal(window.getComputedStyle(variantsDiv).display, 'none', 'should not display variants div')

	const applyBtn: any = holder.select('button').node()
	applyBtn.click()

	const expectedConfig = {
		values: [],
		wt: true
	}

	test.deepEqual(newConfig, expectedConfig, 'config should have wildtype genotype')

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
	test.equal(genotypeRadio.length, 2, 'should render 2 genotype radio buttons')
	const selectedGenotype: any = genotypeRadio.find((r: any) => r.checked)
	test.equal(selectedGenotype.value, 'mutated', 'selected genotype should be mutated')

	const variantsDiv: any = holder.select('[data-testid="sjpp-variantConfig-variant"]')
	const table = variantsDiv.select('table').node()
	test.notOk(table, 'should not display variants table')
	const countRadio: any = variantsDiv.selectAll('input[type="radio"]').nodes()
	test.equal(countRadio.length, 0, 'should not display mutation count radio buttons')

	test.equal(variantsDiv.text(), 'No SNV/indel found', 'should display no SNV/indel found message')

	const applyBtn: any = holder.select('button')
	test.ok(applyBtn.property('disabled'), 'apply button should be disabled')

	// select wildtype genotype
	genotypeRadio.find(r => r.value == 'wildtype').click()
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
