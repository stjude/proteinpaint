import { select } from 'd3-selection'
import { to_svg } from '../src/client'
import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import { add } from 'ol/coordinate'

export function downloadSingleSVG(svg, filename, parent) {
	if (parent) {
		const svgStyles = window.getComputedStyle(parent)
		for (const prop of svgStyles) {
			if (prop.startsWith('font')) svg.style(prop, svgStyles.getPropertyValue(prop))
		}
	}
	const link = document.createElement('a')
	// If you don't know the name or want to use
	// the webserver default set name = ''
	link.setAttribute('download', filename)
	document.body.appendChild(link)
	link.click()
	link.remove()
	const serializer = new XMLSerializer()
	const svg_blob = new Blob([serializer.serializeToString(svg.node())], {
		type: 'image/svg+xml'
	})
	link.href = URL.createObjectURL(svg_blob)
	link.click()
	link.remove()
}

/*
	mainGsel      a d3 selection of root g element(s) of svg(s), expected to contain all
		            the rendered plot elements that can be copied into one svg
	
	svgName      the filename to use for the downloaded svg file

	styleParent   optional, the div or svg element to use for computing styles to apply to
	              the svg, so that the standlone image file would preseve the browser-displayed
	              svg look/appearance
*/
export function downloadChart(mainGsel, svgName, styleParent = null) {
	// has to be able to handle multichart view
	const mainGs = []
	const translate = { x: undefined, y: undefined }
	const titles = []
	let maxw = 0,
		maxh = 0,
		tboxh = 0
	let prevY = 0,
		numChartsPerRow = 0

	mainGsel.each(function () {
		mainGs.push(this)
		const bbox = this.getBBox()
		if (bbox.width > maxw) maxw = bbox.width
		if (bbox.height > maxh) maxh = bbox.height
		const divY = Math.round(this.parentNode.parentNode.getBoundingClientRect().y)
		if (!numChartsPerRow) {
			prevY = divY
			numChartsPerRow++
		} else if (Math.abs(divY - prevY) < 5) {
			numChartsPerRow++
		}
		const xy = select(this)
			.attr('transform')
			.split('translate(')[1]
			.split(')')[0]
			.split(',')
			.map(d => +d.trim())

		if (translate.x === undefined || xy[0] > translate.x) translate.x = +xy[0]
		if (translate.y === undefined || xy[1] > translate.y) translate.y = +xy[1]

		const title = this.parentNode.parentNode.firstChild
		const tbox = title.getBoundingClientRect()
		if (tbox.width > maxw) maxw = tbox.width
		if (tbox.height > tboxh) tboxh = tbox.height
		titles.push({ text: title.innerText, styles: window.getComputedStyle(title), tbox })
	})

	// add padding between charts
	maxw += 80
	maxh += 80

	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')

	const svgSel = select(svg)
		.style('display', 'block')
		.style('opacity', 1)
		.attr('width', numChartsPerRow * maxw)
		.attr('height', Math.floor(mainGs.length / numChartsPerRow) * maxh)

	if (styleParent) {
		const svgStyles = window.getComputedStyle(styleParent)
		for (const prop of svgStyles) {
			if (prop.startsWith('font')) svgSel.style(prop, svgStyles.getPropertyValue(prop))
		}
	}

	mainGs.forEach((g, i) => {
		const mainG = g.cloneNode(true)
		const colNum = i % numChartsPerRow
		const rowNum = Math.floor(i / numChartsPerRow)
		const corner = { x: colNum * maxw + translate.x + 80, y: rowNum * maxh + translate.y }
		const title = select(svg)
			.append('text')
			.attr('transform', 'translate(' + (corner.x + titles[i].tbox.width / 2 - 100) + ',' + corner.y + ')')
			.text(titles[i].text)
		for (const prop of titles[i].styles) {
			if (prop.startsWith('font')) title.style(prop, titles[i].styles.getPropertyValue(prop))
		}

		select(mainG).attr('transform', 'translate(' + corner.x + ',' + (corner.y + tboxh) + ')')
		svg.appendChild(mainG)
	})

	to_svg(svg, svgName, { apply_dom_styles: true })
}

export function downloadSVGsAsPdf(name2svg, filename = 'charts.pdf') {
	const doc = new jsPDF('p', 'pt', 'a4') // Portrait, points, A4 size
	let item
	const entries = Object.entries(name2svg)
	for (const [name, svg] of entries) {
		if (!item) item = addSvgToPdf(doc, svg, name)
		else item = item.then(() => addSvgToPdf(doc, svg, name))
	}
	item.then(() => {
		doc.deletePage(entries.length + 1) // Remove the last empty page
		doc.save(filename)
	})
}

function addSvgToPdf(doc, svg, name) {
	const item = doc.svg(svg, { x: 10, y: 40, width: 1000, height: 1000 }).then(() => {
		doc.text(name, 10, 20)
		doc.addPage()
	})
	return item
}
