import { getCompInit } from '#rx'
import { Elem, Tr } from '../../../types/d3'
import { NormalizationMethodControl } from './normMeth'
import { CutoffControl } from './cutoff'
import { MatrixTypeControl } from './matrixType'

// import { bplen } from '#shared/common'
// import {
// 	nmeth2select,
// 	matrixType2select,
// 	getdata_chrpair,
// 	getdata_detail,
// 	defaultnmeth,
// 	showBtns,
// 	makeWholeGenomeElements,
// 	colorizeElement
// } from '../views/hic.straw'
// import blocklazyload from '#src/block.lazyload'

// /**
// ********* EXPORTED *********

// init_hicControls()

// ********* INTERNAL *********
// addLabel()
// makeNormMethDisplay()
// getData()
// setmaxv()
// switchview()

// see function documentation for more details
//  */

// /**
//  * Renders control panel for hicstraw app (ie whole genome, chr-chr pair, horizontal and detail views)
//  * Some of the view button text and functionality updated in hic.straw.ts
//  * @param hic formatted input
//  * @param self app obj
//  * @returns control panel for the app
//  */

class ControlPanel {
	app: any
	controls: {
		nmeth?: any
		inputBpMinV?: any
		inputBpMaxV?: any
		matrixType?: any
		view?: any
		genomeViewBtn?: any
		chrpairViewBtn?: any
		horizontalViewBtn?: any
		detailViewBtn?: any
		zoomDiv?: any
		zoomIn?: any
		zoomOut?: any
	}
	controlsDiv: Elem
	/** replace with type arg */
	hic: any
	type: 'controlPanel'
	state: any
	hasStatePreMain: boolean

	constructor(opts) {
		this.type = 'controlPanel'
		this.app = opts.app
		this.controls = {}
		this.controlsDiv = opts.controlsDiv
		this.hic = opts.hic
		;(this.state = opts.state), (this.hasStatePreMain = true)
	}

	addLabel(tr: Tr, text: string) {
		return tr
			.append('td')
			.style('color', '#858585')
			.style('font-size', '.8em')
			.style('vertical-align', text.toUpperCase() == 'VIEW' ? 'top' : 'middle')
			.text(text.toUpperCase())
	}

	init() {
		const menuWrapper = this.controlsDiv
			.style('background', 'rgb(253, 250, 244)')
			.style('vertical-align', 'top')
			.style('padding', '5px')
			.style('border', 'solid 0.5px #ccc')

		//Menu open by default
		let menuVisible = true
		//Burger btn
		this.controlsDiv
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

		//Normalization
		const normalizationRow = menuTable.append('tr') as any
		this.addLabel(normalizationRow, 'NORMALIZATION')
		this.controls.nmeth = normalizationRow.append('td').attr('class', 'sjpp-nmeth-select') as any
		new NormalizationMethodControl(this.state, this.controls.nmeth, this.hic.normalization).render()

		//***Cutoffs
		//Min CUTOFF
		const minCutoffRow = menuTable.append('tr') as any
		this.addLabel(minCutoffRow, 'Min CUTOFF')
		//**** CHANGE TO THE VIEW VALUE */
		this.controls.inputBpMinV = new CutoffControl(this.state, minCutoffRow.append('td'), 0).render()

		//Max CUTOFF
		const maxCutoffRow = menuTable.append('tr') as any
		this.addLabel(maxCutoffRow, 'Max CUTOFF')
		//**** CHANGE TO THE VIEW VALUE */
		this.controls.inputBpMaxV = new CutoffControl(this.state, maxCutoffRow.append('td'), 0).render()

		//Matrix type
		const matrixTypeRow = menuTable.append('tr') as any
		this.addLabel(matrixTypeRow, 'matrix type')
		this.controls.matrixType = new MatrixTypeControl(matrixTypeRow.append('td')).render()

		const viewRow = menuTable.append('tr') as any
		this.addLabel(viewRow, 'VIEW')
		const viewBtnDiv = viewRow.append('td')
		this.controls.view = viewBtnDiv
			.append('span')
			.style('padding-right', '5px')
			.style('display', 'block')
			.text(this.state.currView.charAt(0).toUpperCase() + this.state.currView.slice(1))

		this.controls.genomeViewBtn = viewBtnDiv
			.append('button')
			.style('display', 'none')
			.style('padding', '2px')
			.style('margin-top', '4px')
			.html('&#8810; Genome')
			.on('click', async () => {
				await this.app.dispatch({
					type: 'view_change',
					view: 'genome'
				})
			})

		this.controls.chrpairViewBtn = viewBtnDiv
			.append('button')
			.style('display', 'none')
			.style('padding', '2px')
			.style('margin', '4px 0px')
			.on('click', async () => {
				await this.app.dispatch({
					type: 'view_change',
					view: 'chrpair'
				})
			})

		this.controls.horizontalViewBtn = viewBtnDiv
			.append('button')
			.style('display', 'none')
			.style('padding', '2px')
			.style('margin', '4px 0px')
			.html('Horizontal View &#8811;')
			.on('click', async () => {
				await this.app.dispatch({
					type: 'view_change',
					view: 'horizontal'
				})
			})

		this.controls.detailViewBtn = viewBtnDiv
			.append('button')
			.style('display', 'none')
			.style('padding', '2px')
			.style('margin', '4px 0px')
			.html('&#8810; Detailed View')
			.on('click', async () => {
				await this.app.dispatch({
					type: 'view_change',
					view: 'detail'
				})
			})

		this.controls.zoomDiv = menuTable
			.append('tr')
			.style('display', this.state.currView == 'detail' ? 'contents' : 'none') as any
		this.addLabel(this.controls.zoomDiv, 'ZOOM')
		const zoomDiv = this.controls.zoomDiv.append('td')
		this.controls.zoomIn = zoomDiv.append('button').style('margin-right', '10px').text('In')
		this.controls.zoomOut = zoomDiv.append('button').style('margin-right', '10px').text('Out')
	}

	showBtns() {
		this.controls.genomeViewBtn.style('display', this.state.currView === 'genome' ? 'none' : 'inline-block')

		if (this.state.currView === 'detail') {
			//state.x and state.y?
			// this.controls.chrpairViewBtn.html(`&#8810; Entire ${self.x.chr}-${self.y.chr}`).style('display', 'block')
			//Only show horizontalViewBtn and zoom buttons in detail view
			this.controls.horizontalViewBtn.style('display', 'block')
			this.controls.zoomDiv.style('display', 'contents')
			//Hide previously shown detail view btn
			this.controls.detailViewBtn.style('display', 'none')
		} else if (this.state.currView === 'horizontal') {
			//Only show chrpairViewBtn if in horizonal or detail view
			//Include chr x and chr y in the button text
			//state.x and state.y?
			//this.controls.chrpairViewBtn.html(`&#8810; Entire ${self.x.chr}-${self.y.chr}`).style('display', 'block')
			//Only show detailViewBtn in horizontal view
			this.controls.detailViewBtn.style('display', 'block')
			//Hide if horizontal and zoom btns if previously displayed
			this.controls.horizontalViewBtn.style('display', 'none')
			this.controls.zoomDiv.style('display', 'none')
		} else {
			this.controls.chrpairViewBtn.style('display', 'none')
			this.controls.horizontalViewBtn.style('display', 'none')
			this.controls.detailViewBtn.style('display', 'none')
			this.controls.zoomDiv.style('display', 'none')
		}
	}

	//Acts as the update method
	//Maybe separate if need something differences from init()
	main() {
		this.controls.zoomDiv.style('display', this.state.currView == 'detail' ? 'contents' : 'none')

		this.showBtns()
	}
}

export const controlPanelInit = getCompInit(ControlPanel)

// export function init_hicControls(hic: any, self: any) {
// 	const menuWrapper = self.dom.controlsDiv
// 		.style('background', 'rgb(253, 250, 244)')
// 		.style('vertical-align', 'top')
// 		.style('padding', '5px')
// 		.style('border', 'solid 0.5px #ccc')

// 	//Menu open by default
// 	let menuVisible = true
// 	//Burger btn
// 	self.dom.controlsDiv
// 		.append('button')
// 		.style('display', 'block')
// 		.style('border', 'none')
// 		.style('font-size', '1.5em')
// 		.style('background', 'none')
// 		.html('&#8801;')
// 		.on('click', () => {
// 			menuVisible = !menuVisible
// 			menu.style('display', menuVisible ? 'block' : 'none')
// 		})
// 	const menu = menuWrapper
// 		.append('div')
// 		.attr('class', 'sjpp-hic-menu')
// 		.style('display', menuVisible ? 'block' : 'none')
// 	const menuTable = menu.append('table').style('border-spacing', '3px')

// 	const normalizationRow = menuTable.append('tr')
// 	addLabel(normalizationRow, 'NORMALIZATION')
// 	self.dom.controlsDiv.nmeth = normalizationRow.append('td').attr('class', 'sjpp-nmeth-select')
// 	makeNormMethDisplay(hic, self)

// 	const cutoffRow = menuTable.append('tr')
// 	addLabel(cutoffRow, 'CUTOFF')
// 	self.dom.controlsDiv.inputBpMaxv = cutoffRow
// 		.append('td')
// 		.append('input')
// 		.style('width', '80px')
// 		.style('margin-left', '0px')
// 		.attr('type', 'number')
// 		.property('value', self.genomeview.bpmaxv)
// 		.on('keyup', (event: KeyboardEvent) => {
// 			if (event.code != 'Enter') return
// 			const v: any = (event.target as HTMLInputElement).value
// 			if (v <= 0) return self.error('invalid cutoff value')
// 			setmaxv(self, v)
// 		})

// 	const matrixTypeRow = menuTable.append('tr')
// 	addLabel(matrixTypeRow, 'matrix type')
// 	self.dom.controlsDiv.matrixType = matrixTypeRow
// 		.append('td')
// 		.style('margin-right', '10px')
// 		.append('select')
// 		.on('change', async () => {
// 			const matrixType = self.dom.controlsDiv.matrixType.node().value
// 			if (self.ingenome) self.genomeview.matrixType = matrixType
// 			if (self.inchrpair) self.chrpairview.matrixType = matrixType
// 			if (self.indetail) self.detailview.matrixType = matrixType
// 			await getData(hic, self)
// 		})
// 	const matrixTypevalues = [
// 		//Allow for customer friendly labels but pass the appropriate straw parameter
// 		{ label: 'Observed', value: 'observed' },
// 		{ label: 'Expected', value: 'expected' },
// 		{ label: 'Observed/Expected', value: 'oe' },
// 		{ label: 'Log(Observed/Expected)', value: 'log(oe)' }
// 	]
// 	for (const matrixType of matrixTypevalues) {
// 		self.dom.controlsDiv.matrixType.append('option').text(matrixType.label).attr('value', matrixType.value)
// 	}

// 	const viewRow = menuTable.append('tr')
// 	addLabel(viewRow, 'VIEW')
// 	self.dom.controlsDiv.viewBtnDiv = viewRow.append('td')
// 	self.dom.controlsDiv.view = self.dom.controlsDiv.viewBtnDiv
// 		.append('span')
// 		.style('padding-right', '5px')
// 		.style('display', 'block')

// 	self.dom.controlsDiv.genomeViewBtn = self.dom.controlsDiv.viewBtnDiv
// 		.append('button')
// 		.style('display', 'none')
// 		.style('padding', '2px')
// 		.style('margin-top', '4px')
// 		.html('&#8810; Genome')
// 		.on('click', () => {
// 			self.dom.controlsDiv.view.text('Genome')
// 			self.dom.controlsDiv.zoomDiv.style('display', 'none')
// 			self.ingenome = true
// 			self.inchrpair = false
// 			self.indetail = false
// 			self.inhorizontal = false
// 			switchview(hic, self)
// 		})

// 	self.dom.controlsDiv.chrpairViewBtn = self.dom.controlsDiv.viewBtnDiv
// 		.append('button')
// 		.style('display', 'none')
// 		.style('padding', '2px')
// 		.style('margin', '4px 0px')
// 		.on('click', () => {
// 			self.dom.controlsDiv.zoomDiv.style('display', 'none')
// 			self.ingenome = false
// 			self.inchrpair = true
// 			self.indetail = false
// 			self.inhorizontal = false
// 			switchview(hic, self)
// 		})

// 	self.dom.controlsDiv.horizontalViewBtn = self.dom.controlsDiv.viewBtnDiv
// 		.append('button')
// 		.style('display', 'none')
// 		.style('padding', '2px')
// 		.style('margin', '4px 0px')
// 		.html('Horizontal View &#8811;')
// 		.on('click', async () => {
// 			self.ingenome = false
// 			self.inchrpair = false
// 			self.indetail = false
// 			self.inhorizontal = true
// 			switchview(hic, self)
// 		})

// 	self.dom.controlsDiv.detailViewBtn = self.dom.controlsDiv.viewBtnDiv
// 		.append('button')
// 		.style('display', 'none')
// 		.style('padding', '2px')
// 		.style('margin', '4px 0px')
// 		.html('&#8810; Detailed View')
// 		.on('click', () => {
// 			self.ingenome = false
// 			self.inchrpair = false
// 			self.indetail = true
// 			self.inhorizontal = false
// 			switchview(hic, self)
// 		})

// 	self.dom.controlsDiv.zoomDiv = menuTable.append('tr').style('display', 'none')
// 	addLabel(self.dom.controlsDiv.zoomDiv, 'ZOOM')
// 	const zoomDiv = self.dom.controlsDiv.zoomDiv.append('td')
// 	self.dom.controlsDiv.zoomIn = zoomDiv.append('button').style('margin-right', '10px').text('In')
// 	self.dom.controlsDiv.zoomOut = zoomDiv.append('button').style('margin-right', '10px').text('Out')
// }

// /**
//  * Returns appropriately styled label for menu, for consistency and ease of updating
//  * @param tr table row in menu
//  * @param text label text
//  * @returns
//  */
// function addLabel(tr: Elem, text: string) {
// 	return tr
// 		.append('td')
// 		.style('color', '#858585')
// 		.style('font-size', '.8em')
// 		.style('vertical-align', text.toUpperCase() == 'VIEW' ? 'top' : 'middle')
// 		.text(text.toUpperCase())
// }

// /**
//  * Show either NONE if no normalization methods present in the hic file of dropdown of normalization methods
//  * read from the hic file.
//  * @param hic formatted input
//  * @param self App object
//  */
// function makeNormMethDisplay(hic: any, self: any) {
// 	if (!hic.normalization?.length) {
// 		hic.nmethselect = self.dom.controlsDiv.nmeth.text(defaultnmeth)
// 	} else {
// 		hic.nmethselect = self.dom.controlsDiv.nmeth
// 			.style('margin-right', '10px')
// 			.append('select')
// 			.on('change', async () => {
// 				const nmeth = hic.nmethselect.node().value
// 				if (self.ingenome) self.genomeview.nmeth = nmeth
// 				if (self.inchrpair) self.chrpairview.nmeth = nmeth
// 				if (self.indetail) self.detailview.nmeth = nmeth
// 				await getData(hic, self)
// 			})
// 		for (const n of hic.normalization) {
// 			hic.nmethselect.append('option').text(n)
// 		}
// 	}
// }

// /**
//  * Requests data when user changes dropdowns per view specific functions
//  * @param hic file input
//  * @param self app obj
//  * @returns
//  */
// async function getData(hic: any, self: any) {
// 	if (self.ingenome) {
// 		const manychr = hic.atdev ? 3 : hic.chrlst.length
// 		await makeWholeGenomeElements(hic, self, manychr)
// 		if (self.errList.length) self.error(self.errList)
// 		return
// 	}

// 	if (self.inchrpair) {
// 		await getdata_chrpair(hic, self)
// 		return
// 	}

// 	if (self.indetail) {
// 		getdata_detail(hic, self)
// 		return
// 	}
// }

// /**
//  * Setting max value from user input
//  * @param hic formatted input
//  * @param maxv value from UI
//  * @returns view specific cutoff value
//  */
// function setmaxv(self: any, maxv: number) {
// 	if (self.ingenome) {
// 		// viewing whole genome
// 		self.genomeview.bpmaxv = maxv
// 		if (!self.genomeview.lead2follow) return
// 		for (const [lead, a] of self.genomeview.lead2follow) {
// 			for (const [follow, b] of a) {
// 				//Fix for when chr present in the header but no data in the hic file
// 				if (!b.data) continue
// 				for (const [leadpx, followpx, v] of b.data) {
// 					colorizeElement(leadpx, followpx, v, self.genomeview, self, b)
// 				}
// 				b.img.attr('xlink:href', b.canvas.toDataURL())
// 				if (b.canvas2) {
// 					b.img2.attr('xlink:href', b.canvas2.toDataURL())
// 				}
// 			}
// 		}
// 		return
// 	}
// 	if (self.inchrpair) {
// 		// viewing chr pair
// 		self.chrpairview.bpmaxv = maxv
// 		const binpx = self.chrpairview.binpx
// 		for (const [x, y, v] of self.chrpairview.data) {
// 			colorizeElement(x, y, v, self.chrpairview, self, self.chrpairview.ctx)
// 			if (self.chrpairview.isintrachr) {
// 				self.chrpairview.ctx.fillRect(y, x, binpx, binpx)
// 			}
// 		}
// 		return
// 	}
// 	if (self.indetail) {
// 		self.detailview.bpmaxv = maxv
// 		for (const [x, y, w, h, v] of self.detailview.data) {
// 			colorizeElement(x, y, v, self.detailview, self, self.detailview.ctx, w, h)
// 		}
// 	}
// }

// /**
//  * Click buttons in menu to switch between views (whole genome, chr-chr pair, detail, horizontal).
//  * Launches or rerenders previously created views.
//  * @param hic file input
//  * @param self app obj
//  */
// function switchview(hic: any, self: any) {
// 	//Remove all previous elements
// 	self.dom.plotDiv.xAxis.selectAll('*').remove()
// 	self.dom.plotDiv.yAxis.selectAll('*').remove()
// 	self.dom.plotDiv.plot.selectAll('*').remove()

// 	if (self.ingenome) {
// 		nmeth2select(hic, self.genomeview)
// 		matrixType2select(self.genomeview, self)
// 		self.dom.plotDiv.plot.node().appendChild(self.genomeview.svg.node())
// 		self.dom.controlsDiv.inputBpMaxv.property('value', self.genomeview.bpmaxv)
// 		self.dom.infoBarDiv.resolution.text(bplen(self.genomeview.resolution) + ' bp')
// 		self.dom.infoBarDiv.colorScaleLabel.style('display', '')
// 		self.dom.infoBarDiv.colorScaleDiv.style('display', '')
// 	} else if (self.inchrpair) {
// 		self.dom.controlsDiv.view.text(`${self.x.chr}-${self.y.chr} Pair`)
// 		nmeth2select(hic, self.chrpairview)
// 		matrixType2select(self.chrpairview, self)
// 		self.dom.plotDiv.yAxis.node().appendChild(self.chrpairview.axisy.node())
// 		self.dom.plotDiv.xAxis.node().appendChild(self.chrpairview.axisx.node())
// 		self.dom.plotDiv.plot.node().appendChild(self.chrpairview.canvas)
// 		self.dom.controlsDiv.inputBpMaxv.property('value', self.chrpairview.bpmaxv)
// 		self.dom.infoBarDiv.resolution.text(bplen(self.chrpairview.resolution) + ' bp')
// 		self.dom.infoBarDiv.colorScaleLabel.style('display', '')
// 		self.dom.infoBarDiv.colorScaleDiv.style('display', '')
// 	} else if (self.indetail) {
// 		nmeth2select(hic, self.detailview)
// 		matrixType2select(self.detailview, self)
// 		self.dom.infoBarDiv.colorScaleLabel.style('display', '')
// 		self.dom.infoBarDiv.colorScaleDiv.style('display', '')
// 	} else if (self.inhorizontal) {
// 		console.log(330)
// 		self.dom.infoBarDiv.colorScaleLabel.style('display', 'none')
// 		self.dom.infoBarDiv.colorScaleDiv.style('display', 'none')
// 		blocklazyload(self.horizontalview.args)
// 	}

// 	showBtns(self)
// }
