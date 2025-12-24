import { make_radios, renderTable } from '#dom'
import type { TermValues, BaseValue } from '#types'
import { dt2label } from '#shared/common.js'

type Config = {
	wt: boolean
	values: BaseValue[]
	mcount?: 'any' | 'single' | 'multiple'
}

type Arg = {
	holder: any // D3 holder where UI is rendered
	values: TermValues // mutation classes of term
	selectedValues?: BaseValue[] // selected mutation classes, when missing will default to all classes of term
	dt: number // dt value, rendering of some elements are based on this value
	mcount?: 'any' | 'single' | 'multiple' // mutation count, when missing will default to 'any'
	wt?: boolean // whether genotype is wildtype
	callback: (config: Config) => void
}

export function renderVariantConfig(arg: Arg) {
	const { holder, dt } = arg
	const wt = arg.wt || false
	const values: BaseValue[] = Object.entries(arg.values).map(([k, v]) => {
		return { key: k, label: v.label, value: k }
	})
	const selectedValues = arg.selectedValues?.length ? arg.selectedValues : values
	if (!Number.isInteger(dt)) throw 'unexpected dt value'
	const mcount = arg.mcount || 'any'

	holder.style('margin', '10px')

	// mutant vs. wildtype radio buttons
	const genotypeDiv = holder.append('div').attr('data-testid', 'sjpp-variantConfig-genotype')
	genotypeDiv
		.append('div')
		.style('display', 'inline-block')
		.style('margin-right', '5px')
		.style('opacity', 0.7)
		.text('Genotype')
	const genotypeRadio = make_radios({
		holder: genotypeDiv,
		styles: { display: 'inline-block' },
		options: [
			{ label: dt2label[dt], value: 'mutated', checked: !wt },
			{ label: 'Wildtype', value: 'wildtype', checked: wt }
		],
		callback: value => {
			variantsDiv.style('display', value == 'mutated' ? 'block' : 'none')
			applyBtn.property('disabled', value == 'mutated' && !values.length)
		}
	})

	// variants
	const variantsDiv = holder
		.append('div')
		.attr('data-testid', 'sjpp-variantConfig-variant')
		.style('display', wt ? 'none' : 'block')
		.style('margin-top', '10px')

	let countRadio
	if (values.length) {
		// variant data present
		// display data in table
		variantsDiv.append('div').style('opacity', 0.7).style('margin-bottom', '5px').text(dt2label[dt])
		const tableDiv = variantsDiv.append('div').style('margin-left', '5px').style('font-size', '0.8rem')
		const rows: any[] = []
		const selectedIdxs: number[] = []
		for (const [i, m] of values.entries()) {
			const label = m.label || m.key
			rows.push([{ value: label }])
			if (selectedValues.find(s => s.key == m.key)) selectedIdxs.push(i)
		}
		const columns: any[] = [{ label: 'tvs' }]
		renderTable({
			rows,
			columns,
			div: tableDiv,
			maxWidth: '40vw',
			maxHeight: '40vh',
			buttons: [],
			showHeader: false,
			striped: false,
			showLines: false,
			selectedRows: selectedIdxs
		})
		// mutation count
		if (dt == 1) {
			// snvindel, render mutation count radios
			const countDiv = variantsDiv.append('div').style('margin-top', '5px')
			countDiv
				.append('div')
				.style('display', 'inline-block')
				.style('margin-right', '5px')
				.style('opacity', 0.7)
				.text('Occurrence')
			const countOpts = [
				{ label: 'Any', value: 'any' },
				{ label: 'Single', value: 'single' },
				{ label: 'Multiple', value: 'multiple' }
			]
			countOpts.forEach((opt: any) => {
				if (opt.value == mcount) opt.checked = true
			})
			countRadio = make_radios({
				holder: countDiv,
				styles: { display: 'inline-block' },
				options: countOpts,
				callback: () => {}
			})
		}
	} else {
		// no variant data
		variantsDiv
			.append('div')
			.style('display', values.length ? 'none' : 'block')
			.text(`No ${dt2label[dt]} found`)
	}

	// Apply button
	const applyBtn = holder
		.append('div')
		.append('button')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin-top', '15px')
		.style('font-size', '.8em')
		.property('disabled', !wt && !values.length)
		.text('APPLY')
		.on('click', () => {
			// get genotype
			const selectedGenotype: any = genotypeRadio.inputs.nodes().find(r => r.checked)
			if (!selectedGenotype) throw 'no genotype selected'
			const config: Config = { values: [], wt: selectedGenotype.value == 'wildtype' }
			if (!config.wt) {
				// mutant genotype
				// get selected mutation classes
				const checkboxes = variantsDiv.select('tbody').selectAll('input').nodes()
				const checkedIdxs: number[] = []
				for (const [i, c] of checkboxes.entries()) {
					if (c.checked) checkedIdxs.push(i)
				}
				config.values = values.filter((v, i) => checkedIdxs.includes(i))
				// get mutation count
				if (countRadio) {
					const selectedCount: any = countRadio.inputs.nodes().find(r => r.checked)
					if (!selectedCount) throw 'no mutation count selected'
					config.mcount = selectedCount.value
				} else {
					config.mcount = 'any'
				}
			}
			arg.callback(config)
		})
}
