import { dofetch3 } from '#common/dofetch'
import { make_radios, renderTable, sayerror, Menu, table2col } from '#dom'
import { select } from 'd3-selection'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'
import type { GdcGRIN2listRequest } from '#types'
import * as d3 from 'd3'

/*
a UI to list open-access maf and cnv files from current cohort
let user selects some, for the backend to run GRIN2 analysis
and display the resulting visualization
*/

/**
 * Function to show the deduplication popup
 * Pass your deduplication stats that include the console.log data
 */
function showDeduplicationPopup(deduplicationStats) {
	// Remove any existing popup
	d3.select('.deduplication-popup').remove()

	// Create popup overlay
	const popup = d3
		.select('body')
		.append('div')
		.attr('class', 'deduplication-popup')
		.style('position', 'fixed')
		.style('top', '0')
		.style('left', '0')
		.style('width', '100%')
		.style('height', '100%')
		.style('background-color', 'rgba(0, 0, 0, 0.5)')
		.style('z-index', '9999')
		.style('display', 'flex')
		.style('justify-content', 'center')
		.style('align-items', 'center')

	// Create popup content
	const popupContent = popup
		.append('div')
		.style('background-color', 'white')
		.style('border-radius', '8px')
		.style('max-width', '700px')
		.style('width', '90%')
		.style('max-height', '80vh')
		.style('overflow', 'hidden')
		.style('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.3)')

	// Header
	const header = popupContent
		.append('div')
		.style('padding', '16px 20px')
		.style('border-bottom', '1px solid #e0e0e0')
		.style('display', 'flex')
		.style('justify-content', 'space-between')
		.style('align-items', 'center')

	const totalExcluded = deduplicationStats.duplicatesRemoved + (deduplicationStats.filteredFiles?.length || 0)

	header.append('h3').style('margin', '0').style('color', '#333').text(`Excluded Files (${totalExcluded} total)`)

	// Close button
	header
		.append('button')
		.style('background', 'none')
		.style('border', 'none')
		.style('font-size', '20px')
		.style('cursor', 'pointer')
		.style('color', '#666')
		.text('✕')
		.on('click', function () {
			popup.remove()
		})

	// Content area - scrollable
	const content = popupContent
		.append('div')
		.style('padding', '20px')
		.style('max-height', '55vh')
		.style('overflow-y', 'auto')

	// Section 1: Duplicate Files Removed
	if (deduplicationStats.caseDetails && deduplicationStats.caseDetails.length > 0) {
		content
			.append('h4')
			.style('margin', '0 0 12px 0')
			.style('color', '#d84315')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.html('🔄 Duplicate Files Removed')

		content
			.append('p')
			.style('margin', '0 0 16px 0')
			.style('font-size', '14px')
			.style('color', '#666')
			.text(`${deduplicationStats.duplicatesRemoved} duplicate files were removed (largest file kept for each case)`)

		deduplicationStats.caseDetails.forEach(caseInfo => {
			const caseDiv = content
				.append('div')
				.style('margin-bottom', '8px')
				.style('padding', '8px 12px')
				.style('background-color', '#fff3e0')
				.style('border-radius', '4px')
				.style('border-left', '3px solid #ff9800')

			caseDiv
				.append('div')
				.style('font-size', '14px')
				.style('color', '#333')
				.html(
					`<strong>Case ${caseInfo.caseName}:</strong> Found ${
						caseInfo.fileCount
					} MAF files, keeping largest (${formatBytes(caseInfo.keptFileSize)})`
				)
		})
	}

	// Section 2: Size-Filtered Files
	if (deduplicationStats.filteredFiles && deduplicationStats.filteredFiles.length > 0) {
		// Add separator if we have both sections
		if (deduplicationStats.caseDetails && deduplicationStats.caseDetails.length > 0) {
			content.append('hr').style('margin', '20px 0').style('border', 'none').style('border-top', '1px solid #e0e0e0')
		}

		content
			.append('h4')
			.style('margin', '0 0 12px 0')
			.style('color', '#c62828')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.html('📏 Files Excluded by Size')

		content
			.append('p')
			.style('margin', '0 0 16px 0')
			.style('font-size', '14px')
			.style('color', '#666')
			.text(
				`${deduplicationStats.filteredFiles.length} files were excluded for being too large (>${formatBytes(1000000)})`
			)

		deduplicationStats.filteredFiles.forEach(fileInfo => {
			const fileDiv = content
				.append('div')
				.style('margin-bottom', '8px')
				.style('padding', '8px 12px')
				.style('background-color', '#ffebee')
				.style('border-radius', '4px')
				.style('border-left', '3px solid #f44336')

			fileDiv
				.append('div')
				.style('font-size', '13px')
				.style('color', '#333')
				.style('margin-bottom', '4px')
				.html(`<strong>File ID:</strong> ${fileInfo.fileId}`)

			fileDiv
				.append('div')
				.style('font-size', '12px')
				.style('color', '#666')
				.text(`Size: ${formatBytes(fileInfo.fileSize)} - ${fileInfo.reason}`)
		})
	}

	// Show message if no excluded files
	if (
		(!deduplicationStats.caseDetails || deduplicationStats.caseDetails.length === 0) &&
		(!deduplicationStats.filteredFiles || deduplicationStats.filteredFiles.length === 0)
	) {
		content.append('div').style('text-align', 'center').style('padding', '40px').style('color', '#666').html(`
				<div style="font-size: 48px; margin-bottom: 16px;">✅</div>
				<p>No files were excluded.</p>
				<p style="font-size: 14px;">All files passed size and deduplication checks.</p>
			`)
	}

	// Footer
	const footer = popupContent
		.append('div')
		.style('padding', '16px 20px')
		.style('border-top', '1px solid #e0e0e0')
		.style('background-color', '#f8f9fa')
		.style('display', 'flex')
		.style('justify-content', 'space-between')
		.style('align-items', 'center')

	footer
		.append('div')
		.style('font-size', '13px')
		.style('color', '#666')
		.text('Files are filtered to ensure optimal performance and avoid duplicates.')

	footer
		.append('button')
		.style('background-color', '#2c5aa0')
		.style('color', 'white')
		.style('border', 'none')
		.style('padding', '8px 16px')
		.style('border-radius', '4px')
		.style('cursor', 'pointer')
		.text('Close')
		.on('click', function () {
			popup.remove()
		})

	// Close popup when clicking outside
	popup.on('click', function (event) {
		if (event.target === popup.node()) {
			popup.remove()
		}
	})

	// Close with Escape key
	d3.select('body').on('keydown.popup', function (event) {
		if (event.key === 'Escape') {
			popup.remove()
			d3.select('body').on('keydown.popup', null)
		}
	})
}
/**
 * Helper function to format bytes
 */
function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

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
			deduplicationInfoDiv: holder.append('div'),
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
	// Add MAF filtering options to the controls table
	{
		const [, td2] = table.addRow('MAF Filtering Options')

		// Create container for the MAF options
		const mafOptionsDiv = td2.append('div').style('display', 'inline-block')

		// Min Total Depth input
		mafOptionsDiv.append('label').style('margin-right', '10px').style('font-size', '14px').text('Min Total Depth:')

		mafOptionsDiv
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions?.minTotalDepth || 10)
			.style('width', '60px')
			.style('margin-right', '20px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.on('input', function (this: HTMLInputElement) {
				const value = parseInt(this.value, 10)
				if (!isNaN(value) && value >= 0) {
					obj.mafOptions.minTotalDepth = value
				}
			})

		// Min Alt Allele Count input
		mafOptionsDiv.append('label').style('margin-right', '10px').style('font-size', '14px').text('Min Alt Allele Count:')

		mafOptionsDiv
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions?.minAltAlleleCount || 2)
			.style('width', '60px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.on('input', function (this: HTMLInputElement) {
				const value = parseInt(this.value, 10)
				if (!isNaN(value) && value >= 0) {
					obj.mafOptions.minAltAlleleCount = value
				}
			})

		// Add help tooltip
		mafOptionsDiv
			.append('span')
			.attr('class', 'sja_clbtext')
			.style('margin-left', '10px')
			.style('font-size', '12px')
			.style('color', '#666')
			.text('ⓘ')
			.attr(
				'title',
				'Min Total Depth: Minimum read depth required\nMin Alt Allele Count: Minimum alternate allele count required'
			)
	}

	// Initialize mafOptions if not exists
	if (!obj.mafOptions) {
		obj.mafOptions = {
			minTotalDepth: 10,
			minAltAlleleCount: 2
		}
	}

	{
		const [, td2] = table.addRow('CNV Filtering Options')

		// Create container for the CNV options
		const cnvOptionsDiv = td2.append('div').style('display', 'inline-block')

		// Loss Threshold input
		cnvOptionsDiv.append('label').style('margin-right', '10px').style('font-size', '14px').text('Loss Threshold:')

		cnvOptionsDiv
			.append('input')
			.attr('type', 'number')
			.attr('min', '-10')
			.attr('max', '0')
			.attr('step', '0.1')
			.attr('value', obj.cnvOptions?.lossThreshold || -0.5)
			.style('width', '70px')
			.style('margin-right', '20px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.on('input', function (this: HTMLInputElement) {
				const value = parseFloat(this.value)
				if (!isNaN(value) && value <= 0) {
					obj.cnvOptions.lossThreshold = value
				}
			})

		// Gain Threshold input
		cnvOptionsDiv.append('label').style('margin-right', '10px').style('font-size', '14px').text('Gain Threshold:')

		cnvOptionsDiv
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('max', '10')
			.attr('step', '0.1')
			.attr('value', obj.cnvOptions?.gainThreshold || 0.5)
			.style('width', '70px')
			.style('margin-right', '20px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.on('input', function (this: HTMLInputElement) {
				const value = parseFloat(this.value)
				if (!isNaN(value) && value >= 0) {
					obj.cnvOptions.gainThreshold = value
				}
			})

		// Segment Length Cutoff input
		cnvOptionsDiv
			.append('label')
			.style('margin-right', '10px')
			.style('font-size', '14px')
			.text('Segment Length Cutoff:')

		cnvOptionsDiv
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('max', '5')
			.attr('step', '0.01')
			.attr('value', obj.cnvOptions?.segLength || 2000000)
			.style('width', '70px')
			.style('padding', '2px 4px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.on('input', function (this: HTMLInputElement) {
				const value = parseFloat(this.value)
				if (!isNaN(value) && value >= 0) {
					obj.cnvOptions.segLength = value
				}
			})

		// Add help tooltip for CNV options
		cnvOptionsDiv
			.append('span')
			.attr('class', 'sja_clbtext')
			.style('margin-left', '10px')
			.style('font-size', '12px')
			.style('color', '#666')
			.text('ⓘ')
			.attr(
				'title',
				'Loss Threshold: Log2 ratio threshold for copy number loss (negative values)\n' +
					'Gain Threshold: Log2 ratio threshold for copy number gain (positive values)\n' +
					'Segment Length: Limit the CNV segment length to show only focal events.\nCNV segment size limit is 2000,000 bp'
			)
	}

	if (!obj.cnvOptions) {
		obj.cnvOptions = {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			segLength: 2000000 // Default segment length cutoff
		}
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

		// Show deduplication information if any duplicates were removed OR files were size-filtered
		if (
			(result.deduplicationStats && result.deduplicationStats.duplicatesRemoved > 0) ||
			(result.deduplicationStats &&
				result.deduplicationStats.filteredFiles &&
				result.deduplicationStats.filteredFiles.length > 0)
		) {
			// Clear any previous deduplication info
			obj.deduplicationInfoDiv.selectAll('*').remove()

			const deduplicationDiv = obj.deduplicationInfoDiv
				.append('div')
				.style('background-color', '#f0f8ff')
				.style('border', '1px solid #87ceeb')
				.style('border-radius', '1px')
				.style('padding', '5px')
				.style('margin', '40px 0')
				.style('max-width', '100%') // Don't exceed container width
				.style('width', 'fit-content') // Only as wide as content needs

			const duplicatesRemoved = result.deduplicationStats.duplicatesRemoved || 0
			const sizeFilteredCount = result.deduplicationStats.filteredFiles
				? result.deduplicationStats.filteredFiles.length
				: 0
			const totalExcluded = duplicatesRemoved + sizeFilteredCount
			const originalTotal = result.deduplicationStats.originalFileCount + sizeFilteredCount // Add back the size-filtered files to get true original count

			deduplicationDiv
				.append('div')
				.style('font-weight', 'bold')
				.style('color', '#2c5aa0')
				.text('🔄 File Deduplication and Size Filtering Applied')

			// Build the description text based on what types of filtering occurred
			let descriptionText = `Found <strong>${originalTotal}</strong> total MAF files`
			if (totalExcluded > 0) {
				descriptionText += `, but <strong>${totalExcluded}</strong> were excluded`

				// Add details about what was excluded
				const exclusionDetails: string[] = []
				if (duplicatesRemoved > 0) {
					exclusionDetails.push(`${duplicatesRemoved} duplicates from the same cases`)
				}
				if (sizeFilteredCount > 0) {
					exclusionDetails.push(`${sizeFilteredCount} files too large`)
				}

				if (exclusionDetails.length > 0) {
					descriptionText += ` (${exclusionDetails.join(' and ')})`
				}

				descriptionText += `. <br/>Showing <strong>${result.deduplicationStats.deduplicatedFileCount}</strong> unique cases`

				if (duplicatesRemoved > 0) {
					descriptionText += ` (largest file selected for each case)`
				}
				descriptionText += `.`
			} else {
				descriptionText += `. All files are included.`
			}

			deduplicationDiv.append('div').style('margin-top', '5px').style('font-size', '14px').html(descriptionText)

			// Add clickable link to view excluded files (only if there are excluded files)
			if (totalExcluded > 0) {
				deduplicationDiv
					.append('div')
					.style('margin-top', '8px')
					.append('a')
					.style('color', '#2c5aa0')
					.style('text-decoration', 'underline')
					.style('cursor', 'pointer')
					.style('font-size', '13px')
					.text('View excluded files')
					.on('click', function () {
						showDeduplicationPopup(result.deduplicationStats)
					})
			}
		} else {
			// Clear deduplication info if no filtering occurred
			obj.deduplicationInfoDiv.selectAll('*').remove()
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
					callback: (lst, button) => runGRIN2Analysis(lst, button, obj)
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

	async function runGRIN2Analysis(lst, button, obj) {
		// Format the data according to what the Rust code expects
		const caseFiles = {
			caseFiles: {},
			mafOptions: {
				minTotalDepth: obj.mafOptions.minTotalDepth,
				minAltAlleleCount: obj.mafOptions.minAltAlleleCount
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
				.style('margin', '30px')

			console.log('Top genes table:', response.topGeneTable)

			// Add error handler for image
			img.node().onerror = () => {
				console.error('Image failed to load')
				img.remove()
				resultContainer
					.append('div')
					.attr('class', 'sja_error')
					.style('padding', '10px')
					.style('background-color', '#f8d7da')
					.style('border', '1px solid #f5c6cb')
					.style('margin', '10px 0')
					.text('Failed to load image result. The analysis may have encountered an error.')
			}

			if (response.topGeneTable && response.topGeneTable.rows && response.topGeneTable.rows.length > 0) {
				// Add table title with summary information
				const tableTitle = resultContainer.append('h4').style('margin-bottom', '15px').style('text-align', 'left')

				// Show summary info if available
				if (response.totalGenes && response.showingTop) {
					tableTitle.text(`Top ${response.showingTop} Genes`)

					resultContainer
						.append('p')
						.html(
							`Showing top <strong>${
								response.showingTop
							}</strong> genes out of <strong>${response.totalGenes.toLocaleString()}</strong> total genes analyzed.`
						)
						.style('color', '#495057')
						.style('font-size', '14px')
						.style('margin', '10px 0 20px 0')
				} else {
					tableTitle.text('Top Genes')

					resultContainer
						.append('p')
						.style('color', '#495057')
						.style('font-size', '14px')
						.style('margin', '10px 0 20px 0')
				}

				// Create a container for the table
				const tableContainer = resultContainer.append('div').style('margin-bottom', '20px')

				// Define table columns - enhanced with tooltips
				const tableColumns = [
					{
						label: 'Gene',
						sortable: true,
						width: '150px',
						tooltip: 'Gene symbol'
					},
					{
						label: 'P-value',
						sortable: true,
						width: '120px',
						tooltip: 'Statistical significance of gene association'
					},
					{
						label: 'Q-value',
						sortable: true,
						width: '120px',
						tooltip: 'False discovery rate adjusted p-value'
					}
				]

				// Render the table using your existing table component
				renderTable({
					div: tableContainer,
					columns: tableColumns,
					rows: response.topGeneTable.rows,
					showLines: true, // Show row numbers
					striped: true, // Alternate row colors
					showHeader: true, // Show column headers
					maxHeight: '500px', // Increased height since we're limiting rows in R
					maxWidth: '100%', // Full width available
					resize: false, // Don't allow manual resizing
					header: {
						allowSort: true, // Enable column sorting
						style: {
							'background-color': '#f8f9fa',
							'font-weight': 'bold',
							'border-bottom': '2px solid #dee2e6'
						}
					},
					download: {
						// Enable table download functionality
						fileName: `GRIN2_TopGenes_${timestamp}.tsv`
					}
				})

				console.log(`Displayed table with ${response.topGeneTable.rows.length} genes`)

				// Add note about full results if truncated (NEW: informative message)
				if (response.totalGenes && response.showingTop && response.totalGenes > response.showingTop) {
					resultContainer
						.append('div')
						.style('margin-top', '15px')
						.style('padding', '10px')
						.style('background-color', '#e9ecef')
						.style('border-radius', '4px')
						.style('font-size', '14px')
						.style('max-width', '100%') // Don't exceed container width
						.style('width', 'fit-content') // Only as wide as content needs
						.style('color', '#495057').html(`
							<strong>Note:</strong> For performance reasons, only the top ${response.showingTop} 
							most significant genes are displayed. The complete analysis identified 
							${response.totalGenes.toLocaleString()} genes total.
						`)
				}
			} else {
				// No table data available
				console.log('No table data received or empty results')
				resultContainer
					.append('div')
					.style('padding', '15px')
					.style('background-color', '#fff3cd')
					.style('border', '1px solid #ffeaa7')
					.style('border-radius', '4px')
					.style('margin', '15px 0')
					.style('max-width', '100%') // Don't exceed container width
					.style('width', 'fit-content') // Only as wide as content needs
					.text('No significant genes found in the analysis.')
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
