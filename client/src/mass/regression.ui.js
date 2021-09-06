import * as rx from '../common/rx.core'
import { select } from 'd3-selection'
import { termsettingInit } from '../common/termsetting'

class MassRegressionUI {
	constructor(app, opts) {
		this.type = 'regressionUI'
		this.id = opts.id
		this.app = app
		this.opts = opts
		this.api = rx.getComponentApi(this)
		this.dom = {
			div: this.opts.holder.style('margin', '10px 0px').style('margin-left', '-50px'),
			controls: opts.holder
				.append('div')
				.attr('class', 'pp-termdb-plot-controls')
				.style('display', 'block')
		}
		setInteractivity(this)
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
	}

	getState(appState) {
		if (!(this.id in appState.tree.plots)) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		const config = appState.tree.plots[this.id]
		return {
			isVisible: config?.settings?.currViews.includes('regression'),
			activeCohort: appState.activeCohort,
			vocab: appState.vocab,
			termfilter: appState.termfilter,
			config: {
				cutoff: config.cutoff,
				term: config.term,
				regressionType: config.regressionType,
				independent: config.independent,
				settings: {
					table: config?.settings?.regression
				}
			}
		}
	}

	reactsTo(action) {
		if (action.type == 'plot_prep') {
			return action.id === this.id
		}
		if (action.type == 'app_refresh') return true
	}

	main() {
		this.config = rx.copyMerge('{}', this.state.config)
		this.initUI()
	}
}

function setInteractivity(self) {}

function setRenderers(self) {
	self.initUI = () => {
		const config = JSON.parse(JSON.stringify(self.opts.config))
		const dom = {
			body: self.dom.controls.append('div'),
			foot: self.dom.controls.append('div')
		}
		const disable_terms = []

		dom.body
			.selectAll('div')
			.data(config.termSequence)
			.enter()
			.append('div')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')
			.each(function(d) {
				const pills = []
				const div = select(this)
				div
					.append('div')
					.style('margin', '3px 5px')
					.style('padding', '3px 5px')
					.style('font-size', '17px')
					.style('color', '#bbb')
					.text(d.label)

				if (config[d.detail]) {
					if (!d.selected) d.selected = config[d.detail]
					if (Array.isArray(d.selected)) {
						for (const t of d.selected) {
							if (!disable_terms.includes(t.id)) disable_terms.push(t.id)
						}
					} else {
						if (!disable_terms.includes(d.selected.id)) disable_terms.push(d.selected.id)
					}
				}
				if (d.limit > 1 && config?.[d.detail] && config[d.detail].length) {
					for (const term of config[d.detail]) {
						self.newPill(d, config, div, pills, disable_terms, term)
					}
				}
				self.newPill(d, config, div.append('div'), pills, disable_terms, d.limit === 1 && config[d.detail])
			})

		self.dom.submitBtn = dom.foot
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')
			.append('button')
			.html('Run analysis')
			.on('click', () => {
				// disable submit button on click, reenable after rending results
				self.dom.submitBtn.property('disabled', true)
				self.api.on('postRender.submitbtn', () => {
					self.dom.submitBtn.property('disabled', false)
					self.api.on('postRender.submitbtn', null)
				})
				for (const t of config.termSequence) {
					config[t.detail] = t.selected
					if ('cutoff' in t) config.cutoff = t.cutoff
				}
				self.app.dispatch({
					type: self.opts.config.term ? 'plot_edit' : 'plot_show',
					id: self.id,
					chartType: config.chartType,
					config
				})
			})

		self.updateBtns(config)
	}

	self.newPill = function(d, config, div, pills, disable_terms, term = null) {
		const pillsDiv = div
			.append('div')
			.style('width', 'fit-content')
			.style('margin-left', '30px')

		const newTermDiv = pillsDiv
			.append('div')
			.style('display', 'inline-block')
			.style('margin', '5px 15px')
			.style('padding', '3px 5px')
			.style('border-left', term ? '1px solid #bbb' : '')

		const pillDiv = newTermDiv.append('div')

		const pill = termsettingInit({
			placeholder: d.prompt,
			holder: pillDiv,
			vocabApi: self.app.vocabApi,
			vocab: self.state?.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			usecase: { target: config.chartType, detail: d.detail },
			disable_terms,
			callback: term => {
				if (!term) {
					const i = pills.indexOf(pill)
					if (Array.isArray(d.selected)) d.selected.splice(i, 1)
					else delete d.selected
					pills.splice(i, 1)
					disable_terms.splice(i, 1)
					if (d.limit > 1) {
						newTermDiv.remove()
					} else {
						// Quick fix: remove pill and show text to add new term
						const pill = pillDiv.select('.ts_pill').node()
						select(pill).remove()
						div.select('.sja_clbtext2').node().parentNode.style.display = 'inline-block'
						newTermDiv.style('border-left', 'none')
					}
					self.updateBtns(config)
					if (config.regressionType == 'logistic') cutoffDiv.style('display', 'none')
					termInfoDiv.style('display', 'none')
				} else {
					if (!disable_terms.includes(term.term.id)) {
						disable_terms.push(term.term.id)
					}
					pill.main(term)
					if (d.limit > 1) {
						if (!d.selected) d.selected = []
						// if term is already selected, just replace q for that d.selected[] term
						if (d.selected.length && d.selected.findIndex(t => t.id == term.term.id) !== -1) {
							const t_ = d.selected.find(t => t.id == term.term.id)
							t_.q = JSON.parse(JSON.stringify(term.q))
							// if (bins_radio.property('checked')) t_.q.use_as = 'bins'
						} else {
							d.selected.push(term)
							if (d.selected.length < d.limit) self.newPill(d, config, div, pills, disable_terms)
						}
					} else {
						d.selected = term
					}
					self.updateBtns(config)
					// show cutoffDiv only for regressionType is logistic
					if (config.regressionType == 'logistic')
						cutoffDiv.style(
							'display',
							d.cutoffTermTypes && d.cutoffTermTypes.includes(term.term.type) ? 'block' : 'none'
						)

					newTermDiv.style('border-left', '1px solid #bbb')
					termInfoDiv.style('display', 'inline-block')
					if (d.selected.length) {
						const config_term = d.selected.find(t => t.id == term.term.id)
						updateTermInfoDiv(config_term)
					} else {
						updateTermInfoDiv(term)
					}
				}
			}
		})

		pills.push(pill)
		if (term) pill.main(term)

		// show cutoffDiv only for regressionType is logistic and term in cutoffTermTypes
		let cutoffDiv
		if (config.regressionType == 'logistic') {
			cutoffDiv = pillsDiv
				.append('div')
				.style('display', term && d.cutoffTermTypes && d.cutoffTermTypes.includes(term.term.type) ? 'block' : 'none')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')

			const cutoffLabel = cutoffDiv.append('span').html('Use cutoff of ')

			const useCutoffInput = cutoffDiv
				.append('input')
				.attr('type', 'number')
				.style('width', '50px')
				.style('text-align', 'center')
				.on('change', () => {
					const value = useCutoffInput.property('value')
					if (value === '') delete d.cutoff
					else d.cutoff = Number(value)
				})
		}

		const termInfoDiv = newTermDiv
			.append('div')
			.style('display', d.detail == 'independent' && term?.term ? 'block' : 'none')
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')

		updateTermInfoDiv(term)

		function updateTermInfoDiv(term_) {
			termInfoDiv.selectAll('*').remove()
			const term_summmary_div = termInfoDiv.append('div')
			const term_values_div = termInfoDiv.append('div')
			const values_table = term_values_div.append('table')
			if (d.detail == 'independent' && term_?.term) {
				if (term_.term.type == 'float' || term_.term.type == 'integer')
					term_summmary_div.text(term_.q?.use_as ? term_.q?.use_as : 'continuous')
				else if (term_.term.type == 'categorical' || term_.term.type == 'condition') {
					let text
					if (term_.q.groupsetting?.inuse) {
						text = Object.keys(term_.q.groupsetting.customset.groups).length + ' groups'
						make_values_table({ term: term_, values: term_.q.groupsetting.customset.groups, values_table, key: 'name' })
					} else {
						text =
							Object.keys(term_.term.values).length + (term_.term.type == 'categorical' ? ' categories' : ' grades')
						make_values_table({ term: term_, values: term_.term.values, values_table, key: 'label' })
					}
					term_summmary_div.text(text)
				}
			}
		}

		function make_values_table(args) {
			const { term, values, values_table, key } = args
			values_table
				.style('margin', '10px 5px')
				.style('border-spacing', '3px')
				.style('border-collapse', 'collapse')

			const tr_data = Object.values(values)
			tr_data[0].ref_grp = true

			function updateTable() {
				const ref_i = tr_data.findIndex(v => v.ref_grp == true)
				if (term.q.groupsetting.inuse) term.q.ref_grp = values[ref_i]['name']
				else term.q.ref_grp = Object.keys(values)[ref_i]
				values_table
					.selectAll('tr')
					.data(tr_data)
					.each(trUpdate)
					.enter()
					.append('tr')
					.each(trEnter)

				function trEnter(value) {
					const tr = select(this)

					tr.style('padding', '5px 5px')
						.style('text-align', 'left')
						.style('border-bottom', 'solid 1px #ddd')
						.on('mouseover', () => tr.style('background', '#fff6dc'))
						.on('mouseout', () => tr.style('background', 'white'))
						.on('click', () => {
							const ref_value = tr_data.find(v => v.ref_grp == true)
							delete ref_value.ref_grp
							value.ref_grp = true
							ref_text.style('display', 'inline-block')
							updateTable()
						})

					tr.append('td')
						.style('padding', '3px 5px')
						.style('text-align', 'left')
						.style('color', 'black')
						.html(value[key])

					const reference_td = tr
						.append('td')
						.style('padding', '3px 5px')
						.style('text-align', 'left')

					const ref_text = reference_td
						.append('div')
						.style('display', value.ref_grp ? 'inline-block' : 'none')
						.style('padding', '2px 10px')
						.style('border', '1px solid #bbb')
						.style('border-radius', '10px')
						.style('color', '#999')
						.style('font-size', '.7em')
						.text('REFERENCE')
				}

				function trUpdate(value) {
					const tr = select(this)
					tr.select('div').style('display', value.ref_grp ? 'inline-block' : 'none')
					self.dom.submitBtn.property('disabled', false)
				}
			}

			updateTable()

			values_table
				.append('tr')
				.style('padding', '5px 5px')
				.append('td')
				.style('padding', '3px 5px')
				.style('color', '#999')
				.attr('colspan', 2)
				.text('Click on a row to mark it as reference.')
		}

		// const id = Math.random().toString()

		// const continuous_radio = termInfoDiv
		// 	.append('input')
		// 	.attr('type', 'radio')
		// 	.attr('id', 'continuous' + id)
		// 	.attr('name', 'num_type' + id)
		// 	.style('margin-left', '10px')
		// 	.property('checked', true)

		// termInfoDiv
		// 	.append('label')
		// 	.attr('for', 'continuous' + id)
		// 	.attr('class', 'sja_clbtext')
		// 	.text(' as continuous')

		// const bins_radio = termInfoDiv
		// 	.append('input')
		// 	.attr('type', 'radio')
		// 	.attr('id', 'bins' + id)
		// 	.attr('name', 'num_type' + id)
		// 	.style('margin-left', '10px')
		// 	.property('checked', null)

		// termInfoDiv
		// 	.append('label')
		// 	.attr('for', 'bins' + id)
		// 	.attr('class', 'sja_clbtext')
		// 	.text(' as bins')

		// if (term && d.detail == 'independent' && d.selected) {
		// 	const config_term = d.selected.find(t => t.id == term.id)
		// 	update_numtype_radios(config_term)
		// }

		// function update_numtype_radios(config_term) {
		// 	continuous_radio.on('change', () => {
		// 		config_term.q.use_as = 'continuous'
		// 	})

		// 	bins_radio.on('change', () => {
		// 		config_term.q.use_as = 'bins'
		// 	})
		// }
	}

	self.updateBtns = config => {
		const hasMissingTerms =
			config.termSequence.filter(t => !t.selected || (t.limit > 1 && !t.selected.length)).length > 0
		self.dom.submitBtn.property('disabled', hasMissingTerms)
	}
}

export const regressionUIInit = rx.getInitFxn(MassRegressionUI)
