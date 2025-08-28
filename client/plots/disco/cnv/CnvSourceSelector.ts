import type { Selection } from 'd3-selection'

export type AlternativeCnvSet = {
	nameHtml?: string
	name?: string
	inuse?: boolean
	mlst: any[]
}

/**
 * Render radio buttons allowing selection among multiple CNV data sets.
 * @param holder - container to append the controls to
 * @param dataSets - list of alternative CNV data sets from the server
 * @param onChange - callback fired with the index of the selected data set
 */
export function renderCnvSourceSelector(
	holder: Selection<HTMLDivElement, any, any, any>,
	dataSets: AlternativeCnvSet[],
	onChange: (index: number) => void
) {
	const wrapper = holder.append('div').classed('sjpp-cnv-source-selector', true).style('margin', '10px 0px')

	wrapper.append('div').text('Choose data source for CNV:')

	const option = wrapper
		.selectAll('div.sjpp-cnv-source-option')
		.data(dataSets)
		.enter()
		.append('div')
		.classed('sjpp-cnv-source-option', true)

	option
		.append('input')
		.attr('type', 'radio')
		.attr('name', 'sjpp_cnv_source')
		.property('checked', d => !!d.inuse)
		.on('change', (event, d) => {
			const i = dataSets.indexOf(d)
			onChange(i)
		})

	option.append('span').html((d, i) => d.nameHtml || d.name || `Set ${i + 1}`)
}
