import { getCompInit } from '#rx'
import { Elem, Tr } from '../../../types/d3'
import { NormalizationMethodControl } from './normMeth'
import { CutoffControl } from './cutoff'
import { MatrixTypeControl } from './matrixType'
import { ColorizeElement } from '../dom/colorizeElement'

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
	type: 'controlPanel'
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
	parent: (prop: string, value?: string | number) => any
	colorizeElement: any
	error: any

	state: any
	hasStatePreMain = true

	constructor(opts) {
		this.type = 'controlPanel'
		this.controls = {}
		this.app = opts.app
		this.controlsDiv = opts.controlsDiv
		this.hic = opts.hic
		this.colorizeElement = new ColorizeElement()
		// this.state = opts.state
		this.parent = opts.parent
		this.error = opts.error
	}

	getState(appState) {
		return appState
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
		this.state = this.app.getState()
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
		new NormalizationMethodControl(
			this.controls.nmeth,
			this.hic.normalization,
			this.state.defaultNmeth,
			this.nmethCallback
		).render()

		//***Cutoffs
		//Min CUTOFF
		const minCutoffRow = menuTable.append('tr') as any
		this.addLabel(minCutoffRow, 'Min CUTOFF')
		this.controls.inputBpMinV = new CutoffControl(
			minCutoffRow.append('td'),
			this.parent('min'),
			this.minCallback
		).render()

		//Max CUTOFF
		const maxCutoffRow = menuTable.append('tr') as any
		this.addLabel(maxCutoffRow, 'Max CUTOFF')
		this.controls.inputBpMaxV = new CutoffControl(
			maxCutoffRow.append('td'),
			this.parent('max'),
			this.maxCallback
		).render()

		//Matrix type
		const matrixTypeRow = menuTable.append('tr') as any
		this.addLabel(matrixTypeRow, 'matrix type')
		this.controls.matrixType = new MatrixTypeControl(matrixTypeRow.append('td'), this.matrixTypeCallback).render()

		const viewRow = menuTable.append('tr') as any
		this.addLabel(viewRow, 'VIEW')
		const viewBtnDiv = viewRow.append('td')
		this.controls.view = viewBtnDiv.append('span').style('padding-right', '5px').style('display', 'block')

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
			this.controls.chrpairViewBtn
				.html(`&#8810; Entire ${this.state.x.chr}-${this.state.y.chr}`)
				.style('display', 'block')
			//Only show horizontalViewBtn and zoom buttons in detail view
			this.controls.horizontalViewBtn.style('display', 'block')
			this.controls.zoomDiv.style('display', 'contents')
			//Hide previously shown detail view btn
			this.controls.detailViewBtn.style('display', 'none')
		} else if (this.state.currView === 'horizontal') {
			//Only show chrpairViewBtn if in horizonal or detail view
			//Include chr x and chr y in the button text
			this.controls.chrpairViewBtn
				.html(`&#8810; Entire ${this.state.x.chr}-${this.state.y.chr}`)
				.style('display', 'block')
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

	minCallback = (v: string | number) => {
		this.parent('min', Number(v))
		if (Number(v) > Number(this.parent('max'))) {
			this.error('Min cutoff cannot be greater than max cutoff')
		} else {
			this.reColorHeatmap()
			this.parent('infoBar').update()
		}
	}

	maxCallback = (v: string | number) => {
		this.parent('max', Number(v))
		if (Number(v) < Number(this.parent('min'))) {
			this.error('Max cutoff cannot be less than min cutoff')
		} else {
			this.reColorHeatmap()
			this.parent('infoBar').update()
		}
	}

	reColorHeatmap = () => {
		if (this.parent('activeView') == 'genome') {
			const genomeView = this.parent('genome')
			if (!genomeView.lead2follow) return
			for (const [lead, a] of genomeView.lead2follow) {
				for (const [follow, b] of a) {
					//Fix for when chr present in the header but no data in the hic file
					if (!b.data) continue
					for (const [leadpx, followpx, val] of b.data) {
						//this.colorizeElement(leadpx, followpx, val, b, 1, 1)
						const min = this.parent('min')
						const max = this.parent('max')
						this.colorizeElement.colorizeElement(leadpx, followpx, val, b, 1, 1, min, max, 'genome')
					}
					b.img.attr('xlink:href', b.canvas.toDataURL())
					if (b.canvas2) {
						b.img2.attr('xlink:href', b.canvas2.toDataURL())
					}
				}
			}
		} else {
			console.log('Need to implement recoloring logic for other views')
		}
	}

	nmethCallback = (v: string) => {
		this.app.dispatch({
			type: 'view_update',
			view: this.state.currView,
			config: { nmeth: v }
		})
	}

	matrixTypeCallback = (v: string) => {
		this.app.dispatch({
			type: 'view_update',
			view: this.state.currView,
			config: { matrixType: v }
		})
	}

	main(appState) {
		this.state = this.app.getState(appState)

		this.controls.zoomDiv.style('display', this.state.currView == 'detail' ? 'contents' : 'none')
		if (this.state.currView == 'chrpair') {
			this.controls.view.text(`${this.state.x.chr}-${this.state.y.chr} Pair`)
		} else {
			this.controls.view.text(this.state.currView.charAt(0).toUpperCase() + this.state.currView.slice(1))
		}

		this.controls.inputBpMinV.property('value', this.parent('min'))
		this.controls.inputBpMaxV.property('value', this.parent('max'))

		this.showBtns()
	}
}

export const controlPanelInit = getCompInit(ControlPanel)
