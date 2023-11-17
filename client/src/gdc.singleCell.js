import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { renderTable } from '#dom/table'

/*
a UI to list aliquots with scrnaseq data from current cohort
user selects one file, and show the tsne/umap/pca plots of that experiment

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

*/

// hardcoded parameter values. required by route
const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

// list of columns to show in MAF file table
const columns = [{ label: 'Case' }, { label: 'Project' }, { label: 'Samples' }, { label: 'File Size' }]

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
	wait.remove()

	// render
	const rows = []
	for (const f of result.samples) {
		const row = [
			{ value: f.case_submitter_id },
			{ value: f.project_id },
			{
				html: f.sample_types
					.map(i => {
						return (
							'<span class="sja_mcdot" style="padding:1px 8px;background:#ddd;color:black;white-space:nowrap">' +
							i +
							'</span>'
						)
					})
					.join(' ')
			},
			{ value: fileSize(f.file_size), url: 'https://portal.gdc.cancer.gov/files/' + f.id }
		]
		rows.push(row)
	}
	renderTable({
		rows,
		columns,
		resize: true,
		div: obj.tableDiv.append('div'),
		selectAll: true,
		buttons: [
			{
				text: 'Aggregate selected MAF files and download',
				callback: submitSelectedFiles
			}
		]
	})

	async function submitSelectedFiles(lst, button) {
		const fileIdLst = []
		for (const i of lst) {
			fileIdLst.push(result.files[i].id)
		}
		if (fileIdLst.length == 0) return
		const oldText = button.innerHTML
		button.innerHTML = 'Loading... Please wait'
		button.disabled = true

		// may disable the "Aggregate" button here and re-enable later

		let data
		try {
			data = await dofetch3('gdc/mafBuild', { body: { fileIdLst } })
			if (data.error) throw data.error
		} catch (e) {
			sayerror(obj.errDiv, e)
			button.innerHTML = oldText
			button.disabled = false

			return
		}

		button.innerHTML = oldText
		button.disabled = false

		// download the file to client
		const a = document.createElement('a')
		a.href = URL.createObjectURL(data)
		a.download = 'cohort.maf.gz'
		a.style.display = 'none'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}
}
