import { getCompInit } from '#rx'
import { Elem, Tr } from '../../../types/d3'
import { NormalizationMethodControl } from './NormalizationMethodControl'
import { CutoffControl } from './CutoffControl'
import { MatrixTypeControl } from './MatrixTypeControl'
import { ColorizeElement } from '../dom/ColorizeElement'

class ControlPanel {
	type: 'controlPanel'
	app: any
	controls: {
		normalizationRow?: any
		nmeth?: any
		minCutoffRow?: any
		inputBpMinV?: any
		maxCutoffRow?: any
		inputBpMaxV?: any
		matrixTypeRow?: any
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
	colorizeElement: ColorizeElement
	error: any

	constructor(opts) {
		this.type = 'controlPanel'
		this.controls = {}
		this.app = opts.app
		this.controlsDiv = opts.controlsDiv
		this.hic = opts.hic
		this.colorizeElement = new ColorizeElement()
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
		const state = this.app.getState()
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
		this.controls.normalizationRow = menuTable.append('tr') as any
		this.addLabel(this.controls.normalizationRow, 'NORMALIZATION')
		this.controls.nmeth = new NormalizationMethodControl(
			this.controls.normalizationRow.append('td').attr('class', 'sjpp-nmeth-select'),
			this.hic.normalization,
			state.defaultNmeth,
			this.nmethCallback
		)
		this.controls.nmeth.render()

		//***Cutoffs
		//Min CUTOFF
		this.controls.minCutoffRow = menuTable.append('tr') as any
		this.addLabel(this.controls.minCutoffRow, 'Min CUTOFF')
		this.controls.inputBpMinV = new CutoffControl(
			this.controls.minCutoffRow.append('td'),
			this.parent('min'),
			this.minCallback
		).render()

		//Max CUTOFF
		this.controls.maxCutoffRow = menuTable.append('tr') as any
		this.addLabel(this.controls.maxCutoffRow, 'Max CUTOFF')
		this.controls.inputBpMaxV = new CutoffControl(
			this.controls.maxCutoffRow.append('td'),
			this.parent('max'),
			this.maxCallback
		).render()

		//Matrix type
		this.controls.matrixTypeRow = menuTable.append('tr') as any
		this.addLabel(this.controls.matrixTypeRow, 'matrix type')
		this.controls.matrixType = new MatrixTypeControl(this.controls.matrixTypeRow.append('td'), this.matrixTypeCallback)
		this.controls.matrixType.render()

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
					type: 'view_create',
					view: 'genome',
					config: {
						x: {},
						y: {}
					}
				})
			})

		this.controls.chrpairViewBtn = viewBtnDiv
			.append('button')
			.style('display', 'none')
			.style('padding', '2px')
			.style('margin', '4px 0px')
			.on('click', async () => {
				const currState = this.app.getState()
				await this.app.dispatch({
					type: 'view_create',
					view: 'chrpair',
					config: {
						x: {
							chr: currState.x.chr
						},
						y: {
							chr: currState.y.chr
						}
					}
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
					type: 'view_create',
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
					type: 'view_create',
					view: 'detail'
				})
			})

		this.controls.zoomDiv = menuTable
			.append('tr')
			.style('display', state.currView == 'detail' ? 'contents' : 'none') as any
		this.addLabel(this.controls.zoomDiv, 'ZOOM')
		const zoomDiv = this.controls.zoomDiv.append('td')

		this.controls.zoomIn = zoomDiv
			.append('button')
			.style('margin-right', '10px')
			.text('In')
			.on('click', () => {
				const detailView = this.parent('detail')
				const xBlock = detailView.xBlock.block
				const yBlock = detailView.yBlock.block
				xBlock.zoomblock(2, false)
				yBlock.zoomblock(2, false)
			})
		this.controls.zoomOut = zoomDiv
			.append('button')
			.style('margin-right', '10px')
			.text('Out')
			.on('click', () => {
				const detailView = this.parent('detail')
				const xBlock = detailView.xBlock.block
				const yBlock = detailView.yBlock.block
				xBlock.zoomblock(2, true)
				yBlock.zoomblock(2, true)
			})
	}

	showBtns() {
		const state = this.app.getState()
		this.controls.genomeViewBtn.style('display', state.currView === 'genome' ? 'none' : 'inline-block')
		if (state.currView === 'detail') {
			this.controls.chrpairViewBtn.html(`&#8810; Entire ${state.x.chr}-${state.y.chr}`).style('display', 'block')
			//Only show horizontalViewBtn and zoom buttons in detail view
			this.controls.horizontalViewBtn.style('display', 'block')
			this.controls.zoomDiv.style('display', 'contents')
			//Hide previously shown detail view btn
			this.controls.detailViewBtn.style('display', 'none')
		} else if (state.currView === 'horizontal') {
			//Only show chrpairViewBtn if in horizonal or detail view
			//Include chr x and chr y in the button text
			this.controls.chrpairViewBtn.html(`&#8810; Entire ${state.x.chr}-${state.y.chr}`).style('display', 'block')
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
			const chrMatrix = genomeView.viewRender.grid.chromosomeMatrix
			if (!chrMatrix) return
			for (const [chrx, yMap] of chrMatrix) {
				for (const [chry, canvasObj] of yMap) {
					if (!canvasObj) continue
					for (const [leadpx, followpx, val] of canvasObj.data) {
						this.colorizeElement.colorizeElement(
							leadpx,
							followpx,
							val,
							canvasObj,
							1,
							1,
							this.parent('min'),
							this.parent('max'),
							'genome'
						)
					}
					canvasObj.img.attr('xlink:href', canvasObj.canvas.toDataURL())
					if (canvasObj.canvas2) {
						canvasObj.img2.attr('xlink:href', canvasObj.canvas2.toDataURL())
					}
				}
			}
		} else if (this.parent('activeView') == 'chrpair') {
			const view = this.parent('chrpair')
			for (const [xCoord, yCoord, val] of view.data) {
				this.colorizeElement.colorizeElement(
					xCoord,
					yCoord,
					val,
					view.ctx,
					view.binpx,
					view.binpx,
					this.parent('min'),
					this.parent('max'),
					'chrpair'
				)
			}
		} else if (this.parent('activeView') == 'detail') {
			const view = this.parent('detail')
			for (const [xCoord, yCoord, width, height, value] of view.coords as any) {
				this.colorizeElement.colorizeElement(
					xCoord,
					yCoord,
					value,
					view.ctx,
					width,
					height,
					this.parent('min') as number,
					this.parent('max') as number,
					'detail'
				)
			}
		}
	}

	nmethCallback = (v: string) => {
		const state = this.app.getState()
		this.app.dispatch({
			type: 'view_update',
			view: state.currView,
			config: { nmeth: v }
		})
	}

	matrixTypeCallback = (v: string) => {
		const state = this.app.getState()
		this.app.dispatch({
			type: 'view_update',
			view: state.currView,
			config: { matrixType: v }
		})
	}

	showHideControls() {
		const state = this.app.getState()
		this.controls.normalizationRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.minCutoffRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.maxCutoffRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.matrixTypeRow.style('display', state.currView == 'horizontal' ? 'none' : '')
	}

	main(appState) {
		const state = this.app.getState(appState)

		this.controls.nmeth.update(state[state.currView].nmeth)
		this.controls.matrixType.update(state[state.currView].matrixType)

		this.controls.zoomDiv.style('display', state.currView == 'detail' ? 'contents' : 'none')
		if (state.currView == 'chrpair') {
			this.controls.view.text(`${state.x.chr}-${state.y.chr} Pair`)
		} else {
			this.controls.view.text(state.currView.charAt(0).toUpperCase() + state.currView.slice(1))
		}

		this.controls.inputBpMinV.property('value', this.parent('min'))
		this.controls.inputBpMaxV.property('value', this.parent('max'))

		this.showBtns()
		this.showHideControls()
	}
}

export const controlPanelInit = getCompInit(ControlPanel)
