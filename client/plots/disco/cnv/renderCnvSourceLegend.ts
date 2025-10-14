import type { SvgG } from '../../../types/d3'
import { make_radios, Menu } from '#dom'

export type AlternativeCnvSet = {
	nameHtml?: string
	name?: string
	inuse?: boolean
	mlst: any[]
}

const cnvMenu = new Menu()

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
 * @param legendG - legend <g> element to append the label and button to
 * @param datasets - list of alternative CNV data sets from the server
 * @param fontSize - font size used in the legend
 * @param onChange - callback fired with the index of the selected data set
 */
export function renderCnvSourceLegend(
	legendG: SvgG,
	datasets: AlternativeCnvSet[],
	fontSize: number,
	onChange: (index: number) => void
) {
	if (!legendG || legendG.empty()) throw new Error('legendG is required')
	if (!datasets || datasets.length === 0) throw new Error('at least one dataset is required')

	legendG.select('g.sjpp-cnv-source').remove()

	const gBBox = legendG.node()!.getBBox()
	const cnvSrcWrapper = legendG
		.append('g')
		.attr('class', 'sjpp-cnv-source')
		.attr('transform', `translate(${gBBox.width},${gBBox.y + fontSize})`)

	const prompt = cnvSrcWrapper
		.append('text')
		.attr('font-size', fontSize)
		.attr('dominant-baseline', 'middle')
		.text('Source:')

	const [ds, idx] = getActiveDataset(datasets)
	const sourceInfo = parseSetLabel(ds, idx)

	const promptWidth = prompt.node() ? prompt.node()!.getBBox().width : 0

	const link = cnvSrcWrapper
		.append('a')
		.attr('transform', `translate(${promptWidth + 5},0)`)
		.attr('href', sourceInfo.href || '#')
		.attr('target', sourceInfo.target)
		.attr('xlink:href', sourceInfo.href || '#')
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			if (link.attr('href') === '#') {
				event.preventDefault()
			}
			if (!sourceInfo.href) {
				event.stopPropagation()
				showCnvMenu(this)
			}
		})

	const linkG = link.append('g')
	const linkText = linkG
		.append('text')
		.attr('font-size', fontSize)
		.attr('dominant-baseline', 'middle')
		.style('fill', sourceInfo.href ? '#428bca' : 'black')
		.style('text-decoration', sourceInfo.href ? 'underline' : 'none')
		.text(sourceInfo.text)

	const linkWidth = linkText.node() ? linkText.node()!.getBBox().width : 0
	const btnPadding = 10
	const btnWdt = 100 + btnPadding * 4
	const btnHgt = fontSize + btnPadding * 2
	const btnWrapper = cnvSrcWrapper
		.append('g')
		.attr('transform', `translate(${linkWidth + promptWidth + fontSize},${-btnHgt / 2})`)
		.style('cursor', 'pointer')
		.on('click', function (event: MouseEvent) {
			event.stopPropagation()
			showCnvMenu(this)
		})
	btnWrapper
		.append('rect')
		.attr('width', btnWdt)
		.attr('height', btnHgt)
		.attr('rx', 10)
		.attr('ry', 10)
		.style('fill', '#f2f2f2')
	btnWrapper
		.append('text')
		.attr('x', btnWdt / 2)
		.attr('y', btnHgt / 2)
		.attr('font-size', fontSize)
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'middle')
		.text('Click to change'.toUpperCase())

	function showCnvMenu(dom: Element) {
		cnvMenu.clear().showunder(dom)

		cnvMenu.d.append('div').text('Choose data source for CNV:').style('margin', '5px 5px 0 5px')

		const optionsHolder = cnvMenu.d.append('div').style('padding', '5px')

		make_radios({
			holder: optionsHolder,
			inputName: 'sjpp_cnv_source',
			options: datasets.map((set, index) => ({
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
	}
}

function getActiveDataset(datasets) {
	let currentIndex = datasets.findIndex(d => d.inuse)
	if (currentIndex == -1) currentIndex = 0
	return [datasets[currentIndex], currentIndex]
}
