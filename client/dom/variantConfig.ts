import { make_radios, renderTable } from '#dom'

export type Value = {
	key: string
	label: string
	value: string
}

type Config = {
	wt: boolean
	values: Value[]
	mcount?: 'any' | 'single' | 'multiple'
}

type Arg = {
	holder: any // D3 holder where UI is rendered
	values: Value[] // mutation classes
	selectedValues?: Value[] // selected mutation classes
	mcount?: 'any' | 'single' | 'multiple' // mutation count. When present, mutation count radio buttons are rendered and provided value is selected. When missing, no radio buttons are rendered and mcount in config will default to 'any'.
	mlabel?: string // mutated genotype label (e.g. 'Mutated', 'Altered'), will default to 'Mutated'
	wt?: boolean // whether genotype is wildtype
	callback: (config: Config) => void
}

export function renderVariantConfig(arg: Arg) {
	const div = arg.holder
	const wt = arg.wt || false
	const values = arg.values
	const selectedValues = arg.selectedValues?.length ? arg.selectedValues : values
	let mcount
	if (Object.keys(arg).includes('mcount')) mcount = arg.mcount || 'any'
	const mlabel = arg.mlabel || 'Mutated'

	div.style('margin', '10px')

	// genotype radio buttons
	const genotypeDiv = div.append('div').attr('data-testid', 'sjpp-variantConfig-genotype').style('margin-bottom', '10px')
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
			{ label: mlabel, value: 'mutated', checked: !wt },
			{ label: 'Wildtype', value: 'wildtype', checked: wt }
		],
		callback: value => {
			variantsDiv.style('display', value == 'mutated' ? 'block' : 'none')
		}
	})

	// variants table
	const variantsDiv = div
		.append('div')
		.attr('data-testid', 'sjpp-variantConfig-variant')
		.style('display', wt ? 'none' : 'block')
	variantsDiv.append('div').style('opacity', 0.7).style('margin-bottom', '10px').text('variants:')
	const tableDiv = variantsDiv.append('div').style('margin-left', '10px').style('font-size', '0.8rem')
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
	let countRadio
	if (mcount) {
		const countDiv = variantsDiv.append('div').style('margin-bottom', '10px')
		countDiv
			.append('div')
			.style('display', 'inline-block')
			.style('margin-right', '5px')
			.style('opacity', 0.7)
			.text('Mutation occurrence')
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

	// Apply button
	div
		.append('div')
		.append('button')
		.attr('class', 'sja_filter_tag_btn sjpp_apply_btn')
		.style('border-radius', '13px')
		.style('margin-top', '15px')
		.style('font-size', '.8em')
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
