import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../index.ts'
import type { NumRegularBin, NumCustomBins, NumCont, NumSpline } from '#tw'
import { Tabs } from '#dom'
import { NumericDensity } from './NumericDensity.ts'
import { DNA_METHYLATION } from '#types'
import { getDNAMethUnit, getDNAMethTermName } from '#tw/dnaMethylation'
import type { NumContEditor } from './NumContEditor'
import type { NumDiscreteEditor } from './NumDiscreteEditor'
import type { NumBinaryEditor } from './NumBinaryEditor'
import type { NumSplineEditor } from './NumSplineEditor'

type NumericTabCallback = (event: PointerEvent, tab: TabData) => void

type TabData = {
	mode: 'continuous' | 'discrete' | 'binary' | 'spline'
	label: string
	callback: NumericTabCallback
	contentHolder?: any //
	active?: boolean
}

/*
	NumericHandler 
	- NumericDensity
	- NumericDiscrete
		 - NumRegularBinEditor
		 - NumCustomBinEditor
*/

type EditHandler = NumContEditor | NumDiscreteEditor | NumBinaryEditor | NumSplineEditor

export class NumericHandler extends HandlerBase implements Handler {
	opts: any // TODO
	tw: NumRegularBin | NumCustomBins | NumCont | NumSpline
	tabs: TabData[] = []
	handlerByMode: {
		[twType: string]: EditHandler
	} = {}
	editHandler!: EditHandler
	toggleBtns!: Tabs

	dom: {
		[name: string]: any
	} = {}

	density: NumericDensity
	density_data!: any

	constructor(opts) {
		super(opts)
		this.opts = opts
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.tabs = this.setTabData()
		this.density = new NumericDensity(opts)
	}

	getPillStatus() {
		this.tw = this.termsetting.tw as NumRegularBin | NumCustomBins | NumCont | NumSpline // TODO: do not force type
		return this.tw.getStatus(this.termsetting.usecase, this.termsetting.data)
	}

	setTabData() {
		const self = this.termsetting
		const tabs: TabData[] = []
		const callback = async (event, tabData) => {
			if (event) event.stopPropagation()
			try {
				await this.setEditHandler(tabData)
				//this.dom.editDiv.selectAll('*').remove()
				await this.editHandler.showEditMenu(tabData.contentHolder) //this.dom.editDiv)
			} catch (e) {
				this.dom.errdiv.style('display', '').text(e)
			}
		}

		const numTabs = self.opts.numericEditMenuVersion.length
		if (self.opts.numericEditMenuVersion.includes('continuous')) {
			tabs.push({
				mode: 'continuous',
				label: self.term.type == 'survival' ? 'Time to Event' : 'Continuous',
				callback,
				active: this.tw.q.mode === 'continuous' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('discrete')) {
			tabs.push({
				mode: 'discrete',
				label: self.term.type == 'survival' ? 'Exit code' : 'Discrete',
				callback,
				active: this.tw.q.mode === 'discrete' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('spline')) {
			tabs.push({
				mode: 'spline',
				label: 'Cubic spline',
				callback,
				active: this.tw.q.mode === 'spline' || numTabs === 1
			})
		}

		if (self.opts.numericEditMenuVersion.includes('binary')) {
			tabs.push({
				mode: 'binary',
				label: 'Binary',
				callback,
				active: this.tw.q.mode === 'binary' || numTabs === 1
			})
		}

		return tabs
	}

	async setEditHandler(tabData) {
		if (!this.handlerByMode[tabData.mode]) {
			switch (tabData.mode) {
				case 'continuous': {
					const { NumContEditor } = await import('./NumContEditor.ts')
					this.handlerByMode.continuous = new NumContEditor(this.opts, this)
					break
				}
				case 'discrete': {
					const { NumDiscreteEditor } = await import('./NumDiscreteEditor.ts')
					this.handlerByMode.discrete = new NumDiscreteEditor(this.opts, this)
					break
				}
				case 'binary': {
					const { NumBinaryEditor } = await import('./NumBinaryEditor.ts')
					this.handlerByMode.binary = new NumBinaryEditor(this.opts, this)
					break
				}
				case 'spline': {
					const { NumSplineEditor } = await import('./NumSplineEditor.ts')
					this.handlerByMode.spline = new NumSplineEditor(this.opts, this)
					break
				}
				default:
					throw `unexpected numeric tabData.mode='${tabData.mode}'`
					break
			}
		}
		this.editHandler = this.handlerByMode[tabData.mode]
	}

	async showEditMenu(div) {
		try {
			this.showLoading(div)
			this.dom.errdiv = div.append('div').attr('class', 'sja_errorbar').style('display', 'none')
			this.tw = this.termsetting.tw as NumRegularBin | NumCustomBins | NumCont | NumSpline // TODO: do not force type

			const self = this.tw
			for (const t of this.tabs) {
				t.active = this.tabs.length === 1 || self.q.mode == t.mode || (t.mode == 'continuous' && !self.q.mode)
			}

			this.density_data = await this.density.setData()
			await this.setEditHandler(this.tabs.find(t => t.active))
			this.renderUnitRow(div)
			this.dom.editDiv = div.append('div').attr('data-testid', 'sjpp-num-ts-edit-div')
			this.dom.btnDiv = div.append('div').style('margin', '0px 0px 5px 5px')
			this.renderButtons(this.dom.btnDiv)

			if (this.tabs.length > 1) {
				this.dom.topBar = this.dom.editDiv
					.append('div')
					.attr('data-testid', 'sja-ts-numeric-edit-top-bar')
					.style('padding', '10px')
				this.dom.topBar.append('span').html('Use as&nbsp;')
				new Tabs({
					holder: this.dom.topBar.append('div').style('display', 'inline-block'),
					contentHolder: this.dom.editDiv.append('div'),
					noTopContentStyle: true,
					tabs: this.tabs
				}).main()
			} else {
				await this.editHandler.showEditMenu(this.dom.editDiv)
			}

			this.dom.loadingDiv.style('display', 'none')
		} catch (e: any) {
			this.hideLoading()
			this.dom.errdiv.style('display', '').text(typeof e == 'object' ? e.message || e.error || e : e)
		}
	}

	/* Methylation is read on two interchangeable scales: beta, the fraction of methylated reads (0 to
	1), and its logit, the M-value. Which one a dataset's matrices store is fixed, but which one a plot
	shows is a display choice -- and it matters, because an M-value has no finite value at beta 0, so
	samples with no methylated reads land at about -20 and sit as a column far from every other point.
	The choice rides on term.unit, which the server's methylation getter reads per term. */
	renderUnitRow(div) {
		const ts: any = this.termsetting
		const term = ts.term
		if (term?.type != DNA_METHYLATION) return
		if (!ts.vocabApi?.termdbConfig?.queries?.dnaMethylation) return
		const current = term.unit || getDNAMethUnit(term.genomicFeatureType, ts.vocabApi)
		const isBeta = /beta/i.test(current || '')

		const row = div.append('div').attr('data-testid', 'sjpp-dnameth-unit-row').style('padding', '10px 10px 0px 10px')
		row.append('span').style('opacity', 0.6).html('Unit&nbsp;')
		const name = 'sjpp-dnameth-unit-' + Math.random().toString(36).slice(2)
		for (const opt of [
			{ label: 'Beta value (0 to 1)', beta: true },
			{ label: 'M-value', beta: false }
		]) {
			const lab = row.append('label').style('margin-right', '12px').style('cursor', 'pointer')
			lab
				.append('input')
				.attr('type', 'radio')
				.attr('name', name)
				.property('checked', opt.beta === isBeta)
				.on('change', () => this.applyUnit(opt.beta))
			lab.append('span').html('&nbsp;' + opt.label)
		}
	}

	/** Switch the term's unit and re-request its values on that scale. */
	applyUnit(toBeta: boolean) {
		const ts: any = this.termsetting
		const term = ts.term
		const wasBeta = /beta/i.test(term.unit || getDNAMethUnit(term.genomicFeatureType, ts.vocabApi) || '')
		if (wasBeta === toBeta) return
		term.unit = toBeta ? 'Average Beta Value' : 'Average M-value'
		// the unit is part of the term's name, which titles the plot and labels its axis
		if (term.genomicFeatureType) term.name = getDNAMethTermName(term, term.unit)

		const convert = (v: number) => {
			if (!Number.isFinite(v)) return v
			if (toBeta) return Number((2 ** v / (2 ** v + 1)).toFixed(4))
			const c = Math.min(Math.max(v, 1e-6), 1 - 1e-6)
			return Number(Math.log2(c / (1 - c)).toFixed(4))
		}
		const q: any = ts.q || {}
		if (q.type == 'custom-bin' && Array.isArray(q.lst)) {
			// boundaries the user chose: the scales map one to one, so carry them across exactly
			for (const b of q.lst) {
				if ('start' in b) b.start = convert(b.start)
				if ('stop' in b) b.stop = convert(b.stop)
			}
		} else {
			/* Anything else is a bin SIZE as much as a boundary, and a bin of constant width on one
			scale is not one on the other -- so drop back to the defaults, which are derived from the
			data and so come back on the new scale. */
			ts.q = { mode: q.mode || 'continuous' }
		}
		delete term.bins // recomputed from the data, on the new scale

		ts.dom?.tip?.hide()
		ts.api.runCallback()
	}

	renderButtons(btnDiv) {
		btnDiv
			.append('button')
			.style('margin', '5px')
			.attr('data-testId', 'sjpp_numeric_edit_apply')
			.html('Apply')
			.on('click', () => {
				this.termsetting.q = this.editHandler.getEditedQ()
				this.termsetting.dom.tip.hide()
				this.termsetting.api.runCallback()
			})

		btnDiv
			.append('button')
			.style('margin', '5px')
			.attr('data-testId', 'sjpp_numeric_edit_reset')
			.html('Reset')
			.on('click', () => {
				this.editHandler.undoEdits()
			})
	}

	destroy() {
		for (const s of Object.values(this.dom)) {
			if (typeof s.remove == 'function') s.remove()
		}
		this.density.destroy()
	}
}
