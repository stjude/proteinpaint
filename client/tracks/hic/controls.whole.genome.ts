import { bplen } from '#shared/common'
import { nmeth2select, matrixType2select } from './hic.straw'
import { getdata_chrpair, getdata_detail, getdata_leadfollow, defaultnmeth, showBtns } from './hic.straw'
import { Elem } from '../../types/d3'
import blocklazyload from '#src/block.lazyload'

/**
 * Renders control panel for hicstraw app (ie whole genome, chr-chr pair, horizontal and detail views)
 * Some of the view button text and functionality updated in hic.straw.ts
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
	self.dom.controlsDiv.nmeth = normalizationRow.append('td').attr('class', 'sjpp-nmeth-select')
	makeNormMethDisplay(hic, self)

	const cutoffRow = menuTable.append('tr')
	addLabel(cutoffRow, 'CUTOFF')
	self.dom.controlsDiv.inputBpMaxv = cutoffRow
		.append('td')
		.append('input')
		.style('width', '80px')
		.style('margin-left', '0px')
		.attr('type', 'number')
		.property('value', self.wholegenome.bpmaxv)
		.on('keyup', (event: KeyboardEvent) => {
			if (event.code != 'Enter') return
			const v: any = (event.target as HTMLInputElement).value
			if (v <= 0) return self.error('invalid cutoff value')
			setmaxv(self, v)
		})

	const resolutionRow = menuTable.append('tr')
	addLabel(resolutionRow, 'RESOLUTION')
	self.dom.controlsDiv.resolution = resolutionRow.append('td').append('span')

	const matrixTypeRow = menuTable.append('tr')
	addLabel(matrixTypeRow, 'matrix type')
	self.dom.controlsDiv.matrixType = matrixTypeRow
		.append('td')
		.style('margin-right', '10px')
		.append('select')
		.on('change', async () => {
			const matrixType = self.dom.controlsDiv.matrixType.node().value
			if (self.inwholegenome) self.wholegenome.matrixType = matrixType
			if (self.inchrpair) self.chrpairview.matrixType = matrixType
			if (self.indetail) self.detailview.matrixType = matrixType
			await getData(hic, self)
		})
	const matrixTypevalues = [
		//Allow for customer friendly labels but pass the appropriate straw parameter
		{ label: 'Observed', value: 'observed' },
		{ label: 'Expected', value: 'expected' },
		{ label: 'Observed/Expected', value: 'oe' }
	]
	for (const matrixType of matrixTypevalues) {
		self.dom.controlsDiv.matrixType.append('option').text(matrixType.label).attr('value', matrixType.value)
	}

	const viewRow = menuTable.append('tr')
	addLabel(viewRow, 'VIEW')
	self.dom.controlsDiv.viewBtnDiv = viewRow.append('td')
	self.dom.controlsDiv.view = self.dom.controlsDiv.viewBtnDiv
		.append('span')
		.style('padding-right', '5px')
		.style('display', 'block')

	self.dom.controlsDiv.genomeViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.style('padding', '2px')
		.style('margin-top', '4px')
		.html('&#8810; Genome')
		.on('click', () => {
			self.dom.controlsDiv.view.text('Genome')
			self.dom.controlsDiv.zoomDiv.style('display', 'none')
			self.inwholegenome = true
			self.inchrpair = false
			self.inhorizontal = false
			self.indetail = false
			switchview(hic, self)
		})

	self.dom.controlsDiv.chrpairViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.style('padding', '2px')
		.style('margin', '4px 0px')
		.on('click', () => {
			self.dom.controlsDiv.zoomDiv.style('display', 'none')
			self.inwholegenome = false
			self.inchrpair = true
			self.inhorizontal = false
			self.indetail = false
			switchview(hic, self)
		})

	self.dom.controlsDiv.horizontalViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.style('padding', '2px')
		.style('margin', '4px 0px')
		.html('&#8810; Horizontal View')
		.on('click', () => {
			self.inwholegenome = false
			self.inchrpair = false
			self.inhorizontal = true
			self.indetail = false
			switchview(hic, self)
		})

	self.dom.controlsDiv.detailViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.style('padding', '2px')
		.style('margin', '4px 0px')
		.html('Detailed View &#8811;')

	self.dom.controlsDiv.zoomDiv = menuTable.append('tr').style('display', 'none')
	addLabel(self.dom.controlsDiv.zoomDiv, 'ZOOM')
	const zoomDiv = self.dom.controlsDiv.zoomDiv.append('td')
	self.dom.controlsDiv.zoomIn = zoomDiv.append('button').style('margin-right', '10px').text('In')
	self.dom.controlsDiv.zoomOut = zoomDiv.append('button').style('margin-right', '10px').text('Out')
}

function addLabel(tr: Elem, text: string) {
	return tr
		.append('td')
		.style('color', '#858585')
		.style('vertical-align', 'top')
		.style('font-size', '.8em')
		.text(text.toUpperCase())
}

/**
 * Show either NONE if no normalization methods present in the hic file of dropdown of normalization methods
 * read from the hic file.
 * @param hic File input
 * @param self App object
 */
function makeNormMethDisplay(hic: any, self: any) {
	if (!hic.normalization?.length) {
		hic.nmethselect = self.dom.controlsDiv.nmeth.text(defaultnmeth)
	} else {
		hic.nmethselect = self.dom.controlsDiv.nmeth
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				const nmeth = hic.nmethselect.node().value
				if (self.inwholegenome) self.wholegenome.nmeth = nmeth
				if (self.inchrpair) self.chrpairview.nmeth = nmeth
				if (self.indetail) self.detailview.nmeth = nmeth
				await getData(hic, self)
			})
		for (const n of hic.normalization) {
			hic.nmethselect.append('option').text(n)
		}
	}
}

/**
 * Get data from user inputs ()
 * @param hic
 * @param self
 * @returns
 */
async function getData(hic: any, self: any) {
	if (self.inwholegenome) {
		const manychr = hic.atdev ? 3 : hic.chrlst.length
		for (let i = 0; i < manychr; i++) {
			const lead = hic.chrlst[i]
			for (let j = 0; j <= i; j++) {
				const follow = hic.chrlst[j]
				try {
					await getdata_leadfollow(hic, lead, follow, self)
				} catch (e: any) {
					self.errList.push(e.message || e)
				}
			}
		}
		if (self.errList.length) self.error(self.errList)
		return
	}

	if (self.inchrpair) {
		await getdata_chrpair(hic, self)
		return
	}

	if (self.indetail) {
		getdata_detail(hic, self)
		return
	}
}

/**
 * setting max value from user input
 * @param hic
 * @param maxv
 * @returns
 */
function setmaxv(self: any, maxv: number) {
	if (self.inwholegenome) {
		// viewing whole genome
		self.wholegenome.bpmaxv = maxv
		if (!self.wholegenome.lead2follow) return
		const binpx = self.wholegenome.binpx
		for (const [lead, a] of self.wholegenome.lead2follow) {
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
	if (self.inchrpair) {
		// viewing chr pair
		self.chrpairview.bpmaxv = maxv
		const binpx = self.chrpairview.binpx
		for (const [x, y, v] of self.chrpairview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			self.chrpairview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			self.chrpairview.ctx.fillRect(x, y, binpx, binpx)
			if (self.chrpairview.isintrachr) {
				self.chrpairview.ctx.fillRect(y, x, binpx, binpx)
			}
		}
		return
	}
	if (self.indetail) {
		self.detailview.bpmaxv = maxv
		for (const [x, y, w, h, v] of self.detailview.data) {
			const p = v >= maxv ? 0 : Math.floor((255 * (maxv - v)) / maxv)
			self.detailview.ctx.fillStyle = 'rgb(255,' + p + ',' + p + ')'
			self.detailview.ctx.fillRect(x, y, w, h)
		}
	}
}

/**
 * Click buttons in menu to switch between views (whole genome, chr-chr pair, detail, horizontal).
 * Launches or rerenders previously created views.
 * @param hic
 */
function switchview(hic: any, self: any) {
	//Remove all previous elements
	self.dom.plotDiv.xAxis.selectAll('*').remove()
	self.dom.plotDiv.yAxis.selectAll('*').remove()
	self.dom.plotDiv.plot.selectAll('*').remove()

	if (self.inwholegenome) {
		nmeth2select(hic, self.wholegenome)
		matrixType2select(self.wholegenome, self)
		self.dom.plotDiv.plot.node().appendChild(self.wholegenome.svg.node())
		self.dom.controlsDiv.inputBpMaxv.property('value', self.wholegenome.bpmaxv)
		self.dom.controlsDiv.resolution.text(bplen(self.wholegenome.resolution) + ' bp')
	} else if (self.inchrpair) {
		nmeth2select(hic, self.chrpairview)
		matrixType2select(self.chrpairview, self)
		self.dom.plotDiv.yAxis.node().appendChild(self.chrpairview.axisy.node())
		self.dom.plotDiv.xAxis.node().appendChild(self.chrpairview.axisx.node())
		self.dom.plotDiv.plot.node().appendChild(self.chrpairview.canvas)
		self.dom.controlsDiv.inputBpMaxv.property('value', self.chrpairview.bpmaxv)
		self.dom.controlsDiv.resolution.text(bplen(self.chrpairview.resolution) + ' bp')
	} else if (self.indetail) {
		nmeth2select(hic, self.detailview)
		matrixType2select(self.detailview, self)
	} else if (self.inhorizontal) {
		//TODO: Problem with this is it rerenders. Maybe a way to save the rendering and just show/hide?
		blocklazyload(self.horizontalview.args)
	}

	showBtns(self)
}
