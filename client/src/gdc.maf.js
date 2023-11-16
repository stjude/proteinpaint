import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { renderTable } from '#dom/table'
import { make_radios } from '#dom/radiobutton'
import { fileSize } from '#shared/fileSize'

/*
a UI to list open-access maf files from current cohort
let user selects some, for the backend to generate an aggregated maf file and download to user

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

*/

// list of columns to show in MAF file table
const columns = [{ label: 'Case' }, { label: 'Project' }, { label: 'Samples' }, { label: 'File Size' }]

export async function gdcMAFui({ holder, filter0, callbackOnRender, debugmode = false }) {
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
			filter0,
			experimentalStrategy: 'WXS'
		}
	}
	makeControls(obj)
	await getFilesAndShowTable(obj)

	return publicApi // ?
}

function makeControls(obj) {
	const table = obj.controlDiv.append('table')
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.5).text('Access')
		tr.append('td').text('Open')
	}
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.5).text('Workflow Type')
		tr.append('td').text('Aliquot Ensemble Somatic Variant Merging and Masking')
	}
	{
		const tr = table.append('tr')
		tr.append('td').style('opacity', 0.5).text('Experimental Strategy')
		const td = tr.append('td')
		make_radios({
			holder: td,
			options: [
				{ label: 'WXS', value: 'WXS', checked: obj.opts.experimentalStrategy == 'WXS' },
				{
					label: 'Targeted Sequencing',
					value: 'Targeted Sequencing',
					checked: obj.opts.experimentalStrategy == 'Targeted Sequencing'
				}
			],
			styles: { display: 'inline' },
			callback: async value => {
				obj.opts.experimentalStrategy = value
				await getFilesAndShowTable(obj)
			}
		})
	}
}

async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').text('Loading...')

	let result
	{
		const body = {
			experimentalStrategy: obj.opts.experimentalStrategy
		}
		if (obj.opts.filter0) body.filter0 = obj.opts.filter0
		try {
			result = await dofetch3('gdc/maf', { body })
			if (result.error) throw result.error
		} catch (e) {
			wait.remove()
			sayerror(obj.errDiv, e)
			return
		}
	}
	wait.remove()

	// render
	{
		const row = obj.tableDiv.append('div').style('margin', '20px')
		if (result.filesTotal > result.files.length) {
			row.append('div').text(`Showing first ${result.files.length} files out of ${result.filesTotal} total.`)
		} else {
			row.append('div').text(`Showing ${result.files.length} files.`)
		}
	}

	const rows = []
	for (const f of result.files) {
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
				onChange: updateButtonBySelectionChange,
				callback: submitSelectedFiles
			}
		]
	})

	function updateButtonBySelectionChange(lst, button) {
		let sum = 0
		for (const i of lst) sum += result.files[i].file_size
		if (sum == 0) {
			button.innerHTML = 'No file selected'
			button.disabled = true
			return
		}
		button.disabled = false
		button.innerHTML =
			sum < result.maxTotalSizeCompressed
				? `Download ${fileSize(sum)} compressed MAF data`
				: `Download ${fileSize(result.maxTotalSizeCompressed)} compressed MAF data (${fileSize(sum)} selected)`
	}

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
