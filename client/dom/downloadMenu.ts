import { Menu } from '#dom/menu'
import { downloadSingleSVG } from '../common/svg.download.js'

export class DownloadMenu {
	menu: Menu
	name2svg: any
	holder: any

	constructor(name2svg, holder) {
		this.menu = new Menu({ padding: '0px' })
		this.name2svg = name2svg
		this.holder = holder
	}

	show(x, y) {
		this.menu.clear()
		const menuDiv = this.menu.d.append('div')
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('SVG')
			.on('click', () => {
				for (const [name, svg] of Object.entries(this.name2svg)) downloadSingleSVG(svg, name, this.holder)
				this.menu.hide()
			})
		menuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('PDF')
			.on('click', () => {
				downloadSVGsAsPdf(this.name2svg)
				this.menu.hide()
			})
		this.menu.show(x - 20, y - 10)
	}
}

export async function downloadSVGsAsPdf(name2svg, filename = 'charts.pdf') {
	const JSPDF = await import('jspdf')
	const { jsPDF } = JSPDF
	/*
	When imported, the svg2pdf.js module modifies or extends the jsPDF library (which we already imported).
	The code inside svg2pdf.js adds a new method (.svg()) to the jsPDF object prototype, making that functionality available on all jsPDF instances.
	Therefore, a simple import 'svg2pdf.js' without curly braces is all that is needed to apply its functionality. 
	 */
	await import('svg2pdf.js') // This import extends jsPDF with SVG functionality
	const doc = new jsPDF('p', 'pt', 'a4') // p for portrait, l for landscape, points, A4 size
	doc.setFontSize(12)
	const pageWidth = doc.internal.pageSize.getWidth() - 10
	const pageHeight = doc.internal.pageSize.getHeight() - 10

	const entries: any[] = Object.entries(name2svg)
	let y = 50
	const x = 30
	const ratio = 72 / 96 //convert pixels to pt

	for (const [name, svgObj] of entries) {
		const svg = svgObj.node()
		const rect = svg.getBoundingClientRect()
		svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
		const width = Math.min(pageWidth, rect.width * ratio) - 20
		const height = Math.min(pageHeight, rect.height * ratio) - 20
		if (y + height > pageHeight - 20) {
			doc.addPage()
			y = 50
		}
		doc.text(name, x + 10, y - 20)
		await doc.svg(svg, { x, y, width, height })
		y = y + height + 50
	}
	doc.save(filename)
}
