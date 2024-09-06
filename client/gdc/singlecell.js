import { dofetch3 } from '#common/dofetch'
import { sayerror } from '../dom/sayerror.ts'
import { renderTable } from '../dom/table.ts'
import { appInit } from '#plots/plot.app.js'

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
		genome: genomes[gdcGenome]
	})
	const api = {
		update: async ({ filter0 }) => {
			holder.selectAll('*').remove()
			const obj = {
				// old habit of wrapping everything
				errDiv: holder.append('div'),
				controlDiv: holder.append('div'),
				tableDiv: holder.append('div'),
				opts: {
					filter0,
					experimentalStrategy: 'WXS'
				}
			}
			makeControls(obj)
			await getFilesAndShowTable(obj)
			// if (typeof callbacks?.postRender == 'function') {
			// 	callbacks.postRender(publicApi)
			// }
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
		div: obj.tableDiv.append('div'),
		singleMode: true,
		noButtonCallback: index => {
			submitSelectedFile(rowid2gdcfileid[index], obj)
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
