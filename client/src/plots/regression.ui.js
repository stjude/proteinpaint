import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { termsettingInit } from '../common/termsetting'
import { dofetch3 } from '../client'
import { getNormalRoot } from '../common/filter'
import { get_bin_label } from '../../shared/termdb.bins'

class MassRegressionUI {
	constructor(opts) {
		this.type = 'regressionUI'
		this.sections = [
			{
				label: 'Outcome variable',
				prompt: {
					linear: '<u>Select continuous outcome variable</u>',
					logistic: '<u>Select outcome variable</u>'
				},
				placeholderIcon: '',
				configKey: 'term',
				limit: 1,
				selected: [],
				cutoffTermTypes: ['condition', 'integer', 'float'],
				exclude_types: {
					linear: ['categorical', 'survival'],
					logistic: ['survival']
				},
				// to track and recover selected term pills, info divs, other dom elements,
				// and avoid unnecessary jerky full rerenders for the same term
				items: {}
			},
			{
				label: 'Independent variable(s)',
				prompt: {
					linear: '<u>Add independent variable</u>',
					logistic: '<u>Add independent variable</u>'
				},
				placeholderIcon: '',
				configKey: 'independent',
				limit: 10,
				selected: [],
				items: {},
				exclude_types: {
					linear: ['condition', 'survival'],
					logistic: ['condition', 'survival']
				}
			}
		]
		// track reference category values or groups by term ID
		this.refGrpByTermId = {}
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		try {
			const controls = this.opts.holder.append('div').style('display', 'block')

			this.dom = {
				div: this.opts.holder, //.style('margin', '10px 0px'),
				controls,
				body: controls.append('div'),
				foot: controls.append('div')
			}
			this.totalSampleCount = undefined

			this.opts.chart.on('postRender.submitBtn', () => {
				const chartRendered = true
				this.updateBtns(chartRendered)
			})
		} catch (e) {
			throw e
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			isVisible: config.settings && config.settings.currViews.includes('regression'),
			activeCohort: appState.activeCohort,
			vocab: appState.vocab,
			termfilter: appState.termfilter,
			config: {
				cutoff: config.cutoff,
				term: config.term,
				regressionType: config.regressionType,
				independent: config.independent,
				settings: {
					table: config.settings && config.settings.regression
				}
			}
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) {
			return action.id === this.id
		}
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type == 'app_refresh') return true
	}

	main() {
		// create a writable config copy, that would not
		// mutate the actual state until the form is submitted
		this.config = copyMerge('{}', this.state.config)
		if (!this.dom.submitBtn) this.initUI()
		this.render()
	}

	setDisableTerms() {
		this.disable_terms = []
		if (this.config.term) this.disable_terms.push(this.config.term.id)
		if (this.config.independent) for (const term of this.config.independent) this.disable_terms.push(term.id)
	}

	async updateValueCount(d) {
		// query backend for total sample count for each value of categorical or condition terms
		// and included and excluded sample count for nuemric term

		// query backend for median and create custom 2 bins with median and boundry 
		// for logisctic independet numeric terms
		if (d.section.configKey == 'term' && this.config.regressionType == 'logistic') {
			const lst = [
				'/termdb?getmedian=1',
				'tid=' + d.term.id,
				'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(this.state.termfilter.filter))),
				'genome=' + this.state.vocab.genome,
				'dslabel=' + this.state.vocab.dslabel
			]
			const url = lst.join('&')
			const data = await dofetch3(url, {}, this.app.opts.fetchOpts)
			if (data.error) throw data.error
			const median = data.median
			d.term.q = {
				mode: 'binary',
				type: 'custom',
				lst: [
					{
						startunbounded: true,
						stopinclusive: true,
						stop: +median.toFixed(d.term.type == 'integer' ? 0 : 2)
					},
					{
						stopunbounded: true,
						stopinclusive: true,
						start: +median.toFixed(d.term.type == 'integer' ? 0 : 2)
					}
				]
		  }

		  d.term.q.lst.forEach(bin => {
				if (!('label' in bin)) bin.label = get_bin_label(bin, d.term.q)
			})
		}

		const q = JSON.parse(JSON.stringify(d.term.q))
		delete q.values
		const lst = [
			'/termdb?getcategories=1',
			'tid=' + d.term.id,
			'term1_q=' + encodeURIComponent(JSON.stringify(q)),
			'filter=' + encodeURIComponent(JSON.stringify(getNormalRoot(this.state.termfilter.filter))),
			'genome=' + this.state.vocab.genome,
			'dslabel=' + this.state.vocab.dslabel
		]
		if (q.bar_by_grade) lst.push('bar_by_grade=1')
		if (q.bar_by_children) lst.push('bar_by_children=1')
		if (q.value_by_max_grade) lst.push('value_by_max_grade=1')
		if (q.value_by_most_recent) lst.push('value_by_most_recent=1')
		if (q.value_by_computable_grade) lst.push('value_by_computable_grade=1')
		const url = lst.join('&')
		const data = await dofetch3(url, {}, this.app.opts.fetchOpts)
		if (data.error) throw data.error
		d.orderedLabels = data.orderedLabels

		// sepeate include and exclude categories based on term.values.uncomputable
		const excluded_values = d.term.term.values
			? Object.entries(d.term.term.values)
					.filter(v => v[1].uncomputable)
					.map(v => v[1].label)
			: []
		d.sampleCounts = data.lst.filter(v => !excluded_values.includes(v.label))
		d.excludeCounts = data.lst.filter(v => excluded_values.includes(v.label))

		// get include, excluded and total sample count
		const totalCount = (d.term.q.totalCount = { included: 0, excluded: 0, total: 0 })
		d.sampleCounts.forEach(v => (totalCount.included = totalCount.included + v.samplecount))
		d.excludeCounts.forEach(v => (totalCount.excluded = totalCount.excluded + v.samplecount))
		totalCount.total = totalCount.included + totalCount.excluded

		// store total count from numerical/categorical term as global variable totalSampleCount
		if (this.totalSampleCount == undefined && d.term.term.type != 'condition') this.totalSampleCount = totalCount.total
		// for condition term, subtract included count from totalSampleCount to get excluded
		if (d.term.term.type == 'condition' && this.totalSampleCount) {
			totalCount.excluded = this.totalSampleCount - totalCount.included
		}
	}
}

function setRenderers(self) {
	self.initUI = () => {
		self.dom.submitBtn = self.dom.foot
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')
			.append('button')
			.style('display', 'none')
			.style('padding', '5px 15px')
			.style('border-radius', '15px')
			.html('Run analysis')
			.on('click', self.submit)

		self.updateBtns()
	}

	self.render = () => {
		self.setDisableTerms()
		const grps = self.dom.body.selectAll(':scope > div').data(self.sections || [])

		grps.exit().remove()
		grps.each(renderSection)
		grps
			.enter()
			.append('div')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.each(renderSection)

		self.updateBtns()
	}

	// initialize the ui sections
	function renderSection(section) {
		const div = select(this)

		// in case of an empty div
		if (!this.lastChild) {
			// firstChild
			div
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-size', '17px')
				.style('color', '#bbb')
				.text(section.label)

			// this.lastChild
			div.append('div')
		}

		const v = self.config[section.configKey]
		section.selected = Array.isArray(v) ? v : v ? [v] : []
		const itemRefs = section.selected.map(term => {
			if (!(term.id in section.items)) {
				section.items[term.id] = { section, term }
			}
			return section.items[term.id]
		})

		if (itemRefs.length < section.limit && !itemRefs.find(d => !d.term)) {
			// create or reuse a blank pill to prompt a new term selection
			if (!section.items.undefined) section.items.undefined = { section }
			itemRefs.push(section.items.undefined)
		}

		const pillDivs = select(this.lastChild)
			.selectAll(':scope > div')
			.data(itemRefs, d => d.term && d.term.id)
		pillDivs.exit().each(removePill)
		pillDivs.each(updatePill)
		pillDivs
			.enter()
			.append('div')
			.each(addPill)
	}

	function setActiveValues(d) {
		const gs = d.term.q.groupsetting || {}
		const i = gs.inuse && gs.predefined_groupset_idx
		d.values = gs.inuse
			? i !== undefined
				? d.term.term.groupsetting.lst[i].groups
				: gs.customset.groups
			: d.term.term.values
		d.label_key = gs.inuse ? 'name' : 'label'
	}

	async function addPill(d) {
		const config = self.config
		const div = select(this)
			.style('width', 'fit-content')
			.style('margin', '5px 15px 5px 45px')
			.style('padding', '3px 5px')
			.style('border-left', d.term ? '1px solid #bbb' : '')

		d.pill = termsettingInit({
			placeholder: d.section.prompt[config.regressionType],
			placeholderIcon: d.section.placeholderIcon,
			holder: div.append('div'),
			vocabApi: self.app.vocabApi,
			vocab: self.state.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			//showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			buttons: d.section.configKey == 'term' ? ['replace'] : ['delete'],
			numericEditMenuVersion: config.regressionType == 'linear' ? ['continuous', 'discrete'] : ['binary'],
			usecase: { target: 'regression', detail: d.section.configKey, regressionType: config.regressionType },
			disable_terms: self.disable_terms,
			abbrCutoff: 50,
			callback: term => {
				self.editConfig(d, term)
			}
		})
		d.dom = {
			infoDiv: div.append('div')
		}
		d.dom.loading_div = d.dom.infoDiv.append('div').text('Loading..')
		// d.dom.cutoffDiv = d.dom.infoDiv.append('div')
		d.dom.top_info_div = d.dom.infoDiv.append('div')
		d.dom.term_info_div = d.dom.top_info_div.append('div').style('display', 'inline-block')
		d.dom.ref_click_prompt = d.dom.top_info_div.append('div').style('display', 'inline-block')
		d.dom.term_values_div = d.dom.infoDiv.append('div')
		d.dom.values_table = d.dom.term_values_div.append('table')
		d.dom.term_summmary_div = d.dom.term_values_div.append('div')
		d.dom.excluded_table = d.dom.term_values_div.append('table')
		updatePill.call(this, d)
	}

	function updatePill(d) {
		select(this).style('border-left', d.term ? '1px solid #bbb' : '')
		d.dom.loading_div.style('display', 'block')
		d.pill.main(
			Object.assign(
				{
					disable_terms: self.disable_terms,
					exclude_types: d.section.exclude_types[self.config.regressionType],
					usecase: {
						target: 'regression',
						detail: d.section.configKey,
						regressionType: self.config.regressionType
					}
				},
				d.term
			)
		)
		d.dom.infoDiv.style('display', d.term ? 'block' : 'none')
		if (d.section.configKey == 'term') updateCutoff(d)
		// renderInfo() is required for both outcome and independent variables
		if (d.term) renderInfo(d)
	}

	function removePill(d) {
		delete d.section.items[d.term.id]
		const div = select(this)
		div
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	function updateCutoff(d) {
		if (!d.term || self.config.regressionType != 'logistic') return
		// set cutoff value of logistic numeric term
		if (d.term.q.lst && d.term.q.lst[0].stop) {
			self.config.cutoff = d.term.q.lst[0].stop
		}
		if (d.term.q.lst && !d.term.q.refGrp) {
			d.term.q.refGrp = d.term.q.lst[0].label
			self.refGrpByTermId[d.term.id] = d.term.q.lst[0].label
		}
	}

	async function renderInfo(d) {
		d.dom.infoDiv
			.style('display', 'block')
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')

		if (d.term) await self.updateValueCount(d)
		updateTermInfoDiv(d)
	}

	function updateTermInfoDiv(d) {
		setActiveValues(d)
		const q = (d.term && d.term.q) || {}
		if (!q.totalCount) q.totalCount = { included: 0, excluded: 0, total: 0 }
		if (d.section.configKey == 'independent') {
			if (d.term.term.type == 'float' || d.term.term.type == 'integer') {
				make_values_table(d)
				d.dom.term_info_div.html(
					`Use as ${q.mode || 'continuous'} variable.` + (q.scale ? `Scale: Per ${q.scale}` : '')
				)
				d.dom.term_summmary_div.html(
					`${q.totalCount.included} sample included.` +
						(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded.` : '')
				)
			} else if (d.term.term.type == 'categorical' || d.term.term.type == 'condition') {
				const gs = d.term.q.groupsetting || {}
				// d.values is already set by self.setActiveValues() above
				const term_text = 'Use as ' + Object.keys(d.values).length + (gs.inuse ? ' groups.' : ' categories.')
				make_values_table(d)
				const summary_text =
					` ${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
				d.dom.term_info_div.html(term_text)
				d.dom.ref_click_prompt
					.style('padding', '5px 10px')
					.style('color', '#999')
					.style('text-transform', 'uppercase')
					.style('font-size', '.7em')
					.text('Click to set a row as reference.')
				d.dom.term_summmary_div.text(summary_text)
			}
		} else if (d.section.configKey == 'term') {
			if (d.term.term.type == 'float' || d.term.term.type == 'integer') make_values_table(d)
			d.dom.term_summmary_div.text(
				`${q.totalCount.included} sample included.` +
					(q.totalCount.excluded ? ` ${q.totalCount.excluded} samples excluded:` : '')
			)
			// QUICK FIX: hide top_info_div rightnow for linear regression,
			// for logistic regression, it needs to be changed as required
			d.dom.top_info_div.style('display', 'none')
		}
		if (d.excludeCounts.length) {
			make_values_table(d, true)
		} else {
			d.dom.excluded_table.selectAll('*').remove()
		}
		// hide loading.. text for categories after table is rendered
		d.dom.loading_div.style('display', 'none')
	}

	function make_values_table(d, excluded) {
		const sortFxn =
			d.orderedLabels && d.orderedLabels.length
				? (a, b) => d.orderedLabels.indexOf(a.label) - d.orderedLabels.indexOf(b.label)
				: (a, b) => b.samplecount - a.samplecount
		const tr_data = excluded ? d.excludeCounts.sort(sortFxn) : d.sampleCounts.sort(sortFxn)

		if (!excluded) {
			const maxCount = Math.max(...tr_data.map(v => v.samplecount), 0)
			tr_data.forEach(v => (v.bar_width_frac = (1 - (maxCount - v.samplecount) / maxCount).toFixed(4)))
			if (!('refGrp' in d) && d.term.q && 'refGrp' in d.term.q) d.refGrp = d.term.q.refGrp

			if (!('refGrp' in d) || !tr_data.find(c => c.key === d.refGrp)) {
				if (d.term.id in self.refGrpByTermId && tr_data.find(c => c.key === self.refGrpByTermId[d.term.id])) {
					d.refGrp = self.refGrpByTermId[d.term.id]
				} else {
					d.refGrp = tr_data[0].key
					self.refGrpByTermId[d.term.id] = tr_data[0].key
				}
			}
		}

		const table = excluded ? d.dom.excluded_table : d.dom.values_table
		const isContinuousTerm =
			d.term && d.term.q.mode == 'continuous' && (d.term.term.type == 'float' || d.term.term.type == 'integer')

		const trs = table
			.style('margin', '10px 5px')
			.style('border-spacing', '3px')
			.style('border-collapse', 'collapse')
			.selectAll('tr')
			.data(tr_data, isContinuousTerm ? (b, i) => i : b => b.key + b.label)

		trs
			.exit()
			.transition()
			.duration(500)
			.remove()
		trs.each(trUpdate)
		trs
			.enter()
			.append('tr')
			.each(trEnter)
		//d.values_table.selectAll('tr').sort((a,b) => d.sampleCounts[b.key] - d.sampleCounts[a.key])

		// change color of excluded_table text
		if (excluded) d.dom.excluded_table.selectAll('td').style('color', '#999')
	}

	function trEnter(item) {
		const tr = select(this)
		const d = this.parentNode.__data__
		const maxBarWidth = 150

		tr.style('padding', '0 5px')
			.style('text-align', 'left')
			.style('cursor', d.term.term.type === 'integer' || d.term.term.type === 'float' ? 'default' : 'pointer')

		// sample count td
		tr.append('td')
			.style('padding', '1px 5px')
			.style('text-align', 'left')
			.style('color', 'black')
			.text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')

		// label td
		tr.append('td')
			.style('padding', '1px 5px')
			.style('text-align', 'left')
			.style('color', 'black')
			.text(item.label)

		// sample count bar td
		const bar_td = tr.append('td').style('padding', '1px 5px')

		// bar_width
		const barWidth = maxBarWidth * item.bar_width_frac
		bar_td
			.append('div')
			.style('margin', '1px 10px')
			.style('width', barWidth + 'px')
			.style('height', '15px')
			.style('background-color', '#ddd')

		addTrBehavior({ d, item, tr, rendered: false })
	}

	function trUpdate(item) {
		const pillData = this.parentNode.__data__
		select(this.firstChild).text(item.samplecount !== undefined ? 'n=' + item.samplecount : '')
		select(this.firstChild.nextSibling).text(item.label)
		let rendered = true
		if ((pillData.term.q.mode == 'discrete' || pillData.term.q.mode == 'binary') && this.childNodes.length < 4) rendered = false
		addTrBehavior({ d: pillData, item, tr: select(this), rendered })
	}

	function addTrBehavior(args) {
		const { d, item, tr, rendered } = args
		// don't add tr effects for excluded values
		if (!item.bar_width_frac) return

		const hover_flag = (d.term.term.type !== 'integer' && d.term.term.type !== 'float') || d.term.q.mode == 'discrete' || d.term.q.mode == 'binary'
		let ref_text

		if (rendered) {
			tr.style('background', 'white')
			ref_text = select(tr.node().lastChild)
				.select('div')
				.style('display', item.key === d.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('border', item.key === d.refGrp && hover_flag ? '1px solid #bbb' : '')
		} else {
			const reference_td = tr
				.append('td')
				.style('padding', '1px 5px')
				.style('text-align', 'left')

			ref_text = reference_td
				.append('div')
				.style('display', item.key === d.refGrp && hover_flag ? 'inline-block' : 'none')
				.style('padding', '2px 10px')
				.style('border', item.key === d.refGrp && hover_flag ? '1px solid #bbb' : '')
				.style('border-radius', '10px')
				.style('color', '#999')
				.style('font-size', '.7em')
				.text('REFERENCE')
		}

		if (hover_flag) {
			tr.on('mouseover', () => {
				if (d.refGrp !== item.key) {
					tr.style('background', '#fff6dc')
					ref_text
						.style('display', 'inline-block')
						.style('border', '')
						.text('Set as reference')
				} else tr.style('background', 'white')
			})
				.on('mouseout', () => {
					tr.style('background', 'white')
					if (d.refGrp !== item.key) ref_text.style('display', 'none')
				})
				.on('click', () => {
					d.refGrp = item.key
					self.refGrpByTermId[d.term.id] = item.key
					//d.term.q.refGrp = item.key
					ref_text.style('border', '1px solid #bbb').text('REFERENCE')
					make_values_table(d)
				})
		} else {
			tr.on('mouseover', () => {})
				.on('mouseout', () => {})
				.on('click', () => {})
		}
	}

	self.updateBtns = chartRendered => {
		const hasOutcomeTerm = self.sections.filter(s => s.configKey == 'term' && s.selected.length).length
		const hasIndependetTerm = self.sections.filter(s => s.configKey == 'independent' && s.selected.length).length
		const hasBothTerms = hasOutcomeTerm && hasIndependetTerm
		self.dom.submitBtn.style('display', hasBothTerms ? 'block' : 'none')

		if (chartRendered) {
			self.dom.submitBtn.property('disabled', false).html('Run analysis')
		}
	}
}

function setInteractivity(self) {
	self.editConfig = async (d, term) => {
		const c = self.config
		const key = d.section.configKey
		if (term && term.term && !('id' in term)) term.id = term.term.id
		// edit section data
		if (Array.isArray(c[key])) {
			if (!d.term) {
				if (term) c[key].push(term)
			} else {
				const i = c[key].findIndex(t => t.id === d.term.id)
				if (term) c[key][i] = term
				else c[key].splice(i, 1)
			}
		} else {
			if (term) c[key] = term
			//else delete c[key]
		}

		// edit pill data and tracker
		if (term) {
			delete d.section.items[d.term && d.term.id]
			d.section.items[term.id] = d
			d.term = term
		} // if (!term), do not delete d.term, so that it'll get handled in pillDiv.exit()

		self.render()
	}

	self.submit = () => {
		const config = JSON.parse(JSON.stringify(self.config))
		// console.log(config)
		//delete config.settings
		for (const term of config.independent) {
			term.q.refGrp = term.id in self.refGrpByTermId ? self.refGrpByTermId[term.id] : 'NA'
		}
		// disable submit button on click, reenable after rendering results
		self.dom.submitBtn.property('disabled', true).html('Running...')
		self.app.dispatch({
			type: config.term ? 'plot_edit' : 'plot_show',
			id: self.id,
			chartType: 'regression',
			config
		})
	}
}

export const regressionUIInit = getCompInit(MassRegressionUI)
