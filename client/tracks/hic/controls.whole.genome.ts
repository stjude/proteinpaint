import { bplen } from '#shared/common'
import { nmeth2select } from './hic.straw'

/**
 * Renders control panel for hicstraw app (ie whole genome, chr-chr pair, and detail views)
 * @param hic
 * @returns
 */
export function initWholeGenomeControls(hic: any, self: any) {
	const menuWrapper = self.dom.controlsDiv
		.style('background', 'rgb(253, 250, 244)')
		.style('vertical-align', 'top')
		.style('padding', '5px')
		.style('border', 'solid 0.5px #ccc')

	//Menu open by default
	let menuVisible = true
	//Burger btn
	self.dom.controlsDiv
		.append('button')
		.style('display', 'block')
		.style('border', 'none')
		.style('font-size', '1.5em')
		.style('background', 'none')
		.html('&#8801;')
		.on('click', () => {
			menuVisible = !menuVisible
			menu.style('display', menuVisible ? 'block' : 'none')
		})
	const menu = menuWrapper
		.append('div')
		.attr('class', 'sjpp-hic-menu')
		.style('display', menuVisible ? 'block' : 'none')
	const menuTable = menu.append('table').style('border-spacing', '3px')
	if (hic.enzyme) {
		const enzymeRow = menuTable.append('tr')
		addLabel(enzymeRow, 'ENZYME')
		enzymeRow.append('td').text(hic.enzyme)
	}

	const normalizationRow = menuTable.append('tr')
	addLabel(normalizationRow, 'NORMALIZATION')
	self.dom.nmeth = normalizationRow.append('td') //placeholder until data is returned from server

	const cutoffRow = menuTable.append('tr')
	addLabel(cutoffRow, 'CUTOFF')
	self.dom.inputBpMaxv = cutoffRow
		.append('td')
		.append('input')
		.style('width', '80px')
		.style('margin-left', '0px')
		.attr('type', 'number')
		.property('value', hic.wholegenome.bpmaxv)
		.on('keyup', (event: KeyboardEvent) => {
			if (event.code != 'Enter') return
			const v: any = (event.target as HTMLInputElement).value
			if (v <= 0) return hic.error('invalid cutoff value')
			setmaxv(hic, v)
		})

	const resolutionRow = menuTable.append('tr')
	addLabel(resolutionRow, 'RESOLUTION')
	self.dom.resolutionInput = resolutionRow.append('td').append('span')

	const viewRow = menuTable.append('tr')
	addLabel(viewRow, 'VIEW')
	self.dom.viewBtnDiv = viewRow.append('td')
	self.dom.view = self.dom.viewBtnDiv.append('span').style('padding-right', '5px').style('display', 'block')

	hic.wholegenomebutton = self.dom.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.html('&#8592; Genome')
		.on('click', () => {
			self.dom.view.text('Genome')
			self.dom.zoomRow.style('display', 'none')
			self.dom.detailView.style('display', 'none')
			hic.inwholegenome = true
			hic.inchrpair = false
			hic.indetail = false
			switchview(hic, self)
		})

	hic.chrpairviewbutton = self.dom.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.on('click', () => {
			self.dom.detailView.style('display', 'none')
			self.dom.zoomRow.style('display', 'none')
			hic.inwholegenome = false
			hic.inchrpair = true
			hic.indetail = false
			switchview(hic, self)
		})

	self.dom.zoomRow = menuTable.append('tr').style('display', 'none')
	addLabel(self.dom.zoomRow, 'ZOOM')
	const zoomDiv = self.dom.zoomRow.append('td')
	self.dom.zoomIn = zoomDiv.append('button').text('In')
	self.dom.zoomOut = zoomDiv.append('button').text('Out')
	const detailView = menuTable.append('tr')
	detailView.append('td') //Leave blank
	self.dom.detailView = detailView.append('td').style('display', 'none')
	self.dom.horizontalView = self.dom.detailView.append('button').text('Horizontal View')
}

function addLabel(tr: any, text: string) {
	return tr.append('td').style('color', '#858585').style('vertical-align', 'top').style('font-size', '.8em').text(text)
}

/**
 * setting max value from user input
 * @param hic
 * @param maxv
 * @returns
 */
function setmaxv(hic: any, maxv: any) {
	if (hic.inwholegenome) {
		// viewing whole genome
		hic.wholegenome.bpmaxv = maxv
		if (!hic.wholegenome.lead2follow) return
		const binpx = hic.wholegenome.binpx
		for (const [lead, a] of hic.wholegenome.lead2follow) {
			for (const [follow, b] of a) {
				for (const [leadpx, followpx, v] of b.data) {
					const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
					b.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx.fillRect(followpx, leadpx, binpx, binpx)
					b.ctx2.fillStyle = 'rgb(255,' + p + ',' + p + ')'
					b.ctx2.fillRect(leadpx, followpx, binpx, binpx)
				}
				b.img.attr('xlink:href', b.canvas.toDataURL())
				if (b.canvas2) {
					b.img2.attr('xlink:href', b.canvas2.toDataURL())
				}
			}
		}
		return
	}
	if (hic.inchrpair) {
		// viewing chr pair
		hic.chrpairview.bpmaxv = maxv
		const binpx = hic.chrpairview.binpx
		for (const [x, y, v] of hic.chrpairview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.chrpairview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.chrpairview.ctx.fillRect(x, y, binpx, binpx)
			if (hic.chrpairview.isintrachr) {
				hic.chrpairview.ctx.fillRect(y, x, binpx, binpx)
			}
		}
		return
	}
	if (hic.indetail) {
		hic.detailview.bpmaxv = maxv
		for (const [x, y, w, h, v] of hic.detailview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			hic.detailview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			hic.detailview.ctx.fillRect(x, y, w, h)
		}
	}
}

/**
 * by clicking buttons
 * only for switching to whole genome view
 * @param hic
 */
function switchview(hic: any, self: any) {
	if (hic.inwholegenome) {
		self.dom.plotDiv.xAxis.selectAll('*').remove()
		self.dom.plotDiv.yAxis.selectAll('*').remove()
		self.dom.plotDiv.plot.selectAll('*').remove()
		self.dom.plotDiv.plot.node().appendChild(hic.wholegenome.svg.node())
		hic.wholegenomebutton.style('display', 'none')
		hic.chrpairviewbutton.style('display', 'none')
		self.dom.inputBpMaxv.property('value', hic.wholegenome.bpmaxv)
		self.dom.resolutionInput.text(bplen(hic.wholegenome.resolution) + ' bp')
		nmeth2select(hic, hic.wholegenome.nmeth)
	} else if (hic.inchrpair) {
		self.dom.plotDiv.yAxis.selectAll('*').remove()
		self.dom.plotDiv.yAxis.node().appendChild(hic.chrpairview.axisy.node())
		self.dom.plotDiv.xAxis.selectAll('*').remove()
		self.dom.plotDiv.xAxis.node().appendChild(hic.chrpairview.axisx.node())
		self.dom.plotDiv.plot.selectAll('*').remove()
		self.dom.plotDiv.plot.node().appendChild(hic.chrpairview.canvas)
		hic.wholegenomebutton.style('display', 'inline-block')
		hic.chrpairviewbutton.style('display', 'none')
		self.dom.inputBpMaxv.property('value', hic.chrpairview.bpmaxv)
		self.dom.resolutionInput.text(bplen(hic.chrpairview.resolution) + ' bp')
		nmeth2select(hic, hic.chrpairview.nmeth)
	}
}
