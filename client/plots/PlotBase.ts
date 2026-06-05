import type { AppApi, ComponentApi } from '#rx'
import type { TermdbVocab } from '../termdb/TermdbVocab.js'
import { TwRouter, routedTermTypes } from '#tw'

export class PlotBase {
	type!: string // assigned by child class
	//id: string
	api?: ComponentApi
	opts: any
	app: AppApi
	id: string
	state: any
	parentId?: string

	dom: {
		[name: string]: any
	} = {}

	components: {
		[name: string]: ComponentApi | { [name: string]: ComponentApi }
	} = {}

	// dom: any
	// config: any
	configTermKeys?: string[]
	vocabApi?: TermdbVocab

	/** wait time to show loading div to avoid rapid flicker */
	loadingWait = 1000
	/** update cycle counter to help simulate error display */
	testUpdateNum = 0

	constructor(opts, plotApi?: ComponentApi) {
		if (plotApi) this.api = plotApi
		this.opts = opts
		this.id = opts?.id
		this.app = opts?.app
		this.parentId = opts?.parentId
		// Below creates a vocabApi instance that is unique to the plot instance,
		// so that there'd be a plot-level request cancellation using plotApi.getAbortSignal()
		if (this.app?.vocabApi) this.vocabApi = this.app.vocabApi.create(() => this.api?.getAbortSignal())
	}

	async getMutableConfig() {
		// TODO: may improve to not require a full copy??
		const config = structuredClone(this.state.config)
		if (!config || !this.configTermKeys?.length) return structuredClone(config)

		const opts = {
			vocabApi: this.vocabApi
		}

		for (const key of this.configTermKeys) {
			const value = config[key.split('.')[0]]
			// const orig = this.state.config[key] // TODO: may reuse the original copy if there's a better way to mutate
			if (!value) continue
			if (Array.isArray(value)) {
				for (const [i, v] of value.entries()) {
					if (key.includes('.')) {
						const k = key.split('.')[1]
						const _v = v[k]
						if (Array.isArray(_v)) {
							for (const [j, tw] of (_v as any[]).entries()) {
								if (tw.type && routedTermTypes.has(tw.term?.type)) {
									_v[j] = await TwRouter.init(tw, opts)
								}
							}
						} else {
							if (_v.type && routedTermTypes.has(_v.term?.type)) v[k] = await TwRouter.init(_v, opts)
						}
					} else {
						if (v.type && routedTermTypes.has(v.term?.type)) config[key][i] = await TwRouter.init(v, opts)
					}
				}
			} /*else if (typeof orig == 'object' && orig.contructor?.name != 'Object') {
				config[key] = orig
			}*/ else if (value.type && routedTermTypes.has(value.term?.type)) {
				config[key] = await TwRouter.initRaw(value, opts)
			}
		}

		return config
	}

	getStandardDomLayout(holder, opts: any = {}) {
		const optsControlsHolderIsSelection =
			opts.controls && typeof opts.controls.append == 'function' && typeof opts.controls.selectAll == 'function'
		const controls =
			opts.controls && !optsControlsHolderIsSelection
				? null
				: opts.controls && optsControlsHolderIsSelection
				? opts.controls
				: holder.append('div').style('display', 'inline-block')

		const mainWrapper = opts.mainWrapper || holder.append('div').style('display', 'inline-block')
		//const holder = opts.controls ? opts.holder : opts.holder.append('div')
		const errdiv = mainWrapper.append('div').attr('class', 'sja_errorbar').style('display', 'none')
		const loadingDiv = mainWrapper.append('div').style('display', 'none').style('padding', '24px').html('Loading ...')
		const banner = mainWrapper
			.append('div')
			.style('display', 'none')
			.style('text-align', 'center')
			.style('padding', '24px')
			.style('font-size', '16px')

		const mainDiv = mainWrapper.append('div').style('position', 'relative')

		const renderedData = mainDiv.append('div')
		const charts = renderedData.append('div')
		const legendDiv = renderedData.append('div')

		// TODO: activate and test the loading overlay with a spinner below
		// const overlay = mainDiv.append('div').style('height', '100%').style('width', '100%')
		// 	.style('position', 'absolute')
		// 	.style('top', '0')
		// 	.style('right', '0')
		// 	.style('bottom', '0')
		// 	.style('left', '0')
		// 	.style('pointer-events', 'none')
		// overlay
		// 	.append('div')
		// 	.attr('class', 'sjpp-spinner')
		// 	.style('display', 'none')
		// 	.style('position', 'absolute')
		// 	.style('top', '50%')
		// 	.style('left', '50%')
		// 	.style('transform', 'translate(-50%, -50%)')

		return { controls, errdiv, loadingDiv, banner, mainDiv, renderedData, charts, legendDiv }
	}

	// helper so that 'Loading...' does not flash when not needed
	toggleLoadingDiv(display = '', dataDisplay = '') {
		const loadingDiv = this.dom.loadingDiv || this.dom.loading
		if (!loadingDiv) return
		if (display == 'none') {
			loadingDiv.style('display', display)
			if (this.dom.renderedData) this.dom.renderedData.style('display', dataDisplay || '')
		} else {
			loadingDiv
				.style('opacity', 0)
				.style('display', display)
				.transition()
				.duration('loadingWait' in this ? this.loadingWait : 0)
				.style('opacity', 1)
			// When the loadingDiv is visible, the renderedData should not be displayed unless
			// vall its child elements have been removed. This may be the case if temporary elements
			// like svg text labels are measured to compute the target svg width.
			if (this.dom.renderedData) this.dom.renderedData.style('display', dataDisplay || 'none')
		}

		// uncomment below to manually test error and chart visibility
		// if (display !== 'none') {
		// 	this.testUpdateNum++
		// 	// simulate an error on every 3rd call to show the overlay
		// 	if (this.testUpdateNum % 3 === 0) throw '~~~ test update error, should hide charts + legend ~~~'
		// }
	}

	printError(err) {
		console.debug(err)
		// should not show any rendered data when there is an error,
		// to avoid potential inconsistency between configured settings (like bins, medians)
		// and rendered charts
		if (this.dom.renderedData) this.dom.renderedData.style('display', 'none')
		let errdiv = this.dom?.errdiv || this.dom?.error || this.dom?.holder?.select('.sja_errorbar')
		if (!errdiv?.node()) {
			if (!this.dom?.holder) {
				this.app.printError(err + ` (also missing ${this.type}.dom.holder)`)
				return
			} else {
				this.dom.errdiv = this.dom.holder.insert('div', 'div').attr('class', 'sja_errorbar')
				errdiv = this.dom.errdiv
			}
		}
		if (errdiv) errdiv.text(err?.message || err?.error || err).style('display', '')
	}
}

// default UI labels
// used by plot controls and tooltips
export const defaultUiLabels = {
	Samples: 'Samples',
	samples: 'samples',
	Sample: 'Sample',
	sample: 'sample',
	Terms: 'Variables',
	terms: 'variables',
	Term: 'Variable',
	term: 'Variable',
	Mutations: 'Mutations',
	term2: { label: 'Overlay', title: 'Overlay data' },
	term0: { label: 'Divide by', title: 'Divide by data' }
}
