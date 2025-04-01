import type { MassAppApi } from '#mass/types/mass'
import { downloadTable, GeneSetEditUI, MultiTermWrapperEditUI, sayerror } from '#dom'
import { to_svg } from '#src/client'
import { isDictionaryType } from '#shared/terms.js'
import type { VolcanoDom, VolcanoPlotConfig } from '../VolcanoTypes'

export class VolcanoInteractions {
	app: MassAppApi
	dom: VolcanoDom
	id: string
	pValueTableData: any
	data: any
	constructor(app: MassAppApi, id: string, dom: VolcanoDom) {
		this.app = app
		this.dom = dom
		this.id = id
		this.pValueTableData = []
		this.data = []
	}

	/** Launches a multi-term select tree
	 * On submit, dispatches a plot_edit action with the new confounders */
	async confoundersMenu() {
		const state = this.app.getState()
		const config = state.plots.find((p: VolcanoPlotConfig) => p.id === this.id)

		/** Find terms used to create the groups and disable in the
		 * termsetting UI. Prevents users from trying to control for
		 * variables used to create the groups.*/
		const allowedGroupNames = new Set([config.samplelst.groups[0].name, config.samplelst.groups[1].name])
		const grpTerms: Set<string> = new Set(
			(this.app?.vocabApi?.state.groups || [])
				.filter(g => allowedGroupNames.has(g.name))
				.flatMap(g =>
					g.filter.lst.flatMap(f => {
						if (f.tvs?.term) return f.tvs.term
						else return f.lst.map(l => l.tvs.term)
					})
				)
		)
		const disable_terms: any[] = grpTerms.size ? Array.from(grpTerms) : []
		const maxNum = 2

		const ui = new MultiTermWrapperEditUI({
			app: this.app,
			allowFilter: true,
			callback: async (tws: any) => {
				this.dom.actionsTip.hide()

				// let categoryNum = 0
				// for (const tw of tws) {
				// 	if (!isDictionaryType(tw.term)) continue
				// 	const x = await this.app.vocabApi.getCategories(tw.term, state.termfilter.filter)
				// 	if (x.length) categoryNum += x.length
				// }
				// if ((categoryNum * this.getSampleNum(config) > 3000)) {
				// 	sayerror(this.dom.error, 'Too many term categories. Please select fewer categories.')
				// }

				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { confounderTws: tws }
				})
			},
			holder: this.dom.actionsTip.d as any,
			headerText: 'Select confounders',
			maxNum,
			state,
			twList: config.confounderTws,
			disable_terms
		})
		await ui.renderUI()
	}

	clearDom() {
		this.dom.holder.selectAll('div[id="sjpp-volcano-actions"]').remove()
		this.dom.holder.selectAll('svg[id="sjpp-volcano-svg"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-stats"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-pValueTable"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-images"]').remove()
		this.dom.error.selectAll('*').remove()
	}

	download(termType: string) {
		this.dom.actionsTip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.holder.select('svg').node() as Node
					to_svg(svg, `Differential ${termType} analysis volcano`, { apply_dom_styles: true })
				}
			},
			{
				text: 'Download p value table',
				callback: () => {
					downloadTable(this.pValueTableData.rows, this.pValueTableData.columns)
				}
			}
		]
		for (const opt of opts) {
			this.dom.actionsTip.d.append('div').attr('class', 'sja_menuoption').text(opt.text).on('click', opt.callback)
		}
	}

	getSampleNum(config: VolcanoPlotConfig) {
		return config.samplelst.groups.reduce((sum: number, g: any) => sum + g.values.length, 0)
	}

	async highlightDataPoint(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const highlightedData = config.highlightedData.includes(value)
			? config.highlightedData.filter(d => d !== value)
			: [...config.highlightedData, value]
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { highlightedData }
		})
	}

	/** When clicking on a data point, launches the box plot in a separate sandbox
	 * For geneExpression, value == gene symbol */
	async launchBoxPlot(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const values = {}
		for (const group of config.samplelst.groups) {
			values[group.name] = {
				key: group.name,
				label: group.name,
				list: group.values
			}
		}
		/** Gene variant and expression terms do not have an id
		 * need to be handled separately.
		 * TODO: In the future with more use cases, simplify this logic. */
		const setTerm = () => {
			if (config.termType == 'geneExpression') {
				return {
					q: { mode: 'continuous' },
					term: {
						gene: value,
						name: value,
						type: config.termType
					}
				}
			} else return config.term
		}
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'boxplot',
				term: setTerm(),
				term2: {
					q: { groups: config.tw.q.groups, type: 'custom-samplelst' },
					term: config.tw.term
				}
			}
		})
	}

	launchGeneSetEdit() {
		const plotConfig = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const holder = this.dom.actionsTip.d.append('div').style('padding', '5px') as any
		const limitedGenesList = this.data.map(d => d.gene_symbol)
		new GeneSetEditUI({
			holder,
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			limitedGenesList,
			geneList: plotConfig.highlightedData.map(d => {
				return { gene: d } //Formatted to Gene type in GeneSetEditUI
			}),
			customInputs: [
				{
					label: 'Cancel highlight',
					getDisplayStyle: () => (plotConfig.highlightedData.length > 0 ? '' : 'none'),
					showInput: async () => {
						await this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: { highlightedData: [] }
						})
						this.dom.actionsTip.hide()
					}
				}
			],
			callback: async result => {
				const highlightedData = result.geneList.map(d => d.gene)
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { highlightedData }
				})
				this.dom.actionsTip.hide()
			}
		})
	}
}
