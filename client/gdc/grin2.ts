import { dofetch3 } from '#common/dofetch'
import { make_radios, renderTable, sayerror, Menu, table2col } from '#dom'
import { select } from 'd3-selection'

/*
a UI to list open-access maf and cnv files from current cohort
let user selects some, for the backend to run GRIN2 analysis
and display the resulting visualization
*/

const tip = new Menu()

// list of columns to show in MAF file table
const tableColumns = [
	{ label: 'Case', sortable: true },
	{ label: 'Project', sortable: true },
	{ label: 'Samples' },
	{ label: 'File Size', barplot: { tickFormat: '~s' }, sortable: true } // barchart column not sortable yet
]

// list of analysis options
const analysisOptions = [
	{ option: 'includeGain', selected: true, label: 'Include Gain' },
	{ option: 'includeLoss', selected: true, label: 'Include Loss' },
	{ option: 'includeFusion', selected: true, label: 'Include Fusion' }
]

export async function gdcMAFui({ holder, filter0, callbacks, debugmode = false }) {
	if (debugmode) {
		console.log('Debug mode enabled')
		// Additional debug logic
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
		sayerror(holder, e.message || e)
	}

	async function update({ filter0 }) {
		holder.selectAll('*').remove()
		// TODO convert obj to class and declare all properties
		const obj = {
			errDiv: holder.append('div'),
			controlDiv: holder.append('div'),
			tableDiv: holder.append('div'),
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
			`${analysisOptions.reduce((c, i) => c + (i.selected ? 1 : 0), 0)} of ${
				analysisOptions.length
			} options selected. Click to change`
		)
	}
	const table = table2col({ holder: obj.controlDiv })
	table.addRow('Access', 'Open')
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
		const [, td2] = table.addRow('Analysis Options')
		clickText = td2
			.append('span')
			.attr('class', 'sja_clbtext')
			.on('click', event => {
				const rows = [],
					selectedRows = []
				for (const [i, c] of analysisOptions.entries()) {
					rows.push([{ value: c.label }])
					if (c.selected) selectedRows.push(i)
				}
				renderTable({
					div: tip.clear().showunder(event.target).d,
					rows,
					columns: [{ label: 'Option' }],
					selectedRows,
					noButtonCallback: (i, n) => {
						analysisOptions[i].selected = n.checked
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

	let result // convenient for accessing outside of try-catch

	try {
		const body = {
			experimentalStrategy: obj.opts.experimentalStrategy
		}
		if (obj.opts.filter0) body.filter0 = obj.opts.filter0

		// Keep using the existing gdc/maf endpoint which now includes CNV files
		result = await dofetch3('gdc/maf', { body })

		if (result.error) throw result.error
		if (!Array.isArray(result.files)) throw 'result.files[] not array'
		if (result.files.length == 0) throw 'No MAF/CNV files available.'

		// render
		if (result.filesTotal > result.files.length) {
			wait.text(`Showing first ${result.files.length} files out of ${result.filesTotal} total.`)
		} else {
			wait.text(`Showing ${result.files.length} files.`)
		}

		const rows = []
		for (const f of result.files) {
			// Determine if the file is MAF or CNV
			const isMaf = f.id.toLowerCase().includes('.maf') || f.data_format === 'MAF'
			f.fileFormat = isMaf ? 'maf' : 'cnv'

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
			resize: true,
			div: obj.tableDiv.append('div'),
			selectAll: true, // comment out for quicker testing
			dataTestId: 'sja_mafFileTable',
			header: { allowSort: true },
			selectedRows: [], //[198], // uncomment out for quicker testing
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
		wait.text(e.message || e)
		if (e.stack) console.log(e.stack)
	}

	function updateButtonBySelectionChange(lst, button) {
		if (obj.busy) {
			/* is waiting for server response. do not proceed to alter submit button
            because the checkboxes in the maf table cannot be disabled when submission is running,
            thus user can still check and uncheck maf files, that can cause the submit button to be enabled
            thus do below to disable it
            */
			obj.mafTableArg.buttons[0].button.property('disabled', true)
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
	let serverMessage

	async function runGRIN2Analysis(lst, button) {
		mayCreateServerMessageSpan(button)

		// Format the data according to what the Rust code expects
		const caseFiles = {}

		for (const i of lst) {
			const file = result.files[i]
			const caseId = file.case_submitter_id

			// Determine the file format - use existing fileFormat field or infer from other properties
			const fileFormat =
				file.fileFormat || (file.id.toLowerCase().includes('.maf') || file.data_format === 'MAF' ? 'maf' : 'cnv')

			// Convert to lowercase to match Rust expectations (maf or cnv)
			const formatKey = fileFormat.toLowerCase()

			// Initialize case entry if it doesn't exist
			if (!caseFiles[caseId]) {
				caseFiles[caseId] = {
					maf: null,
					cnv: null
				}
			}

			// Set the file ID in the appropriate field
			caseFiles[caseId][formatKey] = file.id
		}

		// Debug output
		console.log('Sending to GRIN2:', caseFiles)

		if (Object.keys(caseFiles).length === 0) return

		const oldText = button.innerHTML
		button.innerHTML = 'Analyzing... Please wait'
		button.disabled = true
		serverMessage.style('display', 'none')

		// Clear previous results
		obj.resultDiv.selectAll('*').remove()

		try {
			obj.busy = true
			obj.expStrategyRadio.inputs.property('disabled', true)

			// Call the GRIN2 run endpoint with the correctly formatted data
			const response = await dofetch3('gdc/runGRIN2', {
				body: caseFiles
			})

			obj.busy = false
			obj.expStrategyRadio.inputs.property('disabled', false)

			// Log the response type for debugging
			console.log('Response type:', typeof response)
			if (response instanceof Blob) {
				console.log('Response is a Blob, size:', response.size)
			} else {
				console.log('Response details:', response)
			}

			// Handle different response types
			if (response instanceof Blob) {
				// Display the image result
				const imageUrl = URL.createObjectURL(response)

				// Add title for the results
				obj.resultDiv.append('h3').text('GRIN2 Analysis Results')

				// Create image container with fixed dimensions
				const imgContainer = obj.resultDiv
					.append('div')
					.style('margin-top', '10px')
					.style('max-width', '100%')
					.style('overflow', 'auto')

				// Add the image
				imgContainer.append('img').attr('src', imageUrl).attr('alt', 'GRIN2 Analysis Result').style('max-width', '100%')

				// Add download button for the image
				obj.resultDiv
					.append('button')
					.text('Download Image')
					.style('margin-top', '10px')
					.on('click', () => {
						const a = document.createElement('a')
						a.href = imageUrl
						a.download = `GRIN2_Analysis_${new Date().toISOString().split('T')[0]}.png`
						document.body.appendChild(a)
						a.click()
						document.body.removeChild(a)
					})

				// Scroll to the results
				obj.resultDiv.node().scrollIntoView({ behavior: 'smooth' })
			} else {
				// If response is not a blob, it might be JSON with information
				if (response.status === 'error') {
					throw new Error(response.error || 'Unknown error occurred')
				} else if (response.imagePath) {
					// If the server returns an image path instead of the image itself
					obj.resultDiv.append('h3').text('GRIN2 Analysis Results')
					obj.resultDiv
						.append('img')
						.attr('src', response.imagePath)
						.attr('alt', 'GRIN2 Analysis Result')
						.style('max-width', '100%')
				} else {
					// Handle other response formats
					obj.resultDiv.append('h3').text('GRIN2 Analysis Complete')
					obj.resultDiv
						.append('pre')
						.style('max-height', '400px')
						.style('overflow', 'auto')
						.style('background', '#f5f5f5')
						.style('padding', '10px')
						.style('border-radius', '4px')
						.text(JSON.stringify(response, null, 2))
				}
			}
		} catch (e) {
			console.error('GRIN2 Analysis Error:', e)
			sayerror(obj.errDiv, e)
			obj.resultDiv
				.append('div')
				.attr('class', 'sja_error')
				.text('Error running GRIN2 analysis: ' + (e.message || e))
		} finally {
			button.innerHTML = oldText
			button.disabled = false
			obj.busy = false
			obj.expStrategyRadio.inputs.property('disabled', false)
		}
	}
	function mayCreateServerMessageSpan(button) {
		if (serverMessage) return // message <span> are already created
		const holder = select(button.parentElement)
		serverMessage = holder.append('span').attr('class', 'sja_clbtext').style('display', 'none')
	}
}
