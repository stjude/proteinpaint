import type { Selection } from 'd3-selection'
import { make_radios, Menu } from '#dom'

export type AlternativeCnvSet = {
	nameHtml?: string
	name?: string
	inuse?: boolean
	mlst: any[]
}

type MenuApi = {
	clear: () => MenuApi
	d: Selection<HTMLDivElement, any, any, any>
	hide: () => void
	showunder: (dom: Element) => void
}

const cnvMenu = new Menu() as MenuApi

function parseSetLabel(set: AlternativeCnvSet, index: number) {
	let text = set.name || `Set ${index + 1}`
	let href: string | undefined
	let target = '_blank'

	if (set.nameHtml) {
		const parser = new DOMParser()
		const doc = parser.parseFromString(set.nameHtml, 'text/html')
		const anchor = doc.querySelector('a')
		if (anchor) {
			href = anchor.getAttribute('href') || undefined
			target = anchor.getAttribute('target') || '_blank'
			text = anchor.textContent?.trim() || text
		} else {
			text = doc.body.textContent?.trim() || text
		}
	}

	return { text, href, target }
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
	_svgDiv: Selection<HTMLDivElement, any, any, any>,
	legendG: Selection<SVGGElement, any, any, any>,
	dataSets: AlternativeCnvSet[],
	fontSize: number,
	onChange: (index: number) => void
) {
	if (!dataSets || dataSets.length === 0) return

	legendG.select('g.sjpp-cnv-source').remove()
	const legendNode = legendG.node()
	const legendBBox = legendNode ? legendNode.getBBox() : undefined
	const g = legendG
		.append('g')
		.attr('class', 'sjpp-cnv-source')
		.attr(
			'transform',
			`translate(${legendBBox?.x || 0}, ${(legendBBox?.y || 0) + (legendBBox?.height || 0) + fontSize})`
		)

	const currentIndex = dataSets.findIndex(d => d.inuse)
	const current = currentIndex >= 0 ? dataSets[currentIndex] : dataSets[0]
	const effectiveIndex = currentIndex >= 0 ? currentIndex : dataSets.indexOf(current)
	const currentLabelInfo = parseSetLabel(current, effectiveIndex >= 0 ? effectiveIndex : 0)

	const prefix = g.append('text').attr('font-size', fontSize).attr('dominant-baseline', 'middle').text('Source: ')
	const prefixNode = prefix.node()
	const prefixWidth = prefixNode ? prefixNode.getBBox().width : 0

	const linkG = g.append('g').attr('transform', `translate(${prefixWidth},0)`)

	const aTag = linkG
		.append('a')
		.attr('href', currentLabelInfo.href || '#')
		.attr('target', currentLabelInfo.target)
		.attr('xlink:href', currentLabelInfo.href || '#')
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			if (aTag.attr('href') === '#') {
				event.preventDefault()
			}
			if (!currentLabelInfo.href) {
				event.stopPropagation()
				showCnvMenu(this)
			}
		})

	const linkTextElement = aTag
		.append('text')
		.attr('font-size', fontSize)
		.attr('dominant-baseline', 'middle')
		.text(currentLabelInfo.text)

	if (currentLabelInfo.href) {
		linkTextElement.style('fill', '#428bca').style('text-decoration', 'underline')
	}

	const linkWidth = linkTextElement.node() ? linkTextElement.node()!.getBBox().width : 0
	const labelWidth = prefixWidth + linkWidth

	const buttonPaddingX = 10
	const buttonPaddingY = 4
	const buttonHeight = fontSize + buttonPaddingY * 2
	const buttonGroup = g
		.append('g')
		.attr('transform', `translate(${labelWidth + 12},${-buttonHeight / 2})`)
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			event.stopPropagation()
			showCnvMenu(this)
		})

	const buttonText = buttonGroup
		.append('text')
		.attr('x', buttonPaddingX)
		.attr('y', buttonHeight / 2)
		.attr('font-size', fontSize)
		.attr('dominant-baseline', 'middle')
		.attr('text-anchor', 'start')
		.text('Click to change')

	const buttonTextWidth = buttonText.node() ? buttonText.node()!.getBBox().width : 0
	const buttonWidth = buttonTextWidth + buttonPaddingX * 2

	buttonGroup
		.insert('rect', 'text')
		.attr('width', buttonWidth)
		.attr('height', buttonHeight)
		.attr('rx', 4)
		.attr('ry', 4)
		.style('fill', '#f2f2f2')
		.style('stroke', '#ccc')
		.style('stroke-width', 1)

	function showCnvMenu(dom: Element) {
		cnvMenu.clear()

		cnvMenu.d.append('div').text('Choose data source for CNV:').style('margin', '5px 5px 0 5px')

		const optionsHolder = cnvMenu.d.append('div').style('padding', '5px')

		make_radios({
			holder: optionsHolder,
			inputName: 'sjpp_cnv_source',
			options: dataSets.map((set, index) => ({
				label: parseSetLabel(set, index).text,
				value: index,
				checked: !!set.inuse
			})),
			styles: { display: 'block' },
			callback: value => {
				const selectedIndex = Number(value)
				if (!Number.isNaN(selectedIndex)) onChange(selectedIndex)
				cnvMenu.hide()
			}
		})
		cnvMenu.showunder(dom)
	}
}
