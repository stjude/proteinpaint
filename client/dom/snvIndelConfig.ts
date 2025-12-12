import { make_radios, renderTable } from '#dom'

export type Value = {
	key: string
	label: string
	value: string
}

type Config = {
	wt: boolean
	values: Value[]
	mcount?: string
}

type Arg = {
	holder: any // D3 holder where UI is rendered
	values: Value[] // mutation values
	selectedValues?: Value[] // selected mutation values
	mcount?: 'any' | 'single' | 'multiple' // mutation count
	wt?: boolean // whether genotype is wildtype
	callback: (config: Config) => void
}

export function renderSnvIndelConfig(arg: Arg) {
	const div = arg.holder
	const wt = arg.wt || false
	const values = arg.values
	const selectedValues = arg.selectedValues?.length ? arg.selectedValues : values
	const mcount = arg.mcount || 'any'

	div.style('margin', '10px')

	// genotype radio buttons
	const genotypeDiv = div.append('div').attr('data-testid', 'sjpp-snvindel-genotype-div').style('margin-bottom', '10px')
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
			{ label: 'Mutated', value: 'mutated', checked: !wt },
			{ label: 'Wildtype', value: 'wildtype', checked: wt }
		],
		callback: value => {
			mutationsDiv.style('display', value == 'mutated' ? 'block' : 'none')
		}
	})

	// mutations table
	const mutationsDiv = div
		.append('div')
		.attr('data-testid', 'sjpp-snvindel-mutations-div')
		.style('display', wt ? 'none' : 'block')
	mutationsDiv.append('div').style('opacity', 0.7).style('margin-bottom', '10px').text('Mutations:')
	const tableDiv = mutationsDiv.append('div').style('margin-left', '10px').style('font-size', '0.8rem')
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
	const countDiv = mutationsDiv.append('div').style('margin-bottom', '10px')
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
	const countRadio = make_radios({
		holder: countDiv,
		styles: { display: 'inline-block' },
		options: countOpts,
		callback: () => {}
	})

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
			const selectedGenotype: any = genotypeRadio.inputs.nodes().find(r => r.checked)
			if (!selectedGenotype) throw 'no genotype selected'
			const config: Config = { values: [], wt: selectedGenotype.value == 'wildtype' }
			if (!config.wt) {
				const checkboxes = mutationsDiv.select('tbody').selectAll('input').nodes()
				const checkedIdxs: number[] = []
				for (const [i, c] of checkboxes.entries()) {
					if (c.checked) checkedIdxs.push(i)
				}
				config.values = values.filter((v, i) => checkedIdxs.includes(i))
				const selectedCount: any = countRadio.inputs.nodes().find(r => r.checked)
				if (!selectedCount) throw 'no mutation count selected'
				config.mcount = selectedCount.value
			}
			arg.callback(config)
		})
}
