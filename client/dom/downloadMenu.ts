import { Menu } from '#dom/menu'
import { downloadSingleSVG, downloadAggregatedSVG } from '../common/svg.download.js'

export class DownloadMenu {
	menu: Menu
	name2svg: { [name: string]: { svg: any; parent: any } }
	holder: any
	multipleSVGs: boolean
	filename: string

	constructor(name2svg, filename = 'charts') {
		this.menu = new Menu({ padding: '0px' })
		this.name2svg = name2svg
		this.multipleSVGs = Object.keys(name2svg).length > 1
		this.filename = filename.replace(/\s/g, '_')
	}

	show(x, y) {
		this.menu.clear()
		const menuDiv = this.menu.d.append('div')
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('PDF')
			.on('click', () => {
				downloadSVGsAsPdf(this.name2svg, this.filename)
				this.menu.hide()
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('SVG')
			.on('click', () => {
				downloadAggregatedSVG(this.name2svg, this.filename)
				this.menu.hide()
			})

		if (this.multipleSVGs)
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Multiple SVG')
				.on('click', () => {
					for (const [name, chart] of Object.entries(this.name2svg))
						downloadSingleSVG(chart.svg.node(), name.replace(/\s/g, '_'), chart.parent)
					this.menu.hide()
				})
		this.menu.show(x - 20, y - 10)
	}
}

export async function downloadSVGsAsPdf(name2svg, filename) {
	const JSPDF = await import('jspdf')
	const { jsPDF } = JSPDF
	/*
	When imported, the svg2pdf.js module modifies or extends the jsPDF library (which we already imported).
	The code inside svg2pdf.js adds a new method (.svg()) to the jsPDF object prototype, making that functionality available on all jsPDF instances.
	Therefore, a simple import 'svg2pdf.js' without curly braces is all that is needed to apply its functionality. 
	 */
	await import('svg2pdf.js') // This import extends jsPDF with SVG functionality
	const doc = new jsPDF('portrait', 'pt', 'a4') // p for portrait, l for landscape, points, A4 size
	doc.setFontSize(12)
	const pageWidth = doc.internal.pageSize.getWidth()
	const pageHeight = doc.internal.pageSize.getHeight()

	const entries: any[] = Object.entries(name2svg)
	let y = 50
	const x = 20 //pt

	for (const [name, chart] of entries) {
		const parent = chart.parent
		const svg = chart.svg.node().cloneNode(true) //clone to avoid modifying the original
		if (parent) {
			const svgStyles = window.getComputedStyle(parent)
			for (const [prop, value] of Object.entries(svgStyles)) {
				if (prop.startsWith('font')) svg.style[prop] = value
			}
		}
		parent.appendChild(svg) //Added otherwise does not print, will remove later
		const svgWidth = svg.getAttribute('width')
		const svgHeight = svg.getAttribute('height')
		const scale = getScale(pageWidth, pageHeight, svgWidth, svgHeight)
		const width = svgWidth * scale //convert to pt and fit to page size
		const height = svgHeight * scale //convert to pt and fit to page size

		if (y + height > pageHeight - 20) {
			doc.addPage()
			y = 50
		}
		if (name.trim()) doc.text(name.length > 90 ? name.slice(0, 90) + '...' : name, x + 10, y - 20)
		else y -= 20
		svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)

		await doc.svg(svg, { x, y, width, height })
		y = y + height + 50
		parent.removeChild(svg)
	}
	doc.save(filename + '.pdf')
}

export function getScale(pageWidth, pageHeight, svgWidth, svgHeight) {
	const ratio = 72 / 96 //convert px to pt
	const width = svgWidth * ratio //convert to pt
	const height = svgHeight * ratio //convert to pt
	let scaleWidth, scaleHeight
	if (width > pageWidth) {
		scaleWidth = pageWidth / width
	}
	if (height > pageHeight) {
		scaleHeight = pageHeight / height
	}
	const scale = Math.min(scaleWidth || 1, scaleHeight || 1) * 0.95 //leave padding
	return scale * ratio
}
