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

/**
 * Render the CNV source label and a button inside the legend. Clicking the
 * button will display a small menu with radio buttons to choose among the
 * available CNV data sets.
 *
 * @param svgDiv - div that holds the svg, used as relative container for the menu
 * @param legendG - legend <g> element to append the label and button to
 * @param dataSets - list of alternative CNV data sets from the server
 * @param fontSize - font size used in the legend
 * @param onChange - callback fired with the index of the selected data set
 */
export function renderCnvSourceLegend(
	svgDiv: Selection<HTMLDivElement, any, any, any>,
	legendG: Selection<SVGGElement, any, any, any>,
	dataSets: AlternativeCnvSet[],
	fontSize: number,
	onChange: (index: number) => void
) {
	if (!dataSets || dataSets.length === 0) return

	legendG.select('g.sjpp-cnv-source').remove()
	svgDiv.select('div.sjpp-cnv-source-menu').remove()

	const current = dataSets.find(d => d.inuse) || dataSets[0]
	const g = legendG.insert('g', ':first-child').attr('class', 'sjpp-cnv-source')

	const prefix = g.append('text').attr('font-size', fontSize).text('Source: ')
	const prefixNode = prefix.node()
	const prefixWidth = prefixNode ? prefixNode.getBBox().width : 0

	let href: string | undefined
	let target = '_blank'
	let linkText = current.name || `Set ${dataSets.indexOf(current) + 1}`
	if (current.nameHtml) {
		const parser = new DOMParser()
		const doc = parser.parseFromString(current.nameHtml, 'text/html')
		const anchor = doc.querySelector('a')
		if (anchor) {
			href = anchor.getAttribute('href') || undefined
			target = anchor.getAttribute('target') || '_blank'
			linkText = anchor.textContent || linkText
		}
	}

	let linkWidth = 0
	if (href) {
		const a = g.append('a').attr('href', href).attr('target', target)
		const t = a
			.append('text')
			.attr('x', prefixWidth)
			.attr('font-size', fontSize)
			.text(linkText)
			.style('fill', '#428bca')
			.style('text-decoration', 'underline')
		const node = t.node()
		linkWidth = node ? node.getBBox().width : 0
	} else {
		const t = g.append('text').attr('x', prefixWidth).attr('font-size', fontSize).text(linkText)
		const node = t.node()
		linkWidth = node ? node.getBBox().width : 0
	}

	const labelWidth = prefixWidth + linkWidth

	const button = g
		.append('text')
		.attr('x', labelWidth + 5)
		.attr('font-size', fontSize)
		.text('[Click to change]')
		.style('cursor', 'pointer')
		.style('fill', '#428bca')
		.style('text-decoration', 'underline')

	const menu = svgDiv
		.append('div')
		.classed('sjpp-cnv-source-menu', true)
		.style('display', 'none')
		.style('position', 'absolute')
		.style('background', 'white')
		.style('border', '1px solid #ccc')
		.style('padding', '5px')
		.style('z-index', '10')

	renderCnvSourceSelector(menu, dataSets, i => {
		onChange(i)
		menu.style('display', 'none')
	})
	const CM_TO_PX = 37.8

	const gainLabel = legendG.selectAll<SVGTextElement, any>('text').filter(function () {
		return this.textContent?.trim() === 'Gain'
	})

	if (!gainLabel.empty()) {
		const legendRect = (legendG.node() as SVGGElement).getBoundingClientRect()
		const gainRect = gainLabel.node()!.getBoundingClientRect()
		const offsetX = gainRect.right - legendRect.left + CM_TO_PX
		const offsetY = gainRect.top - legendRect.top
		g.attr('transform', `translate(${offsetX},${offsetY})`)

		button.on('click', event => {
			const divNode = svgDiv.node()
			if (!divNode) return
			const divRect = divNode.getBoundingClientRect()
			const currentGainRect = gainLabel.node()!.getBoundingClientRect()
			menu
				.style('left', `${currentGainRect.right - divRect.left + CM_TO_PX}px`)
				.style('top', `${currentGainRect.top - divRect.top}px`)
				.style('display', 'block')
			event.stopPropagation()
		})
	} else {
		button.on('click', event => {
			const divNode = svgDiv.node()
			if (!divNode) return
			const divRect = divNode.getBoundingClientRect()
			menu
				.style('left', `${event.clientX - divRect.left}px`)
				.style('top', `${event.clientY - divRect.top}px`)
				.style('display', 'block')
			event.stopPropagation()
		})
	}

	svgDiv.on('click', () => menu.style('display', 'none'))
}
