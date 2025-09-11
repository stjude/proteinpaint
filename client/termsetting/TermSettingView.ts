import { select, type BaseType } from 'd3-selection'
import type { TermSetting } from './TermSetting.ts'

type TermsSettingViewOpts = {
	termsetting: TermSetting
}

export class TermSettingView {
	termsetting: TermSetting

	_exitPill: (elem: HTMLElement) => void
	_updatePill: (elem: HTMLElement) => void
	_enterPill: (elem: HTMLElement) => void

	constructor(opts: TermsSettingViewOpts) {
		this.termsetting = opts.termsetting
		this.initUI(opts.termsetting)
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const view = this
		// these methods are required to correctly handle the `this` == HTMLElement context as used by d3-selection,
		// while also keeping the `this` method reference to the view instance
		this._exitPill = function (this: HTMLElement) {
			view.exitPill(this)
		}
		this._updatePill = function (this: HTMLElement) {
			view.updatePill(this)
		}
		this._enterPill = function (this: HTMLElement) {
			view.enterPill(this)
		}
	}

	initUI(self) {
		// run only once, upon init
		if (self.opts.$id) {
			self.dom.tip.d.attr('id', self.opts.$id + '-ts-tip')
		}

		if (!self.dom.holder) return // toggle the display of pilldiv and nopilldiv with availability of this.term
		self.dom.nopilldiv = self.dom.holder
			.append('div')
			.style('cursor', 'pointer')
			.on('click', () => self.actions.clickNoPillDiv())
			.on(`keyup.sjpp-termdb`, event => {
				if (event.key == 'Enter') self.api.showTree(event)
			})
		self.dom.pilldiv = self.dom.holder.append('div')

		// nopilldiv - placeholder label
		if (self.opts.placeholder) {
			self.dom.nopilldiv
				.append('div')
				.html(self.placeholder)
				.attr('class', 'sja_clbtext2')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
		}

		// nopilldiv - plus button
		if (self.opts.placeholderIcon) {
			self.dom.nopilldiv
				.append('div')
				.attr('class', 'sja_filter_tag_btn add_term_btn')
				.style('padding', '3px 6px 3px 6px')
				.style('display', 'inline-block')
				.style('border-radius', '6px')
				.style('background-color', '#4888BF')
				.text(self.opts.placeholderIcon)
		}

		self.dom.btnDiv = self.dom.holder.append('div')
		self.dom.content_holder = select(self.dom.holder.node().parentNode).append('div')
	}

	async updateUI() {
		const self = this.termsetting

		self.dom.btnDiv.selectAll('*').remove() //remove info button
		self.dom.content_holder.selectAll('*').remove() //remove info content

		if (!self.term) {
			// no term
			self.dom.nopilldiv.style('display', 'block')
			self.dom.pilldiv.style('display', 'none')
			self.dom.btnDiv.style('display', 'none')
			return
		}

		// has term
		// add info button for terms with meta data
		if (self.term.hashtmldetail) {
			if (self.opts.buttons && !self.opts.buttons.includes('info')) self.opts.buttons.unshift('info')
			else self.opts.buttons = ['info']
		} else {
			self.opts.buttons = []
		}

		if (self.opts.buttons.length) {
			self.dom.btnDiv
				.selectAll('div')
				.data(self.opts.buttons)
				.enter()
				.append('div')
				.style('display', 'inline-block')
				.style('padding', '0px 5px')
				.style('cursor', 'pointer')
				.style('color', '#999')
				.style('font-size', '.8em')
				.html((d: string) => d.toUpperCase())
				.on('click', (event: any, d: string) => {
					if (d == 'delete') self.actions.removeTerm()
					else if (d == 'replace') {
						self.api.showTree(event.target, event)
					} else throw 'unknown button'
				})

			// render info button only if term has html details
			if (self.term.hashtmldetail) {
				const infoIcon_div = self.dom.btnDiv.selectAll('div').filter(function (this: BaseType) {
					return select(this).text() === 'INFO'
				})

				// TODO: modify termInfoInit() to display term info in tip rather than in div
				// can be content_tip: self.dom.tip.d to separate it from content_holder
				const termInfo = await import('../termdb/termInfo.js')
				termInfo.termInfoInit({
					vocabApi: self.opts.vocabApi,
					icon_holder: infoIcon_div,
					content_holder: self.dom.content_holder,
					id: self.term.id,
					state: { term: self.term }
				})
			}
		}

		self.dom.nopilldiv.style('display', 'none')
		self.dom.pilldiv.style('display', self.opts.buttons ? 'inline-block' : 'block')
		self.dom.btnDiv.style('display', self.opts.buttons ? 'inline-block' : 'none')

		//Gene expression terms do not have an id. Use the name if an id is not available.
		const pills = self.dom.pilldiv.selectAll('.ts_pill').data([self.term], (d: any) => d.id || d.name)

		// this exit is really nice
		pills.exit().each(this._exitPill)

		pills.transition().duration(200).each(this._updatePill)

		pills
			.enter()
			.append('div')
			.attr('class', 'ts_pill')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto')
			.style('grid-template-areas', '"left right"')
			.style('cursor', 'pointer')
			.style('margin', '2px')
			.on('click', (event, clickedElem, menuHolder) => self.api.showMenu(event, clickedElem, menuHolder))
			.transition()
			.duration(200)
			.each(this._enterPill)
	}

	enterPill(elem) {
		const self = this.termsetting
		const one_term_div = select(elem)

		// left half of blue pill
		self.dom.pill_termname = one_term_div
			.append('div')
			.attr('class', 'term_name_btn  sja_filter_tag_btn')
			.attr('tabindex', 0)
			.style('display', 'flex')
			.style('grid-area', 'left')
			.style('position', 'relative')
			.style('align-items', 'center')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '6px')
			.html(self.handler.getPillName)
			.on(`keyup.sjpp-termdb`, event => {
				if (event.key == 'Enter') event.target.click()
			})

		this.updatePill(elem)
	}

	async updatePill(elem) {
		const self = this.termsetting
		// decide if to show/hide the right half based on term status, and modify pill
		const one_term_div = select(elem)

		const pillstat: { text: string; bgcolor?: string } = self.handler.getPillStatus() || { text: '' }
		// { text, bgcolor }

		self.dom.pill_termname.style('border-radius', pillstat.text ? '6px 0 0 6px' : '6px').html(self.handler.getPillName)

		const pill_settingSummary = one_term_div
			.selectAll('.ts_summary_btn')
			// bind d.txt to dom, is important in making sure the same text label won't trigger the dom update
			.data(pillstat.text ? [{ txt: pillstat.text }] : [], (d: any) => d.txt as string)

		// because of using d.txt of binding data, exitPill cannot be used here
		// as two different labels will create the undesirable effect of two right halves
		pill_settingSummary.exit().remove()

		const righthalf = pill_settingSummary
			.enter()
			.append('div')
			.attr('class', 'ts_summary_btn sja_filter_tag_btn')
			.style('display', 'flex')
			.style('grid-area', 'right')
			.style('position', 'relative')
			.style('align-items', 'center')
			.style('padding', '3px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html((d: any) => d.txt)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)

		if (pillstat.bgcolor) {
			righthalf.transition().duration(200).style('background-color', pillstat.bgcolor)
		}
	}

	exitPill(elem) {
		select(elem).style('opacity', 1).transition().duration(this.termsetting.durations.exit).style('opacity', 0).remove()
	}
}
