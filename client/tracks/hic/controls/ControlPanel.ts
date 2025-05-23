import { getCompInit } from '#rx'
import type { Elem, Tr } from '../../../types/d3'
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
		minCutoffLabel?: any
		inputBpMinV?: any
		maxCutoffRow?: any
		maxCutoffLabel?: any
		inputBpMaxV?: any
		matrixTypeRow?: any
		matrixType?: any
		widthRow?: any
		width?: any
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
			this.dropdownCallback
		)
		this.controls.nmeth.render()

		//***Cutoffs
		//Min CUTOFF
		this.controls.minCutoffRow = menuTable.append('tr') as any
		//Text updates dynamically from hic component in main()
		this.controls.minCutoffLabel = this.addLabel(this.controls.minCutoffRow, '')
		this.controls.inputBpMinV = new CutoffControl(
			this.controls.minCutoffRow.append('td'),
			this.parent('min'),
			this.minCallback
		).render({ width: '120px' })

		//Max CUTOFF
		this.controls.maxCutoffRow = menuTable.append('tr') as any
		//Text updates dynamically from hic component in main()
		this.controls.maxCutoffLabel = this.addLabel(this.controls.maxCutoffRow, '')
		this.controls.inputBpMaxV = new CutoffControl(
			this.controls.maxCutoffRow.append('td'),
			this.parent('max'),
			this.maxCallback
		).render({ width: '120px' })

		//Matrix type
		this.controls.matrixTypeRow = menuTable.append('tr') as any
		this.addLabel(this.controls.matrixTypeRow, 'matrix type')
		this.controls.matrixType = new MatrixTypeControl(this.controls.matrixTypeRow.append('td'), this.dropdownCallback)
		this.controls.matrixType.render()

		this.controls.widthRow = menuTable.append('tr') as any
		//Leave the spaces in the label so it appears nicely in the menu
		this.addLabel(this.controls.widthRow, 'WIDTH / height')
		this.controls.width = this.controls.widthRow.append('td')

		this.controls.width
			.style('margin-right', '10px')
			.append('input')
			.attr('type', 'number')
			.style('width', '80px')
			.style('margin-left', '0px')
			.attr('type', 'number')
			.property('value', state.width)
			.on('keyup', async (event: KeyboardEvent) => {
				if (event.code != 'Enter') return
				const v: any = (event.target as HTMLInputElement).value
				this.app.dispatch({
					type: 'view_update',
					config: {
						settings: { widthHeightPx: Number.parseInt(v) }
					}
				})
			})

		//View with description, buttons, and zoom when appropriate
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
				this.zoomBlockCallback(false)
			})
		this.controls.zoomOut = zoomDiv
			.append('button')
			.style('margin-right', '10px')
			.text('Out')
			.on('click', () => {
				this.zoomBlockCallback(true)
			})
	}

	zoomBlockCallback = (bool: boolean) => {
		const detailView = this.parent('detail')
		detailView.xBlock.block.zoomblock(2, bool)
		detailView.yBlock.block.zoomblock(2, bool)
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
			this.controls.widthRow.style('display', 'none')
		}
	}

	minCallback = (v: string | number) => {
		if (Number(v) > Number(this.parent('max'))) {
			this.error('Min cutoff cannot be greater than max cutoff')
		} else {
			this.parent('min', Number(v))
			this.reColorHeatmap()
			this.parent('infoBar').update()
		}
	}

	maxCallback = (v: string | number) => {
		if (Number(v) < Number(this.parent('min'))) {
			this.error(`Max cutoff cannot be less than min cutoff`)
		} else if (Number(v) < 0) {
			this.error(`Max cutoff cannot be less than 0`)
		} else {
			this.parent('max', Number(v))
			this.reColorHeatmap()
			this.parent('infoBar').update()
		}
	}

	reColorHeatmap = () => {
		if (this.parent('activeView') == 'genome') {
			const genomeView = this.parent('genome')
			const chrMatrix = genomeView.viewRender.grid.chromosomeMatrix
			if (!chrMatrix) return
			for (const map of chrMatrix) {
				const yMap = map[1]
				for (const obj of yMap) {
					const canvasObj = obj[1]
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

	dropdownCallback = (v: string, prop: string) => {
		const state = this.app.getState()
		this.app.dispatch({
			type: 'view_update',
			view: state.currView,
			config: { [prop]: v }
		})
	}

	showHideControls() {
		const state = this.app.getState()
		this.controls.normalizationRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.minCutoffRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.maxCutoffRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.matrixTypeRow.style('display', state.currView == 'horizontal' ? 'none' : '')
		this.controls.widthRow.style('display', state.currView == 'detail' ? 'contents' : 'none')
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

		const formatAbsMin =
			this.parent('absMin') < 0.00001
				? Number(this.parent('absMin')).toExponential(1)
				: Number(this.parent('absMin').toFixed(6))
		const formatAbsMax =
			this.parent('absMax') < 0.00001
				? Number(this.parent('absMax')).toExponential(1)
				: Number(this.parent('absMax').toFixed(6))

		this.controls.width.select('input').property('value', state.settings.widthHeightPx)
		this.controls.inputBpMinV.property('value', this.parent('min'))
		this.controls.inputBpMaxV.property('value', this.parent('max'))
		this.controls.minCutoffLabel.html(`MIN CUTOFF <br>(>= ${formatAbsMin})`)
		this.controls.maxCutoffLabel.html(`MAX CUTOFF <br>(<= ${formatAbsMax})`)

		this.showBtns()
		this.showHideControls()
	}
}

export const controlPanelInit = getCompInit(ControlPanel)
