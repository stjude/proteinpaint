import { bplen } from '#shared/common'
import { nmeth2select } from './hic.straw'
import { getdata_chrpair, getdata_detail, getdata_leadfollow, defaultnmeth } from './hic.straw'

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
		.property('value', hic.wholegenome.bpmaxv)
		.on('keyup', (event: KeyboardEvent) => {
			if (event.code != 'Enter') return
			const v: any = (event.target as HTMLInputElement).value
			if (v <= 0) return hic.error('invalid cutoff value')
			setmaxv(hic, v)
		})

	const resolutionRow = menuTable.append('tr')
	addLabel(resolutionRow, 'RESOLUTION')
	self.dom.controlsDiv.resolutionInput = resolutionRow.append('td').append('span')

	const viewRow = menuTable.append('tr')
	addLabel(viewRow, 'VIEW')
	self.dom.controlsDiv.viewBtnDiv = viewRow.append('td')
	self.dom.controlsDiv.view = self.dom.controlsDiv.viewBtnDiv
		.append('span')
		.style('padding-right', '5px')
		.style('display', 'block')

	hic.wholegenomebutton = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.html('&#8592; Genome')
		.on('click', () => {
			self.dom.controlsDiv.view.text('Genome')
			self.dom.controlsDiv.zoom.style('display', 'none')
			hic.inwholegenome = true
			hic.inchrpair = false
			hic.indetail = false
			switchview(hic, self)
		})

	hic.chrpairviewbutton = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.on('click', () => {
			self.dom.controlsDiv.zoom.style('display', 'none')
			hic.inwholegenome = false
			hic.inchrpair = true
			hic.indetail = false
			switchview(hic, self)
		})

	hic.horizontalViewBtn = self.dom.controlsDiv.viewBtnDiv
		.append('button')
		.style('display', 'none')
		.html('Horizontal View &#8594;')

	self.dom.controlsDiv.zoom = menuTable.append('tr').style('display', 'none')
	addLabel(self.dom.controlsDiv.zoom, 'ZOOM')
	const zoomDiv = self.dom.controlsDiv.zoom.append('td')
	self.dom.controlsDiv.zoom.in = zoomDiv.append('button').style('margin-right', '10px').text('In')
	self.dom.controlsDiv.zoom.out = zoomDiv.append('button').style('margin-right', '10px').text('Out')
}

function addLabel(tr: any, text: string) {
	return tr.append('td').style('color', '#858585').style('vertical-align', 'top').style('font-size', '.8em').text(text)
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
	if (hic.inwholegenome) {
		hic.wholegenome.nmeth = nmeth
		const manychr = hic.atdev ? 3 : hic.chrlst.length
		for (let i = 0; i < manychr; i++) {
			const lead = hic.chrlst[i]
			for (let j = 0; j <= i; j++) {
				const follow = hic.chrlst[j]
				try {
					await getdata_leadfollow(hic, lead, follow)
				} catch (e: any) {
					hic.errList.push(e.message || e)
				}
			}
		}
		if (hic.errList.length) hic.error(hic.errList)
		return
	}

	if (hic.inchrpair) {
		hic.chrpairview.nmeth = nmeth
		await getdata_chrpair(hic, self)
		return
	}
	if (hic.indetail) {
		hic.detailview.nmeth = nmeth
		getdata_detail(hic, self)
	}
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
		hic.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.inputBpMaxv.property('value', hic.wholegenome.bpmaxv)
		self.dom.controlsDiv.resolutionInput.text(bplen(hic.wholegenome.resolution) + ' bp')
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
		hic.horizontalViewBtn.style('display', 'none')
		self.dom.controlsDiv.inputBpMaxv.property('value', hic.chrpairview.bpmaxv)
		self.dom.controlsDiv.resolutionInput.text(bplen(hic.chrpairview.resolution) + ' bp')
		nmeth2select(hic, hic.chrpairview.nmeth)
	}
}
