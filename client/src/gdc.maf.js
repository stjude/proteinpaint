import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { renderTable } from '#dom/table'

/*
a UI to list open-access maf files from current cohort
let user selects some, for the backend to generate an aggregated maf file and download to user

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

*/

// list of columns to show in MAF file table
const columns = [
	{ label: 'Case' },
	{ label: 'Project' },
	{ label: 'Samples' },
	{ label: 'Experimental Strategy' },
	{ label: 'File Size' }
]

export async function gdcMAFui({ holder, filter0, callbackOnRender, debugmode = false }) {
	// public api obj to be returned
	const publicApi = {}

	if (typeof callbackOnRender == 'function') {
		// ?
		callbackOnRender(publicApi)
	}

	let result // for it to be accessible by submitSelectedFiles()

	try {
		result = await getFileList(filter0)

		holder.append('div').style('margin', '20px').html(`${result.skipControlled} controlled-access files skipped.<br>
				${result.skipWorkflow} files skipped for unwanted workflow type.<br>
				All files have the workflow type of "Aliquot Ensemble Somatic Variant Merging and Masking".
			`)
		const rows = []
		for (const f of result.files) {
			const row = [
				{ value: f.case_submitter_id },
				{ value: f.project_id },
				{
					html: f.sample_types
						.map(i => {
							return (
								'<span class="sja_mcdot" style="padding:1px 8px;background:grey;white-space:nowrap">' + i + '</span>'
							)
						})
						.join(' ')
				},
				{ value: f.experimental_strategy },
				{ value: f.file_size, url: 'https://portal.gdc.cancer.gov/files/' + f.id }
			]
			rows.push(row)
		}
		renderTable({
			rows,
			columns,
			resize: true,
			div: holder.append('div'),
			selectAll: true,
			buttons: [
				{
					text: 'Aggregate selected MAF files and download',
					callback: submitSelectedFiles
				}
			]
		})
	} catch (e) {
		sayerror(holder, e)
	}

	async function submitSelectedFiles(lst) {
		const fileIdLst = []
		for (const i of lst) {
			fileIdLst.push(result.files[i].id)
		}

		// may disable the "Aggregate" button here and re-enable later

		let data
		try {
			data = await dofetch3('gdc/mafBuild', { body: { fileIdLst } })
		} catch (e) {
			// do not proceed upon err
			sayerror(holder, e)
			return
		}

		// download the file to client
		const a = document.createElement('a')
		a.href = URL.createObjectURL(data)
		a.download = 'cohort.maf.gz'
		a.style.display = 'none'
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
	}

	return publicApi
}

async function getFileList(filter0) {
	const body = {}
	if (filter0) body.filter0 = filter0
	const data = await dofetch3('gdc/maf', { body })
	if (data.error) throw data.error
	return data
}
