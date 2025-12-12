import { make_radios, renderTable } from '#dom'

export function renderSnvIndelConfig(arg) {
	const { mutations, selectedMutations } = arg
	const wt = arg.wt || false
	const div = arg.holder

	div.style('margin', '10px')

	// genotype radio buttons
	const genotypeDiv = div.append('div').style('margin-bottom', '10px')
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
	const mutationsDiv = div.append('div').style('display', wt ? 'none' : 'block')
	mutationsDiv.append('div').style('opacity', 0.7).style('margin-bottom', '10px').text('Mutations:')
	const tableDiv = mutationsDiv.append('div').style('margin-left', '10px').style('font-size', '0.8rem')
	const rows: any[] = []
	const selectedIdxs: number[] = []
	for (const [i, m] of mutations.entries()) {
		const label = m.label || m.key
		rows.push([{ value: label }])
		if (selectedMutations.find(s => s.key == m.key)) selectedIdxs.push(i)
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
	const countRadio = make_radios({
		holder: countDiv,
		styles: { display: 'inline-block' },
		options: [
			{ label: 'Any', value: 'any', checked: !wt },
			{ label: 'Single', value: 'single', checked: wt },
			{ label: 'Multiple', value: 'multiple', checked: wt }
		],
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
			const config: any = {}
			const selectedGenotype = genotypeRadio.inputs.nodes().find(r => r.checked)
			config.wt = selectedGenotype.value == 'wildtype'
			if (!config.wt) {
				const checkboxes = mutationsDiv.select('tbody').selectAll('input').nodes()
				const checkedIdxs: number[] = []
				for (const [i, c] of checkboxes.entries()) {
					if (c.checked) checkedIdxs.push(i)
				}
				config.selectedMutations = mutations.filter((v, i) => checkedIdxs.includes(i))
				const selectedCount = countRadio.inputs.nodes().find(r => r.checked)
				config.mcount = selectedCount.value
			}
			arg.callback(config)
		})
}
