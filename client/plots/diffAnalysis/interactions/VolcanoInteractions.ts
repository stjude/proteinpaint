import type { MassAppApi } from '#mass/types/mass'
import { downloadTable, GeneSetEditUI } from '#dom'
import { to_svg } from '#src/client'
import type { DiffAnalysisPlotConfig } from '../DiffAnalysisTypes'

/** TODO:
 * 	- fix/add types
 */
export class VolcanoInteractions {
	app: MassAppApi
	dom: any
	id: string
	pValueTableData: any
	constructor(app: MassAppApi, id: string, dom: any) {
		this.app = app
		this.dom = dom
		this.id = id
		this.pValueTableData = []
	}

	/** Launches a multi-term select tree
	 * On submit, dispatches a plot_edit action with the new confounders */
	async confoundersMenu() {
		console.log('TODO: Server request does not support infinite confounders')
		return
		// const termdb = await import('#termdb/app')
		// await termdb.appInit({
		// 	holder: this.dom.tip.d.append('div').style('padding', '5px'),
		// 	vocabApi: this.app.vocabApi,
		// 	state: {
		// 		dslabel: this.app.vocabApi.opts.state.vocab.dslabel,
		// 		genome: this.app.vocabApi.opts.state.vocab.genome
		// 	},
		// 	tree: {
		// 		submit_lst: (terms: any) => {
		// 			this.app.dispatch({
		// 				type: 'plot_edit',
		// 				id: this.id
		// 				//TODO: server request does not support infinite confounders
		// 			})
		// 		}
		// 	}
		// })
	}

	clearDom() {
		this.dom.holder.selectAll('div[id="sjpp-volcano-actions"]').remove()
		this.dom.holder.selectAll('svg[id="sjpp-volcano-svg"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-stats"]').remove()
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
		const config = this.app.getState().plots.find((p: DiffAnalysisPlotConfig) => p.id === this.id)
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
						type: 'geneExpression' //eventually type will come from state
					}
				},
				term2: {
					//eventually will come from state. This is a work around
					q: { groups: config.samplelst.groups, type: 'custom-samplelst' },
					term: {
						name: `${config.samplelst.groups[0].name} vs ${config.samplelst.groups[1].name}`,
						type: 'samplelst',
						values
					}
				}
			}
		})
	}

	/** TODO: show unavailable genes greyed out with message to user. */
	launchGeneSetEdit() {
		const plotConfig = this.app.getState().plots.find((p: DiffAnalysisPlotConfig) => p.id === this.id)
		const holder = this.dom.tip.d.append('div').style('padding', '5px') as any
		new GeneSetEditUI({
			holder,
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			geneList: plotConfig.highlightData,
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
