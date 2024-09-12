import { dofetch3 } from '#common/dofetch'
import { sayerror } from '../dom/sayerror.ts'
import { renderTable } from '../dom/table.ts'
import { appInit } from '#plots/plot.app.js'
import { newSandboxDiv } from '../dom/sandbox.ts'
import { select } from 'd3-selection'
import { copyMerge } from '#rx'

/*
FIXME unfinished! change into calling mass ui as other launchers, and api supplies a callback


a UI to list aliquots with scrnaseq data from current cohort
user selects one file, and show the tsne/umap/pca plots of that experiment

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

				// const obj = {
				// 	// old habit of wrapping everything
				// 	errDiv: holder.append('div'),
				// 	controlDiv: holder.append('div'),
				// 	tableDiv: holder.append('div'),
				// 	opts: {
				// 		filter0: updateArg.filter0,
				// 		experimentalStrategy: 'WXS'
				// 	},
				// 	api
				// }
				// makeControls(obj)
				// await getFilesAndShowTable(obj); console.log(70, arg, updateArg)
				// if (typeof callbacks?.postRender == 'function') {
				// 	callbacks.postRender(publicApi)
				// }
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

export async function gdcSinglecellUi({ holder, filter0, callbackOnRender, debugmode = false }) {
	// public api obj to be returned
	const publicApi = {}

	if (typeof callbackOnRender == 'function') {
		// ?
		callbackOnRender(publicApi)
	}

	const obj = {
		// old habit of wrapping everything
		errDiv: holder.append('div'),
		controlDiv: holder.append('div'),
		tableDiv: holder.append('div'),
		opts: {
			filter0
		}
	}
	makeControls(obj)
	await getFilesAndShowTable(obj)

	return publicApi // ?
}

function makeControls(obj) {
	// may add control later
	// on change, call await getFilesAndShowTable(obj)
}

async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').text('Loading...')

	let result
	{
		const body = { genome: gdcGenome, dslabel: gdcDslabel }
		if (obj.opts.filter0) body.filter0 = obj.opts.filter0
		try {
			result = await dofetch3('termdb/singlecellSamples', { body })
			if (result.error) throw result.error
		} catch (e) {
			wait.remove()
			sayerror(obj.errDiv, e)
			return
		}
	}
	console.log(result)
	wait.remove()

	// render
	const rows = []
	const rowid2gdcfileid = []
	for (const sample of result.samples) {
		for (const f of sample.experiments) {
			const row = [
				{ value: sample.sample },
				{ value: sample['case.project.project_id'] },
				{ value: sample['case.primary_site'] },
				{ value: sample['case.disease_type'] },
				{ value: f.sampleType }
			]
			rows.push(row)
			rowid2gdcfileid.push(f.experimentID)
		}
	}
	renderTable({
		rows,
		columns,
		resize: true,
		singleMode: true,
		div: obj.tableDiv.append('div'),
		noButtonCallback: index => {
			console.log(160)
			obj.api.update({
				sample: rowid2gdcfileid[index]
			})
			//submitSelectedFile(rowid2gdcfileid[index], obj)
		}
	})
}

async function submitSelectedFile(fileId, obj) {
	obj.tableDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').text('Loading...')

	let result
	{
		const body = { genome: gdcGenome, dslabel: gdcDslabel, sample: fileId, plots: ['UMAP', 'TSNE', 'PCA'] }
		try {
			result = await dofetch3('termdb/singlecellData', { body })
			if (result.error) throw result.error
		} catch (e) {
			wait.remove()
			sayerror(obj.errDiv, e)
			return
		}
	}
	console.log(result)
	wait.remove()
}
