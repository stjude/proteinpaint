import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { termsettingInit } from '../common/termsetting'
import { getTermSelectionSequence } from './charts'
import { dofetch3 } from '../client'
import { getNormalRoot } from '../common/filter'

class MassRegressionUI {
	constructor(opts) {
		this.type = 'regressionUI'
		this.termSequence = getTermSelectionSequence('regression')
		setInteractivity(this)
		setRenderers(this)
	}

	async init() {
		this.dom = {
			div: this.opts.holder.style('margin', '10px 0px').style('margin-left', '-50px'),
			controls: this.opts.holder
				.append('div')
				.attr('class', 'pp-termdb-plot-controls')
				.style('display', 'block')
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
		if (action.type == 'plot_prep') {
			return action.id === this.id
		}
		if (action.type == 'app_refresh') return true
	}

	main() {
		this.config = copyMerge('{}', this.state.config)
		if (!this.dom.submitBtn) this.initUI()
	}
}

function setInteractivity(self) {}

function setRenderers(self) {
	self.initUI = () => {
		const config = self.config
		const dom = {
			body: self.dom.controls.append('div'),
			foot: self.dom.controls.append('div')
		}
		const disable_terms = []
		dom.body
			.selectAll('div')
			.data(self.termSequence || [])
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
				if (d.limit > 1 && config[d.detail] && config[d.detail].length) {
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
				for (const t of self.termSequence) {
					config[t.detail] = t.selected
					if ('cutoff' in t) config.cutoff = t.cutoff
				}
				self.app.dispatch({
					type: config.term ? 'plot_edit' : 'plot_show',
					id: self.id,
					chartType: config.chartType || (self.opts.config && self.opts.config.chartType) || 'regression',
					config
				})
			})

		self.updateBtns()
	}

	self.newPill = async function(d, config, div, pills, disable_terms, term = null) {
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
			vocab: self.state.vocab,
			activeCohort: self.state.activeCohort,
			use_bins_less: true,
			debug: self.opts.debug,
			showFullMenu: true, // to show edit/replace/remove menu upon clicking pill
			usecase: { target: config.chartType, detail: d.detail },
			disable_terms,
			callback: async term => {
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
					self.updateBtns()
					if (config.regressionType == 'logistic') cutoffDiv.style('display', 'none')
					termInfoDiv.style('display', 'none')
				} else {
					if (!disable_terms.includes(term.term.id)) {
						disable_terms.push(term.term.id)
					}
					pill.main(term)
                    term.id = term.term.id
                    await updateValueCount(term)
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
					self.updateBtns()
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
			.style('display', 'block')
			.style('margin', '10px')
			.style('font-size', '.8em')
			.style('text-align', 'left')
			.style('color', '#999')

        if (term) await updateValueCount(term)
		updateTermInfoDiv(term)

        async function updateValueCount(term){
            // query backend for total sample count for each value of categorical or condition terms
            // and included and excluded sample count for nuemric term
            const q = JSON.parse(JSON.stringify(term.q))
            if (term.q.values) delete q.values
            const url =
                '/termdb-barsql?' +
                'term1_id=' + 
                term.id +
                '&term1_q=' +
                encodeURIComponent(JSON.stringify(q)) +
                '&filter=' +
                encodeURIComponent(JSON.stringify(getNormalRoot(self.state.termfilter.filter))) +
                '&genome=' +
                self.state.vocab.genome +
                '&dslabel=' +
                self.state.vocab.dslabel
            const data = await dofetch3(url, {}, self.app.opts.fetchOpts)
            if (data.error) throw data.error
            if (term.term.type == 'categorical' || term.term.type == 'condition') {
                // add sample count data as q.values[].count (supports groupsetting)
                const values = term.q.groupsetting && term.q.groupsetting.inuse ?
                ( term.q.groupsetting.predefined_groupset_idx !== undefined ?
                    JSON.parse(JSON.stringify(term.term.groupsetting.lst[term.q.groupsetting.predefined_groupset_idx].groups)) :
                    JSON.parse(JSON.stringify(term.q.groupsetting.customset.groups)) ) :
                JSON.parse(JSON.stringify(term.term.values))
                const label_key = term.q.groupsetting && term.q.groupsetting.inuse ? 'name' : 'label'
                const count_values = data.charts[0].serieses
                for (const key in values){
                    let count_data
                    if (term.q.groupsetting.inuse || term.term.type == 'condition') 
                        count_data = count_values.find(v => v.seriesId == values[key][label_key])
                    else if (term.term.type == 'categorical')
                        count_data = count_values.find(v => v.seriesId == key)
                    values[key].count = count_data && count_data.total ? count_data.total : 0
                }
                term.q.values = values
            } else {
                // add included and excluded sample count as term.q.count: { included: n, excluded: n }
                const values = term.term.values || {}
                term.q.count = { included: 0, excluded: 0 }
                const count_values = data.charts[0].serieses
                for(const count of count_values){
                    if (Object.values(values).findIndex(v => v.label == count.seriesId) == -1)
                        term.q.count.included = term.q.count.included + count.total
                    else
                        term.q.count.excluded = term.q.count.excluded + count.total
                }
            }
        }

		function updateTermInfoDiv(term_) {
			termInfoDiv.selectAll('*').remove()
			const term_summmary_div = termInfoDiv.append('div')
			const term_values_div = termInfoDiv.append('div')
			const values_table = term_values_div.append('table')
			const q = (term_ && term_.q) || {}
			if (d.detail == 'independent' && term_ && term_.term) {
				if (term_.term.type == 'float' || term_.term.type == 'integer'){
                    term_summmary_div.html(
                        `Use as ${q.use_as || 'continuous'} vairable. </br>
                        ${q.count.included} sample included.` +
                        ( q.count.excluded ? ` ${q.count.excluded} samples excluded.` : '' )
                    )
                }
				else if (term_.term.type == 'categorical' || term_.term.type == 'condition') {
					let text
					if (q.groupsetting && q.groupsetting.inuse) {
                        const values = term_.q.values !== undefined ? term_.q.values : term_.q.groupsetting.customset.groups
						text = Object.keys(values).length + ' groups'
						make_values_table({ term: term_, values, values_table, key: 'name' })
					} else {
                        const values = term_.q.values !== undefined ? term_.q.values : term_.term.values
						text =
							Object.keys(term_.term.values).length + (term_.term.type == 'categorical' ? ' categories' : ' grades')
						make_values_table({ term: term_, values, values_table, key: 'label' })
					}
					term_summmary_div.text(text)
				}
			} else if (term_ && term_.term) {
                if (term_.term.type == 'float' || term_.term.type == 'integer') 
                    term_summmary_div.text( 
                        `${q.count.included} sample included.` +
                        (q.count.excluded ? ` ${q.count.excluded} samples excluded.` : '')
                    )
            }
		}

		function make_values_table(args) {
			const { term, values, values_table, key } = args
            const values_array = Object.values(values)
			values_table
				.style('margin', '10px 5px')
				.style('border-spacing', '3px')
				.style('border-collapse', 'collapse')

			const tr_data = term.term.type == 'condition' || values_array[0].count == undefined 
                ? values_array
                : values_array.sort((a,b)=> b.count - a.count)
			tr_data[0].refGrp = true

			function updateTable() {
                const refGrp = tr_data.find(v => v.refGrp == true)
                if (term.q.groupsetting.inuse) term.q.refGrp = refGrp[key]
                else term.q.refGrp = Object.keys(values).find(k => values[k][key] == refGrp[key])
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
							const ref_value = tr_data.find(v => v.refGrp == true)
							delete ref_value.refGrp
							value.refGrp = true
							ref_text.style('display', 'inline-block')
							updateTable()
						})

					tr.append('td')
						.style('padding', '3px 5px')
						.style('text-align', 'left')
						.style('color', 'black')
						.html((value.count !== undefined 
                                ? `<span style='display: inline-block;width: 70px;'>n= ${value.count} </span>`
                                : '') 
                            +  value[key]
                        )

					const reference_td = tr
						.append('td')
						.style('padding', '3px 5px')
						.style('text-align', 'left')

					const ref_text = reference_td
						.append('div')
						.style('display', value.refGrp ? 'inline-block' : 'none')
						.style('padding', '2px 10px')
						.style('border', '1px solid #bbb')
						.style('border-radius', '10px')
						.style('color', '#999')
						.style('font-size', '.7em')
						.text('REFERENCE')
				}

				function trUpdate(value) {
					const tr = select(this)
					tr.select('div').style('display', value.refGrp ? 'inline-block' : 'none')
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

	self.updateBtns = () => {
		const hasMissingTerms = self.termSequence.filter(t => !t.selected || (t.limit > 1 && !t.selected.length)).length > 0
		self.dom.submitBtn.property('disabled', hasMissingTerms)
	}
}

export const regressionUIInit = getCompInit(MassRegressionUI)
