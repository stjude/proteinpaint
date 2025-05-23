import { dofetch3 } from '#common/dofetch'
import { make_radios, renderTable, sayerror, Menu, table2col } from '#dom'
import { select } from 'd3-selection'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'
import type { GdcGRIN2listRequest } from '#types'

/*
a UI to list open-access maf and cnv files from current cohort
let user selects some, for the backend to run GRIN2 analysis
and display the resulting visualization
*/

// Adding type definitions to solve typescript errors
// Interface for table row item
interface TableRowItem {
	html?: string
	value?: any
}

const tip = new Menu()

// list of columns to show in MAF file table
const tableColumns = [
	{ label: 'Case', sortable: true },
	{ label: 'Project', sortable: true },
	{ label: 'Samples' },
	{ label: 'File Size', barplot: { tickFormat: '~s' }, sortable: true }
]

// list of data type options
const datatypeOptions = [
	{ option: 'mafOption', selected: true, label: 'Include Mutation' },
	{ option: 'cnvOption', selected: true, label: 'Include CNV' },
	{ option: 'fusionOption', selected: true, label: 'Include Fusion' }
]

export async function gdcGRIN2ui({ holder, filter0, callbacks, debugmode = false }) {
	if (debugmode) {
		// Debug logic
	}
	try {
		if (callbacks) {
			/* due to src/app.js line 100
            delete this when that is reshaped to app.sjcharts.callbacks={}
            */
			delete callbacks.sjcharts
			for (const n in callbacks) {
				if (typeof callbacks[n] != 'function') throw `callbacks.${n} not function`
			}
		}
		update({ filter0 })
	} catch (e) {
		console.log(e)
		sayerror(holder, e instanceof Error ? e.message : String(e))
	}

	async function update({ filter0 }) {
		holder.selectAll('*').remove()
		holder.style('width', '100%').style('max-width', 'none')
		const obj = {
			errDiv: holder.append('div'),
			controlDiv: holder.append('div'),
			tableDiv: holder.append('div').style('width', '100%'),
			downloadButtonDiv: holder.append('div').style('margin-top', '10px').style('display', 'none'),
			resultDiv: holder.append('div').style('margin-top', '20px'),
			opts: {
				filter0,
				experimentalStrategy: 'WXS'
			},
			busy: false, // when analyzing, set to true for disabling ui interactivity
			mafTableArg: null,
			expStrategyRadio: null
		}
		makeControls(obj)
		await getFilesAndShowTable(obj)
		callbacks?.postRender?.(publicApi)
	}

	// return api to be accessible by react wrapper; will call api.update() to auto refresh cohortmaf UI on GFF cohort change
	const publicApi = { update }
	return publicApi
}

function makeControls(obj) {
	let clickText
	function updateText() {
		clickText.text(
			`${datatypeOptions.reduce((c, i) => c + (i.selected ? 1 : 0), 0)} of ${
				datatypeOptions.length
			} options selected. Click to change`
		)
	}
	const table = table2col({ holder: obj.controlDiv })
	table.addRow('Data Access', 'Open')
	table.addRow('Workflow Type', 'Aliquot Ensemble Somatic Variant Merging and Masking')
	{
		const [, td2] = table.addRow('Experimental Strategy')
		obj.expStrategyRadio = make_radios({
			holder: td2,
			options: [{ label: 'WXS', value: 'WXS', checked: obj.opts.experimentalStrategy == 'WXS' }],
			styles: { display: 'inline' },
			callback: async value => {
				obj.opts.experimentalStrategy = value
				await getFilesAndShowTable(obj)
			}
		})
	}

	{
		const [, td2] = table.addRow('Data Type Options')
		clickText = td2
			.append('span')
			.attr('class', 'sja_clbtext')
			.on('click', event => {
				const rows: TableRowItem[][] = []
				const selectedRows: number[] = []
				for (const [i, c] of datatypeOptions.entries()) {
					rows.push([{ value: c.label }])
					if (c.selected) selectedRows.push(i)
				}
				renderTable({
					div: tip.clear().showunder(event.target).d,
					rows,
					columns: [{ label: 'Data types' }],
					selectedRows,
					noButtonCallback: (i, n) => {
						datatypeOptions[i].selected = n.checked
						updateText()
					}
				})
			})

		updateText()
	}
}

async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	obj.resultDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').style('margin', '30px 10px 10px 10px').text('Loading...')

	let result
	try {
		// Initialize the request body
		const body: GdcGRIN2listRequest = {}

		if (obj.opts.filter0) body.filter0 = obj.opts.filter0

		// Add mafOptions if experimentalStrategy exists
		if (obj.opts.experimentalStrategy) {
			body.mafOptions = {
				experimentalStrategy: obj.opts.experimentalStrategy
			}
		}

		result = await dofetch3('gdc/GRIN2list', { body })

		if (result.error) throw result.error
		if (!Array.isArray(result.files)) throw 'result.files[] not array'
		if (result.files.length == 0) throw 'No files available.'

		// Show deduplication information if any duplicates were removed
		if (result.deduplicationStats && result.deduplicationStats.duplicatesRemoved > 0) {
			const deduplicationDiv = obj.deduplicationInfoDiv
				.append('div')
				.style('background-color', '#f0f8ff')
				.style('border', '1px solid #87ceeb')
				.style('border-radius', '4px')
				.style('padding', '10px')
				.style('margin', '10px 0')

			deduplicationDiv
				.append('div')
				.style('font-weight', 'bold')
				.style('color', '#2c5aa0')
				.text('🔄 File Deduplication Applied')

			deduplicationDiv.append('div').style('margin-top', '5px').style('font-size', '14px').html(`
					Found <strong>${result.deduplicationStats.originalFileCount}</strong> total MAF files, 
					but <strong>${result.deduplicationStats.duplicatesRemoved}</strong> were duplicates from the same cases. 
					<br/>Showing <strong>${result.deduplicationStats.deduplicatedFileCount}</strong> unique cases 
					(largest file selected for each case).
				`)
		}

		// render
		if (result.filesTotal > result.files.length) {
			wait.text(
				`Showing first ${result.files.length.toLocaleString()} files out of ${result.filesTotal.toLocaleString()} total. Only files smaller than 1 Mb are shown.`
			)
		} else {
			wait.text(`Showing ${result.files.length.toLocaleString()} files. Only files smaller than 1 Mb are shown.`)
		}

		const rows: TableRowItem[][] = []
		for (const f of result.files) {
			const row = [
				{
					html: `<a href=https://portal.gdc.cancer.gov/files/${f.id} target=_blank>${f.case_submitter_id}</a>`,
					value: f.case_submitter_id
				},
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
				{ value: f.file_size } // do not send in text-formated file size, table sorting won't work
			]
			rows.push(row)
		}

		// tracks table arg, so that the created button DOM element is accessible and can be modified
		obj.mafTableArg = {
			rows,
			columns: tableColumns,
			resize: false,
			div: obj.tableDiv.append('div'),
			selectAll: false,
			dataTestId: 'sja_FileTable',
			header: { allowSort: true },
			selectedRows: [0],
			buttons: [
				{
					text: 'Run GRIN2 Analysis',
					onChange: updateButtonBySelectionChange,
					callback: runGRIN2Analysis
				}
			]
		}
		renderTable(obj.mafTableArg)
	} catch (e) {
		wait.text(e instanceof Error ? e.message : String(e))
		if (e instanceof Error && e.stack) console.log(e.stack)
	}

	function updateButtonBySelectionChange(lst, button) {
		if (obj.busy) {
			/* is waiting for server response. do not proceed to alter submit button
            because the checkboxes in the maf table cannot be disabled when submission is running,
            thus user can still check and uncheck maf files, that can cause the submit button to be enabled
            thus do below to disable it
            */
			button.property('disabled', true)
			return
		}

		let sum = 0
		for (const i of lst) sum += result.files[i].file_size
		if (sum == 0) {
			button.innerHTML = 'No file selected'
			button.disabled = true
			return
		}

		// TEMP fix! later add `buttonsToLeft:true` at line 321; this fix avoid changing table.ts to make it easy to cherrypick for 2.16 gdc release
		select(button.parentElement).style('float', 'left')

		button.disabled = false
		button.innerHTML = sum < result.maxTotalSizeCompressed ? `Run GRIN2 Analysis` : `Run GRIN2 Analysis (large files)`
	}

	/* after table is created, on clicking download btn for first time, create a <span> after download btn,
    in order to show server-sent message on problematic files (emtpy, failed, invalid)
    scope this <span> for easy access by helpers,
    detect if it is truthy to only create it once
    */

	/**
	 * Formats selected files for GRIN2 Rust backend
	 *
	 * @param lst - Array of selected table row indices
	 *
	 * Creates structure expected by Rust:
	 * {
	 *   caseFiles: {
	 *     [case_submitter_id]: { maf: file_id }
	 *   },
	 *   mafOptions: { minTotalDepth: 10, minAltAlleleCount: 2 }
	 * }
	 *
	 */

	async function runGRIN2Analysis(lst, button) {
		// Format the data according to what the Rust code expects
		const caseFiles = {
			caseFiles: {},
			mafOptions: {
				minTotalDepth: 10,
				minAltAlleleCount: 2
			}
		}

		for (const i of lst) {
			const file = result.files[i]
			console.log('File object:', file)
			const caseId = file.case_submitter_id

			if (!caseFiles[caseId]) {
				caseFiles.caseFiles[caseId] = {}
			}

			caseFiles.caseFiles[caseId].maf = file.id
		}

		if (Object.keys(caseFiles.caseFiles).length === 0) return

		const oldText = button.innerHTML
		button.innerHTML = 'Analyzing... Please wait'
		button.disabled = true

		// Clear previous results
		obj.resultDiv.selectAll('*').remove()

		try {
			obj.busy = true
			obj.expStrategyRadio.inputs.property('disabled', true)

			// Call the GRIN2 run endpoint with the correctly formatted data
			console.log('Sending GRIN2 request:', caseFiles)
			console.log('GRIN2 request structure:', JSON.stringify(caseFiles, null, 2))
			const startTime = Date.now()
			const response = await dofetch3('gdc/runGRIN2', { body: caseFiles })
			const elapsedTime = formatElapsedTime(Date.now() - startTime)
			console.log(`GRIN2 analysis took ${elapsedTime}`)
			if (!response) throw 'invalid response'
			if (response.error) throw response.error

			console.log('GRIN2 response:', response)

			if (!response.pngImg) throw 'result.pngImg missing'

			// Create image URL from base64 data
			const imageUrl = `data:image/png;base64,${response.pngImg}`

			// Show and populate download button div next the Run Analysis button
			// Create a unique name for the download file based on selected mutations
			// and the current timestamp
			const selectedMutations = datatypeOptions
				.filter(opt => opt.selected)
				.map(opt => opt.label.replace(/[^a-zA-Z0-9]/g, ''))
				.join('_')

			const now = new Date()
			const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
				now.getDate()
			).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(
				2,
				'0'
			)}-${String(now.getSeconds()).padStart(2, '0')}`
			obj.downloadButtonDiv.selectAll('*').remove()
			obj.downloadButtonDiv
				.append('button')
				.text('Download Plot')
				.on('click', () => {
					const a = document.createElement('a')
					a.href = imageUrl
					a.download = `GRIN2_Analysis_${selectedMutations}_${timestamp}.png`
					document.body.appendChild(a)
					a.click()
					document.body.removeChild(a)
				})
			obj.downloadButtonDiv.style('display', 'block')

			// Create results container
			const resultContainer = obj.resultDiv.append('div').style('text-align', 'left').style('margin', '0 auto')

			// Add title with spacing above
			resultContainer
				.append('h3')
				.text('GRIN2 Analysis Results')
				.style('margin-top', '40px')
				.style('margin-bottom', '0px')
				.style('text-align', 'left')

			// Add image (left aligned)
			const img = resultContainer
				.append('img')
				.attr('src', imageUrl)
				.attr('alt', 'GRIN2 Analysis Result')
				.style('max-width', '100%')
				.style('display', 'block')
				.style('margin', '0')

			// Add error handler
			img.node().onerror = () => {
				console.error('Image failed to load')
				resultContainer.html('') // Clear container
				resultContainer
					.append('div')
					.attr('class', 'sja_error')
					.text('Failed to load image result. The analysis may have encountered an error.')
			}
		} catch (e: any) {
			sayerror(obj.errDiv, e.message || e)
			if (e.stack) console.log(e.stack)
		}
		// Reset button state
		button.innerHTML = oldText
		button.disabled = false
		obj.busy = false
		obj.expStrategyRadio.inputs.property('disabled', false)
	}
}
