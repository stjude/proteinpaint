import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import { sayerror } from '#dom/error'
import { Menu } from '#dom/menu'
import { renderTable } from '#dom/table'

/*
generate an aggregated maf file from a cohort

filter0=str
	optional, stringified json obj as the cohort filter from gdc ATF
	simply pass to backend to include in api queries

*/

const tip = new Menu({ padding: '' })

const columns = [
	{ label: 'Case' },
	{ label: 'Samples' },
	{ label: 'Experimental Strategy' },
	{ label: 'Workflow Type' },
	{ label: 'File Size' }
]
export async function gdcMAFui({ holder, filter0, callbackOnRender, debugmode = false }) {
	// public api obj to be returned
	const publicApi = {}

	if (typeof callbackOnRender == 'function') {
		// ?
		callbackOnRender(publicApi)
	}

	try {
		const result = await getFileList(filter0)
		const rows = []
		for (const f of result.files) {
			const row = [
				{ value: f.case_submitter_id },
				{ value: f.sample_types },
				{ value: f.experimental_strategy },
				{ value: f.workflow_type },
				{ value: f.file_size }
			]
			rows.push(row)
		}
		renderTable({
			rows,
			columns,
			div: holder.append('div')
		})
	} catch (e) {
		sayerror(holder, e)
	}

	return publicApi
}

async function getFileList(filter0) {
	const body = {}
	if (filter0) body.filter0 = filter0
	return await dofetch3('gdc/maf', { body })
}
