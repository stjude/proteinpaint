//import { keyupEnter } from '#src/client'
//import { format } from 'd3-format'
import { Tabs } from '#dom'
//import { getPillNameDefault } from '../utils.ts'
import { HandlerBase } from '../HandlerBase.ts'
import type { Handler } from '../types.ts'
import type { TermSetting } from '../TermSetting.ts'
import type { NumRegularBin, NumCustomBins } from '#tw'
import type { NumericHandler } from './NumericHandler.ts'
import { NumRegularBinEditor } from './NumRegularBinEditor.ts'
import { NumCustomBinEditor } from './NumCustomBinEditor.ts'

// To show edit menu
export class NumDiscreteEditor extends HandlerBase implements Handler {
	tw: NumRegularBin | NumCustomBins
	termsetting: TermSetting
	handler: NumericHandler
	dom: {
		[name: string]: any
	} = {}
	draggedItem: any
	removedGrp: any
	editedName: any
	boundaryInclusion: 'startinclusive' | 'stopinclusive' = 'stopinclusive'

	activeTab: 'regular-bin' | 'custom-bin' = 'regular-bin'
	editorsByType: {
		'regular-bin': NumRegularBinEditor
		'custom-bin': NumCustomBinEditor
	}

	constructor(opts, handler) {
		super(opts)
		this.termsetting = opts.termsetting
		this.tw = opts.termsetting.tw
		this.handler = handler
		this.editorsByType = {
			'regular-bin': new NumRegularBinEditor(this),
			'custom-bin': new NumCustomBinEditor(this)
		}
		if (this.tw.term.bins?.default.type != 'regular-bin') this.activeTab = 'custom-bin'
		//this.dom.holder = opts.holder || this.termsetting.dom.tip.d
	}

	setDefaultBoundaryInclusion() {
		if (this.tw.q.mode == 'discrete') {
			if (this.tw.q.type == 'regular-bin')
				this.boundaryInclusion = this.tw.q.startinclusive ? 'startinclusive' : 'stopinclusive'
			else this.boundaryInclusion = this.tw.q.lst[0].startinclusive ? 'startinclusive' : 'stopinclusive'
		} else {
			this.boundaryInclusion = 'stopinclusive'
		}
	}

	async showEditMenu(div: any) {
		if (this.dom.boundaryInclusionDiv) {
			if (div.node().contains(this.dom.boundaryInclusionDiv.node())) return // already rendered
			else delete this.dom.boundaryInclusionDiv
		}

		this.dom.density_div = div.append('div')
		await this.handler.density.showViolin(this.dom.density_div)

		this.tw = this.termsetting.tw as NumRegularBin | NumCustomBins // TODO: do not force
		this.setDefaultBoundaryInclusion()
		this.renderBoundaryInclusionInput(div)
		this.mayShowValueconversionMsg(div)
		this.renderTypeInputs(div)
	}

	renderBoundaryInclusionInput(div) {
		this.dom.boundaryInclusionDiv = div.append('div')
		this.dom.boundaryInclusionDiv
			.append('span')
			.style('padding', '5px')
			.style('color', 'rgb(136, 136, 136)')
			.html('Boundary Inclusion')

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		this.dom.boundaryInput = this.dom.boundaryInclusionDiv
			.append('select')
			.style('margin-left', '10px')
			.on('change', () => {
				this.boundaryInclusion = this.dom.boundaryInput.property('value')
				if (this.activeTab == 'custom-bin') this.editorsByType[this.activeTab].handleInputChange()
				const q = this.editorsByType['regular-bin'].q
				q.startinclusive = this.boundaryInclusion === 'startinclusive'
				q.stopinclusive = this.boundaryInclusion === 'stopinclusive'
			})

		this.dom.boundaryInput
			.selectAll('option')
			.data([
				{ value: 'stopinclusive', html: `start &lt; ${x} &le; end` },
				{ value: 'startinclusive', html: `start &le; ${x} &lt; end` }
			])
			.enter()
			.append('option')
			.property('value', d => d.value)
			.property('selected', d => d.value === this.boundaryInclusion)
			.html(d => d.html)
	}

	mayShowValueconversionMsg(div) {
		const term = this.tw.term
		if ('valueConversion' in term) {
			div
				.append('div')
				.style('margin-bottom', '5px')
				.style('opacity', 0.6)
				// TODO: remove forced property
				.text(`Note: using values by the unit of ${term.valueConversion?.fromUnit}.`)
		}
	}

	renderTypeInputs(_div) {
		this.dom.binsDiv = _div.append('div')
		//const handler = this.handler
		//const self = handler.termsetting
		const div = this.dom.binsDiv.append('div').style('margin', '10px')

		if (this.tw.term.bins?.default.type == 'custom-bin') {
			/*
			this term's default bin is custom bin! it's without a regular binning config
			cannot render regular/custom bin switchtab, as regular ui will break without that part of data
			only render custom bin ui, and do not allow switching from custom to regular bin size
			*/
			// self.q.type = 'custom-bin'
			// setqDefaults(handler)
			// setDensityPlot(handler)
			// renderCustomBinInputs(handler, div)
			this.editorsByType['custom-bin'].render(div)
			return
		}

		if (this.tw.term.bins?.default.type != 'regular-bin')
			throw 'self.bins.default.type is neither regular-bin or custom-bin, cannot render ui'

		// toggle switch between regular and custom
		const tabs: any = [
			{
				active: this.tw.q.type == 'regular-bin',
				label: 'Same bin size',
				callback: async (_, tab) => {
					// do not overwrite previously rendered inputs
					// that may have been already edited by the user
					if (tab.isInitialized) return
					this.activeTab = 'regular-bin'
					await this.editorsByType['regular-bin'].render(tab.contentHolder)
				}
			},
			{
				active: this.tw.q.type == 'custom-bin',
				label: 'Varying bin sizes',
				callback: async (event, tab) => {
					// do not overwrite previously rendered inputs
					// that may have been already edited by the user
					if (tab.isInitialized) return
					this.activeTab = 'custom-bin'
					await this.editorsByType['custom-bin'].render(tab.contentHolder)
				}
			}
		]
		new Tabs({ holder: div, tabs }).main()
	}

	getEditedQ(destroyDom = true) {
		this.boundaryInclusion = this.dom.boundaryInput.property('value')
		return this.editorsByType[this.activeTab].getEditedQ(destroyDom)
		if (destroyDom) this.destroy()
	}

	undoEdits() {
		this.setDefaultBoundaryInclusion()
		this.dom.boundaryInput.property('value', this.boundaryInclusion)
		this.editorsByType[this.activeTab].undoEdits()
	}

	destroy() {
		for (const name of Object.keys(this.dom)) {
			this.dom[name].remove()
			delete this.dom[name]
		}
	}
}
