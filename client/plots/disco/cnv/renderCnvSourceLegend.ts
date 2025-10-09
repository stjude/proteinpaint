import type { Selection } from 'd3-selection'
import { make_radios, Menu } from '#dom'

export type AlternativeCnvSet = {
	nameHtml?: string
	name?: string
	inuse?: boolean
	mlst: any[]
}

const cnvMenu = new (Menu as any)({
	clearSelector: 'div'
})

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
	const g = legendG.append('g').attr('class', 'sjpp-cnv-source')

	const current = dataSets.find(d => d.inuse) || dataSets[0]

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

	const linkG = g.append('g').attr('transform', `translate(${prefixWidth},0)`)

	const aTag = linkG
		.append('a')
		.attr('href', href || '#')
		.attr('target', target)
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			if (aTag.attr('href') === '#') {
				event.preventDefault()
			}
			if (!href) {
				event.stopPropagation()
				showCnvMenu(this)
			}
		})

	const linkTextElement = aTag.append('text').attr('font-size', fontSize).text(linkText)

	if (href) {
		linkTextElement.style('fill', '#428bca').style('text-decoration', 'underline')
	}

	function showCnvMenu(dom: SVGTextElement | HTMLAnchorElement) {
		cnvMenu.clear()

		// Set menu title
		cnvMenu.d.append('div').text('Choose data source for CNV:').style('margin', '5px 5px 0 5px')

		const optionsHolder = cnvMenu.d.append('div').style('padding', '5px')

		make_radios({
			holder: optionsHolder,
			inputName: 'sjpp_cnv_source',
			options: dataSets.map((set, index) => ({
				label: set.nameHtml || set.name || `Set ${index + 1}`,
				value: index,
				checked: !!set.inuse
			})),
			styles: { display: 'block' },
			callback: value => {
				const selectedIndex = typeof value === 'number' ? value : Number(value)
				if (!Number.isNaN(selectedIndex)) onChange(selectedIndex)
				cnvMenu.hide() // Hide menu after selection
			}
		})
		cnvMenu.showunder(dom)
	}
}
