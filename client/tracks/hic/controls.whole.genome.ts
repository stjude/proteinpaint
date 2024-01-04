import { bplen } from '#shared/common'
import { nmeth2select } from './hic.straw'
import { getdata_chrpair, getdata_detail, getdata_leadfollow, defaultnmeth } from './hic.straw'
import { Elem } from '../../types/d3'

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
	self.dom.controlsDiv.nmeth = normalizationRow.append('td') //placeholder until data is returned from server
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

	// const matrixTypeRow = menuTable.append('tr')
	// addLabel(matrixTypeRow, 'matrix type') //Display option is another name? Data type? No label?
	// self.dom.controlsDiv.matrixType = matrixTypeRow.append('td').text('Observed')

	// Drop down
	const matrixTypeRow = menuTable.append('tr')
	addLabel(matrixTypeRow, 'MATRIX TYPE')
	const matrixTypeDropdownContainer = matrixTypeRow.append('td')
	const matrixTypeDropdown = matrixTypeDropdownContainer.append('select').on('change', () => {
		const selectedOption = matrixTypeDropdown.property('value')
		// Handle the selected option as needed
		console.log('Selected Matrix Type:', selectedOption)
	})

	// Options for the dropdown
	const matrixTypeOptions = ['Observed', 'Expected', 'Observed/Expected']

	// Populate dropdown with options
	matrixTypeOptions.forEach(option => {
		matrixTypeDropdown.append('option').attr('value', option.toLowerCase()).text(option)
	})
	self.dom.controlsDiv.matrixType = matrixTypeDropdownContainer // Update the reference to the dropdown container

	const viewRow = menuTable.append('tr')
	addLabel(viewRow, 'VIEW')
	self.dom.controlsDiv.viewBtnDiv = viewRow.append('td')
	self.dom.controlsDiv.view = self.dom.controlsDiv.viewBtnDiv
		.append('span')
		.style('padding-right', '5px')
		.style('display', 'block')

	self.dom.controlsDiv.wholegenomebutton = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.html('&#8592; Genome')
		.on('click', () => {
			self.dom.controlsDiv.view.text('Genome')
			self.dom.controlsDiv.zoomDiv.style('display', 'none')
			self.inwholegenome = true
			self.inchrpair = false
			self.indetail = false
			switchview(hic, self)
		})

	self.dom.controlsDiv.chrpairviewbutton = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.on('click', () => {
			self.dom.controlsDiv.zoomDiv.style('display', 'none')
			self.inwholegenome = false
			self.inchrpair = true
			self.indetail = false
			switchview(hic, self)
		})

	self.dom.controlsDiv.horizontalViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.html('Horizontal View &#8594;')

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

function makeNormMethDisplay(hic: any, self: any) {
	if (!hic.normalization?.length) {
		hic.nmethselect = self.dom.controlsDiv.nmeth.text(defaultnmeth)
	} else {
		hic.nmethselect = self.dom.controlsDiv.nmeth
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				const v = hic.nmethselect.node().value
				await setnmeth(hic, v, self)
			})
		for (const n of hic.normalization) {
			hic.nmethselect.append('option').text(n)
		}
	}
}

async function setnmeth(hic: any, nmeth: string, self: any) {
	if (self.inwholegenome) {
		self.wholegenome.nmeth = nmeth
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
		self.chrpairview.nmeth = nmeth
		await getdata_chrpair(hic, self)
		return
	}
	if (self.indetail) {
		self.detailview.nmeth = nmeth
		getdata_detail(hic, self)
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
 * by clicking buttons
 * only for switching to whole genome view
 * @param hic
 */
function switchview(hic: any, self: any) {
	if (self.inwholegenome) {
		console.log(self.wholegenome.nmeth)
		nmeth2select(hic, self.wholegenome)
		self.dom.plotDiv.xAxis.selectAll('*').remove()
		self.dom.plotDiv.yAxis.selectAll('*').remove()
		self.dom.plotDiv.plot.selectAll('*').remove()
		self.dom.plotDiv.plot.node().appendChild(self.wholegenome.svg.node())
		self.dom.controlsDiv.wholegenomebutton.style('display', 'none')
		self.dom.controlsDiv.chrpairviewbutton.style('display', 'none')
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.inputBpMaxv.property('value', self.wholegenome.bpmaxv)
		self.dom.controlsDiv.resolution.text(bplen(self.wholegenome.resolution) + ' bp')
	} else if (self.inchrpair) {
		nmeth2select(hic, self.chrpairview)
		self.dom.plotDiv.yAxis.selectAll('*').remove()
		self.dom.plotDiv.yAxis.node().appendChild(self.chrpairview.axisy.node())
		self.dom.plotDiv.xAxis.selectAll('*').remove()
		self.dom.plotDiv.xAxis.node().appendChild(self.chrpairview.axisx.node())
		self.dom.plotDiv.plot.selectAll('*').remove()
		self.dom.plotDiv.plot.node().appendChild(self.chrpairview.canvas)
		self.dom.controlsDiv.wholegenomebutton.style('display', 'inline-block')
		self.dom.controlsDiv.chrpairviewbutton.style('display', 'none')
		self.dom.controlsDiv.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.inputBpMaxv.property('value', self.chrpairview.bpmaxv)
		self.dom.controlsDiv.resolution.text(bplen(self.chrpairview.resolution) + ' bp')
	}
}
