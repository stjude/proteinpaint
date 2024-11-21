import { getCompInit, copyMerge, deepEqual } from '#rx'
import { setMatrixDom } from './matrix.dom'
import { setInteractivity } from './matrix.interactivity'
import { setRenderers } from './matrix.renderers'
import { MatrixCluster } from './matrix.cluster'
import { MatrixControls } from './matrix.controls'
import * as matrixData from './matrix.data'
import * as matrixLayout from './matrix.layout'
import * as matrixSerieses from './matrix.serieses'
import * as matrixLegend from './matrix.legend'
import * as matrixGroups from './matrix.groups'
import { setComputedConfig } from './matrix.config'
import { getTermGroups } from './matrix.xtw'
import svgLegend from '#dom/svg.legend'
import { mclass, dt2label, morigin, dtsnvindel, dtcnv } from '#shared/common.js'
import { select } from 'd3-selection'

export class Matrix {
	constructor(opts) {
		this.type = 'matrix'
		this.holderTitle = 'Sample Matrix'
		this.optionalFeatures = JSON.parse(sessionStorage.getItem('optionalFeatures') || `{}`)?.matrix || []
		setInteractivity(this)
		setRenderers(this)
	}

	async init(appState) {
		const opts = this.opts
		if (opts.reactsTo) this.reactsTo = opts.reactsTo
		this.setDom = setMatrixDom
		this.setDom(opts)

		this.config = appState.plots.find(p => p.id === this.id)
		this.settings = Object.assign({}, this.config.settings.matrix)
		this.computed = {} // will hold settings/configuration/data that are computed or derived from other data
		if (this.dom.header) this.dom.header.html(this.holderTitle)

		this.setControls(appState)
		this.clusterRenderer = new MatrixCluster({ holder: this.dom.cluster, app: this.app, parent: this })
		this.legendRenderer = svgLegend({
			holder: this.dom.legendG,
			rectFillFxn: d => d.color,
			iconStroke: '#aaa',
			handlers: {
				legend: {
					click: this.legendClick
				}
			},
			settings: {
				isExcludedAttr: 'isExcluded'
			},
			note: 'CLICK A ROW LABEL OR ITEM TO APPLY FILTERING'
		})

		// enable embedding of termsetting and tree menu inside self.dom.menu
		this.customTipApi = this.dom.tip.getCustomApi({
			d: this.dom.menubody,
			clear: event => {
				if (event?.target) this.dom.menutop.style('display', 'none')
				this.dom.menubody.selectAll('*').remove()
				return this.customTipApi
			},
			show: () => {
				this.dom.menubody.style('display', 'block')
			},
			hide: () => {
				//this.dom.menubody.style('display', 'none')
			}
		})

		this.setPill(appState)

		/*
		Levels of mclass overrides, from more general to more specific. Same logic for dt2label

		1. server-level:
		  - specified as serverconfig.commonOverrides
		  - applied to the mclass from #shared/common on server startup
		  - applies to all datasets and charts
		  - overrides are applied to the static common.mclass object
		
		2. dataset-level: 
		  - specified as termdb.mclass in the dataset's js file
		  - applied to the termdbConfig.mclass payload as returned from the /termdb?getTermdbConfig=1 route
		  - applies to all charts rendered for only the dataset/dslabel
		  - overrides are applied to a copy of common.mclass, not the original "static" object

		3. chart-level: 
		  - specified as termdb[chartType].mclass in the dataset's js file
		  - applied to the termdbConfig[chartType].mclass payload as returned from the /termdb?getTermdbConfig=1 route
		  - applies to only the specific chart type as rendered for the dataset/dslabel
		  - overrides are applied to a copy of common.mclass + termdb.mclass

		!!! NOTE: 
			Boolean configuration flags for mutually exclusive values may cause conflicting configurations
			in the resulting merged overrides, as outputted by rx.copyMerge()
		!!!
		*/
		const commonKeys = { mclass, dt2label, morigin }
		for (const k in commonKeys) {
			const v = commonKeys[k]
			this[k] = copyMerge({}, v, appState.termdbConfig[k] || {}, appState.termdbConfig.matrix?.[k] || {})
		}
	}

	setControls(appState) {
		//if (this.opts.controls) return
		this.controlsRenderer = new MatrixControls(
			{
				app: this.app,
				id: this.id,
				parent: this,
				holder: this.dom.controls,
				getSvg: () => this.dom.svg.node()
			},
			appState
		)
	}

	// reactsTo(action) {
	// 	// note: a parent app or 'plot' component is expected to already have
	// 	// a comprehensive reactsTo() call to filter the actions for this component,
	// 	// so only farther selective action filters should be applied here as needed
	// 	return true
	// }

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const filter0 = appState.termfilter.filter0
		this.prevFilter0 = this.state?.filter0 // will be used to detect cohort change
		return {
			isVisible: true,
			config,
			filter: appState.termfilter.filter,
			filter0, // read-only, invisible filter currently only used for gdc dataset
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationMessage: this.app.vocabApi.tokenVerificationMessage,
			vocab: appState.vocab,
			termdbConfig: appState.termdbConfig,
			clusterMethod: config.settings.hierCluster?.clusterMethod,
			distanceMethod: config.settings.hierCluster?.distanceMethod,
			clusterSamples: config.settings.hierCluster?.clusterSamples,
			zScoreTransformation: config.settings.hierCluster?.zScoreTransformation,
			nav: appState.nav
		}
	}

	async main() {
		try {
			this.config = structuredClone(this.state.config)
			if (this.mayRequireToken()) return
			this.termGroups = getTermGroups(this.config.termgroups, this.app)

			const prevTranspose = this.settings.transpose
			// controlsRenderer.getSettings() supplies settings that are not tracked in the global app and plot state
			// use structuredClone to avoid overwriting of original settings.matrix
			Object.assign(this.settings, structuredClone(this.config.settings), this.controlsRenderer.getSettings())

			this.dom.loadingDiv.selectAll('*').remove()
			this.dom.loadingDiv.html('').style('display', '').style('position', 'relative').style('left', '45%')
			this.dom.svg.style('opacity', 0.1).style('pointer-events', 'none')

			// reset highlighted top/left dendrogram children to black when data request is triggered
			delete this.clickedClusterIds
			delete this.clickedLeftClusterIds

			try {
				setComputedConfig(this.config)
				const promises = []
				// get the data
				if (this.setHierClusterData) promises.push(this.setHierClusterData())
				promises.push(this.setData())
				this.dom.loadingDiv.html('Processing data ...')
				await Promise.all(promises)
				this.applyLegendValueFilter() // need to applyLegendValueFiter before combineData to avoid error for hierCluster
				if (this.combineData) this.combineData()
				// tws in the config may be filled-in based on applicable server response data;
				// these filled-in config, such as tw.term.values|category2samplecount, will need to replace
				// the corresponding tracked state values in the app store, without causing unnecessary
				// dispatch notifications, so use app.save()
				this.app.save({ type: 'plot_edit', id: this.id, config: this.config })
			} catch (e) {
				if (e == 'no data') {
					this.showNoMatchingDataMessage()
					return
				} else if (e == 'stale sequenceId' || e.name == 'AbortError') {
					// ignore this error, but skip this update since a subsequent action is being processed
					return
				} else {
					this.dom.svg.style('display', 'none')
					throw e
				}
			}

			this.dom.loadingDiv.html('Updating ...').style('display', '')
			this.termOrder = this.getTermOrder(this.data)
			this.sampleGroups = this.getSampleGroups(this.hierClusterSamples || this.data)
			this.sampleOrder = this.getSampleOrder(this.data)

			if (
				!this.sampleOrder?.length &&
				// TODO: should show empty data message when there is nothing to render
				//       because of cohort, legend filter, and/or geneset
				// this.config.settings.matrix.addMutationCNVButtons ||
				!this.config.legendGrpFilter?.lst.length &&
				!this.config.legendValueFilter?.lst.length
			) {
				this.showNoMatchingDataMessage()
				this.controlsRenderer.main() // to update button count or cross out button labels
				return
			}
			this.setLayout()
			if (this.setHierColorScale) this.setHierColorScale(this.hierClusterData.clustering)
			this.serieses = this.getSerieses(this.data)

			// render the data
			this.dom.loadingDiv.html('Rendering ...')
			if (this.plotDendrogramHclust) this.plotDendrogramHclust()
			this.render()
			this.mayDisplayCohortMessage()
			this.dom.svg.style('display', '').style('opacity', 1).style('pointer-events', '')

			const [xGrps, yGrps] = !this.settings.matrix.transpose ? ['sampleGrps', 'termGrps'] : ['termGrps', 'sampleGrps']
			const d = this.dimensions
			this.clusterRenderer.main({
				settings: this.settings.matrix,
				xGrps: this[xGrps],
				yGrps: this[yGrps],
				dimensions: d
			})

			this.legendRenderer(this.legendData, {
				settings: Object.assign({}, this.settings.legend, {
					svgw: Math.max(400, d.mainw + d.xOffset - this.settings.matrix.margin.right),
					svgh: d.mainh + d.yOffset,
					dimensions: d,
					padleft: this.settings.legend.padleft //+ d.xOffset
				})
			})
			await this.adjustSvgDimensions(prevTranspose)
			this.controlsRenderer.main()
		} catch (e) {
			// a new token message error may have been triggered by the data request here,
			// even if the initial state did not have a token message at the start of a dispatch
			const message = this.app.vocabApi.tokenVerificationMessage
			this.mayRequireToken(message)
			if (!message) {
				this.app.tip.hide()
				this.dom.loadingDiv.style('display', 'none')
				throw e
			}
		}

		this.resetInteractions()
	}

	showNoMatchingDataMessage() {
		this.forcedSampleCount = 0
		this.dom.svg.style('opacity', 0.001).style('display', 'none')
		// an error on initial load/data request will cause computed data/settings to be empty,
		// which would cause input values to be empty for controls and likely thrown errors
		if (this.termOrder && this.dimensions) this.controlsRenderer.main({ sampleCount: 0 })
		this.dom.loadingDiv.html('')
		const div = this.dom.loadingDiv
			.append('div')
			.style('display', 'inline-block')
			.style('text-align', 'center')
			.style('position', 'relative')
			.style('left', '-150px')
		div.append('div').style('margin', '5px 10px').html('No matching cohort sample data for the current gene list.')

		if (this.settings.matrix.showHints?.includes('genesetEdit')) {
			const div1 = div.append('div').style('margin', '5px 10px')
			div1.append('span').html('You may change the selected cohort,')

			if (this.config.legendGrpFilter?.lst.length || this.config.legendValueFilter?.lst.length) {
				div1.append('br')
				div1.append('span').html('show hidden ')
				div1
					.append('span')
					.html('CNV')
					.style('cursor', 'pointer')
					.style('text-decoration', 'underline')
					.on('click', () => {
						this.controlsRenderer.btns
							.filter(d => d.label == 'CNV')
							?.node()
							.click()
					})
				div1.append('span').html(' or ')
				div1
					.append('span')
					.style('cursor', 'pointer')
					.style('text-decoration', 'underline')
					.html('Mutation')
					.on('click', () => {
						this.controlsRenderer.btns
							.filter(d => d.label == 'Mutation')
							?.node()
							.click()
					})
				div1.append('span').html(' data,')
			}

			div1.append('br')
			div1.append('span').html('or edit the gene list from the ')
			div1
				.append('span')
				.style('cursor', 'pointer')
				.style('text-decoration', 'underline')
				.html('Gene Set Edit Group menu.')
				.on('click', () => {
					const GenesBtn = this.controlsRenderer.btns
						.filter(d => d.label == 'Genes')
						?.node()
						.click()
					const i = setInterval(() => {
						const editBtn = this.app.tip.d
							.selectAll('button')
							.filter(function () {
								return this.innerHTML == 'Edit Group'
							})
							.node()
						if (editBtn) {
							editBtn.click()
							clearInterval(i)
						}
					}, 100)
				})
		}
		this.dom.svg.style('display', 'none')
	}

	mayDisplayCohortMessage() {
		const msg =
			!this.prevFilter0 || deepEqual(this.state.filter0, this.prevFilter0)
				? ''
				: 'The gene list is persisted across cohorts.'
		if (msg) {
			this.dom.loadingDiv.html('')
			const div = this.dom.loadingDiv
				.append('div')
				.style('display', 'inline-block')
				.style('text-align', 'center')
				.style('position', 'relative')
				.style('left', '-150px')
			div.append('div').html(msg)

			if (this.settings.matrix.showHints?.includes('genesetEdit')) {
				const div1 = div.append('div')
				div1.append('span').html(' You may edit the gene list from the ')
				div1
					.append('span')
					.style('cursor', 'pointer')
					.style('text-decoration', 'underline')
					.html('Gene Set Edit Group menu.')
					.on('click', () => {
						const GenesBtn = this.controlsRenderer.btns
							.filter(d => d.label == 'Genes')
							?.node()
							.click()
						const i = setInterval(() => {
							const editBtn = this.app.tip.d
								.selectAll('button')
								.filter(function () {
									return this.innerHTML == 'Edit Group'
								})
								.node()
							if (editBtn) {
								editBtn.click()
								clearInterval(i)
							}
						}, 100)
					})
			}
		}
		this.dom.loadingDiv.style('display', msg ? '' : 'none')
	}

	sampleKey(s) {
		return s.row.sample
	}

	sampleLabel(s) {
		return s.label || s.row._ref_.label || ''
	}

	sampleGrpKey(s) {
		return s.grp.name
	}

	sampleGrpLabel(s) {
		return s.grp.label || s.grp.name || ''
	}

	termKey(t) {
		return t.tw.$id
	}

	termLabel(t) {
		return t.label
	}

	termGrpKey(t) {
		return t.grp.name
	}

	termGrpLabel(t) {
		return t.grp.label || t.grp.name || [{ text: '⋮', dx: 3, cls: 'sjpp-exclude-svg-download' }]
	}
	destroy() {
		select(window).on(`resize.sjpp-${self.id}`, null)
	}
}

// assign class prototype methods and props that are exported from other matrix.* code files
for (const m of [matrixData, matrixGroups, matrixLayout, matrixSerieses, matrixLegend]) {
	for (const methodName in m) {
		Matrix.prototype[methodName] = m[methodName]
	}
}

export const matrixInit = getCompInit(Matrix)
// this alias will allow abstracted dynamic imports
export const componentInit = matrixInit

export function makeChartBtnMenu(holder, chartsInstance) {
	/*
	holder: the holder in the tooltip
	chartsInstance: MassCharts instance
		termdbConfig is accessible at chartsInstance.state.termdbConfig{}
		mass option is accessible at chartsInstance.app.opts{}
	*/
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.matrixplots) {
		for (const plot of chartsInstance.state.termdbConfig.matrixplots) {
			/* plot: 
			{
				name=str
			}
			*/
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(plot.name)
				.on('click', async () => {
					chartsInstance.dom.tip.hide()
					const config = await chartsInstance.app.vocabApi.getMatrixByName(plot.name)
					chartsInstance.app.dispatch({
						type: 'plot_create',
						config
					})
				})
		}
	}
	menuDiv
		.append('div')
		.datum({
			label: 'Term tree & search',
			clickTo: chartsInstance.showTree_selectlst,
			chartType: 'matrix',
			usecase: { target: 'matrix', detail: 'termgroups' },
			processSelection: lst => {
				return [
					{
						name: '',
						lst: lst.map(term => {
							return { term }
						})
					}
				]
			}
		})
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(d => d.label)
		.on('click', (event, chart) => chartsInstance.showTree_selectlst(chart))

	menuDiv
		.append('div')
		.datum({
			label: 'Text input',
			chartType: 'matrix',
			clickTo: showTextAreaInput,
			usecase: { target: 'matrix', detail: 'termgroups' },
			placeholder: 'term\tgroup',
			processInput: async text => {
				const lines = text.split('\n').map(line => line.split('\t'))
				const ids = lines.map(cols => cols[0]).filter(t => !!t)
				const terms = await chartsInstance.app.vocabApi.getTermTypes(ids)
				const groups = {}
				for (const [id, name] of lines) {
					if (!(id in terms)) continue
					if (!(name in groups)) groups[name] = { name, lst: [] }
					groups[name].lst.push({ term: terms[id] })
				}
				return Object.values(groups)
			}
		})
		.attr('class', 'sja_menuoption sja_sharp_border')
		.text(d => d.label)
		.on('click', (event, chart) => showTextAreaInput(chart, chartsInstance))
}

function showTextAreaInput(opt, self) {
	self.dom.tip.clear()
	self.dom.submenu = self.dom.tip.d.append('div').style('text-align', 'center')

	self.dom.submenu.append('span').html(opt.label)

	self.dom.submenu
		.append('button')
		.style('margin', '0 5px')
		.html('Submit')
		.on('click', async () => {
			const data = await opt.processInput(ta.property('value'))
			self.dom.tip.hide()
			const action = {
				type: 'plot_create',
				id: getId(),
				config: {
					chartType: opt.usecase.target,
					[opt.usecase.detail]: data
				}
			}
			self.app.dispatch(action)
		})

	const ta = self.dom.submenu
		.append('div')
		.style('text-align', 'left')
		.append('textarea')
		.attr('placeholder', opt.placeholder)
		.style('width', '300px')
		.style('height', '300px')
		.style('margin', '5px')
		.style('padding', '5px')
		.on('keydown', event => {
			const keyCode = event.keyCode || event.which
			// handle tab key press, otherwise it will cause the focus to move to another input
			if (keyCode == 9) {
				event.preventDefault()
				const t = event.target
				const s = t.selectionStart
				t.value = t.value.substring(0, t.selectionStart) + '\t' + t.value.substring(t.selectionEnd)
				t.selectionEnd = s + 1
			}
		})
}

// to assign chart ID to distinguish between chart instances
const idPrefix = '_CHART_AUTOID_' // to distinguish from user-assigned chart IDs
let id = Date.now()

function getId() {
	return idPrefix + id++
}
