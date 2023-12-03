import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { renderTable } from '#dom/table'

/*
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
		for (const f of sample.files) {
			const row = [
				{ value: sample.sample },
				{ value: sample.projectId },
				{ value: sample.primarySite },
				{ value: sample.diseaseType },
				{ value: f.sampleType }
			]
			rows.push(row)
			rowid2gdcfileid.push(f.fileId)
		}
	}
	renderTable({
		rows,
		columns,
		resize: true,
		div: obj.tableDiv.append('div'),
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
		const body = { genome: gdcGenome, dslabel: gdcDslabel, sample: fileId }
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
