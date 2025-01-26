import { dofetch3 } from '#common/dofetch'
import { sayerror, renderTable, newSandboxDiv } from '#dom'
import { appInit } from '#plots/plot.app.js'
import { select } from 'd3-selection'
import { copyMerge } from '#rx'

/*
gdc launcher to get the scrna UI

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

may later refactor into a mass app, to support same purpose from non-gdc datasets
*/

// hardcoded parameter values. required by route
const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

// list of columns to show in file table
const columns = [
	{ label: 'Case' },
	{ label: 'Project' },
	{ label: 'Primary Site' },
	{ label: 'Disease Type' },
	{ label: 'Sample Type' }
]

export async function init(arg, holder, genomes) {
	const plotAppApi = await appInit({
		holder,
		state: {
			genome: gdcGenome,
			dslabel: gdcDslabel,
			termfilter: { filter0: arg.filter0 },
			plots: [{ chartType: 'singleCellPlot' }]
		},
		noheader: true,
		nobox: true,
		hide_dsHandles: true,
		genome: genomes[gdcGenome],
		app: copyMerge(
			{
				getPlotHolder: (plot, div) => {
					if (plot.chartType == 'gsea') {
						const sandbox = newSandboxDiv(select(div.select(`#${plot.insertBefore}`).node().parentNode), {
							close: () => {
								plotAppApi.dispatch({
									type: 'plot_delete',
									id: plot.id
								})
							},
							plotId: plot.id,
							beforePlotId: plot.insertBefore || null,
							style: {
								width: '98.5%'
							}
						})
						sandbox.header.text('GENE SET ENRICHMENT ANALYSIS')
						return sandbox.body.style('white-space', 'nowrap')
					} else {
						return div.append('div')
					}
				}
			},
			arg.opts?.app || {}
		),
		singleCellPlot: arg.opts?.singleCell || {}
	})
	const api = {
		update: async updateArg => {
			if ('filter0' in updateArg) {
				// the table and plots will need to be updated
				//holder.selectAll('*').remove()

				plotAppApi.dispatch({
					type: 'app_refresh',
					subactions: [
						{
							type: 'filter_replace',
							filter0: updateArg.filter0
						},
						{
							type: 'plot_edit',
							id: plotAppApi.getState().plots[0].id,
							config: { sample: undefined }
						}
					]
				})
			} else {
				console.log(75, plotAppApi)
				// the plots may change, but the table should not change
				plotAppApi.dispatch({
					type: 'plot_edit',
					id: plotAppApi.getState().plots[0].id,
					config: updateArg
				})
			}
		}
	}
	return api
}
