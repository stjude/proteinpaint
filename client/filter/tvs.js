import * as rx from '../rx'
import { select } from 'd3-selection'
import { Menu } from '../dom/menu'
import { renderTable } from '../dom/table'
import { isNumericTerm, isCategoricalTerm } from '#shared/terms.js'
import { dtTerms } from '#shared/common.js'

/*
********************** EXPORTED
TVSInit()
showTvsMenu()
********************** INTERNAL
setRenderers(self)
	updateUI()
	enterPill()
	updatePill()
	exitPill()
	showMenu()
	makeValueTable()
	removeValueBtn()
setInteractivity()
addExcludeCheckbox()
*/

class TVS {
	constructor(opts) {
		this.opts = this.validateOpts(opts)
		this.dom = { holder: opts.holder, tip: new Menu({ padding: '5px' }) }
		this.durations = { exit: 0 }

		setInteractivity(this)
		setRenderers(this)
		this.categoryData = {}
		this.handlerByType = {}
		this.api = {
			main: this.main.bind(this),
			showMenu: this.showMenu
		}
	}

	validateOpts(o) {
		if (!o.holder) throw '.holder missing'
		if (!o.vocabApi) throw '.vocabApi missing'
		if (typeof o.callback != 'function') throw '.callback() is not a function'
		return o
	}

	async main(data = {}) {
		this.tvs = data.tvs
		this.filter = data.filter
		await this.setHandler()
		await this.updateUI()
		// when there are filters to be removed, must account for the delayed
		// removal after opacity transition, as btn count will decrease only
		// after the transition and remove() is done
		//
		// !!! TODO: how to pass bus.emit('postRender') delay to rx.component.api.update()
		// this.bus.emit('postRender', null, filters.exit().size() ? this.durations.exit + 100 : 0)
	}

	async setHandler() {
		if (!this.tvs || !this.tvs.term) return
		const term = this.tvs.term
		const type = isNumericTerm(term)
			? 'numeric'
			: isCategoricalTerm(term)
			? 'categorical'
			: term.type == 'dtcnv'
			? this.getDtCnvType(term)
			: term.type
		if (!this.handlerByType[type]) {
			try {
				const _ = await import(`./tvs.${type}.js`)
				const handler = _.handler
				this.handlerByType[type] = handler
			} catch (e) {
				throw `error with handler='./tvs.${type}.js': ${e}`
			}
		}
		this.handler = this.handlerByType[type]
	}

	getDtCnvType(term) {
		// determine dtcnv type by whether cnv data is continuous or categorical
		if (term.type != 'dtcnv') return
		const termdbConfig = this.opts.vocabApi.termdbConfig || this.opts.vocabApi.parent_termdbConfig
		const cnv = termdbConfig.queries?.cnv
		if (!cnv) throw 'cnv query is missing'
		const keys = Object.keys(cnv)
		const mode = keys.includes('cnvGainCutoff') || keys.includes('cnvLossCutoff') ? 'continuous' : 'categorical'
		return term.type + '.' + mode
	}
}

export const TVSInit = rx.getInitFxn(TVS)

function setRenderers(self) {
	self.updateUI = function () {
		const terms_div = self.dom.holder
		/*
			Currently, only a single pill per tvs is rendered, so using the 
			array [self.tvs] may seem unnecessary. However, using the
			enter/update/exit pattern helps with coding consistency across components,
			and more clearly indicates whether the whole pill is replaced
			or if only its values are updated.
		*/
		const filters = terms_div.selectAll('.tvs_pill').data([self.tvs], tvs => tvs?.term.id)
		filters.exit().each(self.exitPill)
		filters.each(self.updatePill)
		filters
			.enter()
			.append('div')
			.attr('class', 'tvs_pill')
			.style('white-space', 'nowrap')
			.style('display', 'inline-block')
			.transition()
			.duration(200)
			.each(self.enterPill)
	}

	self.enterPill = async function () {
		const one_term_div = select(this).style('font-size', '.9em')

		//term name div
		one_term_div
			.append('div')
			.attr('class', 'term_name_btn sja_filter_tag_btn')
			.style('display', 'inline-block')
			.style('border-radius', '6px 0 0 6px')
			.style('padding', '6px 6px 3px 6px')
			.html(self.handler.term_name_gen)
			.style('text-transform', 'uppercase')

		// negate button
		one_term_div
			.append('div')
			.attr('class', 'negate_btn')
			.style('cursor', 'default')
			//.style('display', 'inline-block' : 'none')
			.style('padding', '6px 6px 3px 6px')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(
				self.handler.getNegateText?.(self) || (self.tvs.isnot && self.tvs.term.type !== 'geneVariant' ? 'NOT' : 'IS')
			)

		self.updatePill.call(this)
	}

	// optional _holder, for example when called by filter.js
	self.showMenu = _holder => {
		const holder = _holder ? _holder : self.dom.tip
		if (self.tvs.term.type != 'geneVariant' && !(self.tvs.term.type == 'dtcnv' && self.tvs.continuousCnv)) {
			addExcludeCheckbox(holder, self.tvs, self)
		}
		self.handler.fillMenu(self, holder, self.tvs)
	}

	self.updatePill = async function () {
		const one_term_div = select(this)
		const tvs = one_term_div.datum()
		const lstlen =
			(self.tvs.values && self.tvs.values.length) ||
			(self.tvs.ranges && self.tvs.ranges.length) ||
			self.tvs.term.type == 'samplelst' ||
			dtTerms.map(t => t.type).includes(self.tvs.term.type)

		// update the main label
		one_term_div.select('.term_name_btn').html(self.handler.term_name_gen)
		// negate button
		one_term_div
			.select('.negate_btn')
			.style('display', lstlen ? 'inline-block' : 'none')
			.style('background', self.tvs.isnot ? '#f4cccc' : '#a2c4c9')
			.html(self.handler.getNegateText?.(self) || (tvs.isnot && tvs.term.type !== 'geneVariant' ? 'NOT' : 'IS'))

		const label = self.handler.get_pill_label(tvs)
		if (!('grade_type' in label)) label.grade_type = ''

		const value_btns = one_term_div.selectAll('.value_btn').data(label ? [label] : [], d => d.txt + d.grade_type)

		value_btns.exit().each(self.removeValueBtn)

		value_btns
			.enter()
			.append('div')
			.attr('class', 'value_btn sja_filter_tag_btn')
			.style('display', lstlen ? 'inline-block' : 'none')
			.style('padding', '6px 6px 3px 6px')
			.style('border-radius', '0 6px 6px 0')
			.style('font-style', 'italic')
			.html(d => d.txt)
			.append('div')
			.attr('class', 'grade_type_btn')
			.style('display', 'inline-block')
			.style('margin', '0 5px')
			.style('font-size', '.6em')
			.style('text-transform', 'uppercase')
			.html(d => d.grade_type)
			.style('opacity', 0)
			.transition()
			.duration(200)
			.style('opacity', 1)
	}

	self.exitPill = async function (term) {
		select(this).style('opacity', 1).transition().duration(self.durations.exit).style('opacity', 0).remove()
	}

	self.makeValueTable = function (div, tvs, values, callback) {
		if (values?.length == 0) return div
		const containerDiv = div.append('div').style('font-size', '0.8rem')

		const tableDiv = containerDiv.append('div')
		// add barchart bar_width for values
		const maxCount = Math.max(...values.map(v => v.samplecount), 0)
		values.forEach(v => (v.bar_width_frac = Number((1 - (maxCount - v.samplecount) / maxCount).toFixed(4))))

		const maxBarWidth = 100
		const rows = []
		const selectedIdxs = []
		for (const [i, value] of values.entries()) {
			let label = value.label || value.key
			if (value.samplecount) label += ' (n=' + value.samplecount + ')'
			const barWidth = maxBarWidth * value.bar_width_frac
			const bar_td = `<div style='margin:1px 10px;width:${barWidth}px;height:15px;background-color:#ddd'>`
			rows.push([{ value: label }, { html: bar_td }])
			let checked = false
			if (
				tvs.term.type == 'categorical' ||
				tvs.term.type == 'survival' ||
				dtTerms.map(t => t.type).includes(tvs.term.type)
			)
				checked = tvs.values.find(a => a.key === value.key)
			else if (tvs.term.type == 'float' || tvs.term.type == 'integer')
				checked = tvs.ranges.find(a => String(a.value) === value.value.toString())
			else if (tvs.term.type == 'condition') checked = tvs.values.find(a => String(a.key) === String(value.key))
			if (checked) selectedIdxs.push(i)
		}
		const columns = [{ label: 'tvs' }, { label: 'bar' }]
		const applybt = {
			text: 'APPLY',
			class: 'sjpp_apply_btn sja_filter_tag_btn',
			callback: indexes => {
				if (callback) callback(indexes)
			}
		}

		self.tableApi = renderTable({
			rows,
			columns,
			div: tableDiv,
			maxWidth: '40vw',
			maxHeight: '40vh',
			buttons: [applybt],
			showHeader: false,
			striped: false,
			showLines: false,
			selectedRows: selectedIdxs,
			selectedRowStyle: {
				'text-decoration': tvs.isnot ? 'line-through' : ''
			}
		})

		return tableDiv
	}

	self.removeValueBtn = function (d, j) {
		const one_term_div = select(this.parentNode)
		const tvs = one_term_div.datum()
		const select_remove_pos = self.handler.getSelectRemovePos(j, tvs)

		select(one_term_div.selectAll('.value_select')._groups[0][select_remove_pos]).remove()
		select(one_term_div.selectAll('.or_btn')._groups[0][j]).remove()
		select(this).style('opacity', 1).transition().duration(self.durations.exit).style('opacity', 0).remove()
	}
}

function setInteractivity(self) {
	// optional event handlers
}

// opts is the same argument for the TVS constructor()
export async function showTvsMenu(opts) {
	const self = new TVS(opts)
	self.tvs = {
		term: opts.term
	}
	self.filter = opts.filter
	//addExcludeCheckbox(opts.holder, self.tvs)
	await self.setHandler()
	if (self.handler.setTvsDefaults) self.handler.setTvsDefaults(self.tvs)
	self.handler.fillMenu(self, opts.holder, self.tvs)
}

function addExcludeCheckbox(holder, tvs, self) {
	const isNotLabels = holder
		.selectAll('label')
		.data([{ label: 'Exclude', value: 'false', checked: tvs.isnot !== undefined ? tvs.isnot : false }])
		.enter()
		.append('label')
		.style('margin', '0 5px')
	const isNotInput = isNotLabels
		.append('input')
		.attr('type', 'checkbox')
		.attr('name', 'sja_filter_isnot_input')
		.attr('value', d => d.value)
		.property('checked', d => d.checked)
		.style('vertical-align', 'top')
		.style('margin-right', '3px')
		.on('change', () => {
			tvs.isnot = isNotInput.node().checked

			if (self.tableApi) {
				self.tableApi.update({
					selectedRowStyle: {
						'text-decoration': tvs.isnot ? 'line-through' : ''
					}
				})
			}
		})
	isNotLabels
		.append('span')
		.style('margin-right', '5px')
		.style('vertical-align', 'top')
		.html(d => d.label)
}
