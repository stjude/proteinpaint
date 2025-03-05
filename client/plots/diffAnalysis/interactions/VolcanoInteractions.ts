import type { MassAppApi } from '#mass/types/mass'
import { downloadTable, GeneSetEditUI, Menu, MultiTermWrapperEditUI } from '#dom'
import { to_svg } from '#src/client'
import type { VolcanoPlotConfig } from '../VolcanoTypes'

/** TODO:
 * 	- fix/add types
 */
export class VolcanoInteractions {
	app: MassAppApi
	dom: any
	id: string
	pValueTableData: any
	data: any
	constructor(app: MassAppApi, id: string, dom: any) {
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
		const menu = new Menu({ padding: '' }) as unknown as any
		const ui = new MultiTermWrapperEditUI({
			app: this.app,
			callback: async tws => {
				menu.hide()
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { confounderTws: tws }
				})
			},
			holder: menu.d,
			headerText: 'Select confounders',
			maxNum: 2,
			state,
			twList: config.confounderTws
		})
		await ui.renderUI()
	}

	clearDom() {
		this.dom.holder.selectAll('div[id="sjpp-volcano-actions"]').remove()
		this.dom.holder.selectAll('svg[id="sjpp-volcano-svg"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-stats"]').remove()
		this.dom.error.selectAll('*').remove()
	}

	download() {
		this.dom.tip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.holder.select('svg').node() as Node
					//TODO: add title to svg based on config
					to_svg(svg, `Differential analysis volcano`, { apply_dom_styles: true })
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
			this.dom.tip.d.append('div').attr('class', 'sja_menuoption').text(opt.text).on('click', opt.callback)
		}
	}

	async launchBoxPlot(geneSymbol: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const values = {}
		for (const group of config.samplelst.groups) {
			values[group.name] = {
				key: group.name,
				label: group.name,
				list: group.values
			}
		}
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'boxplot',
				term: {
					q: { mode: 'continuous' },
					term: {
						gene: geneSymbol,
						name: geneSymbol,
						type: config.termType
					}
				},
				term2: {
					q: { groups: config.tw.q.groups, type: 'custom-samplelst' },
					term: config.tw.term
				}
			}
		})
	}

	/** TODO: show unavailable genes greyed out with message to user. */
	launchGeneSetEdit() {
		const plotConfig = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const holder = this.dom.tip.d.append('div').style('padding', '5px') as any
		const limitedGenesList = this.data.map(d => d.gene_symbol)
		new GeneSetEditUI({
			holder,
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			limitedGenesList,
			geneList: plotConfig.highlightedData.map(d => {
				return { gene: d } //Formatted to Gene type in GeneSetEditUI
			}),
			callback: async result => {
				const highlightedData = result.geneList.map(d => d.gene)
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { highlightedData }
				})
				this.dom.tip.hide()
			}
		})
	}
}
