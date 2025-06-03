import { dofetch3 } from '#common/dofetch'
// import { make_radios, renderTable, sayerror, Menu, table2col } from '#dom'
import { renderTable, sayerror } from '#dom'
import { select } from 'd3-selection'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'
import type { GdcGRIN2listRequest } from '#types'
import { mclass } from '@sjcrh/proteinpaint-shared/common.js'

/* Temporary note for mclass mutation types */
console.log('mclass structure:', mclass)
console.log('mclass keys:', Object.keys(mclass))

/**
 * Maps mclass constants to user-friendly mutation type names
 * Based on the mclass keys you provided
 */
interface MutationType {
	mclassKey: string
	mclassValue: string | number
	displayName: string
	description: string
	category: 'coding' | 'structural' | 'noncoding'
}

/**
 * Generates mutation types from mclass constants
 * Filters for relevant MAF mutation types only
 */
function generateMutationTypesFromMclass(): MutationType[] {
	// Create reverse lookup: value -> key
	const mclassReverse: { [value: string]: string } = {}
	Object.entries(mclass).forEach(([key, value]) => {
		mclassReverse[String(value)] = key
	})

	// Define the relevant MAF mutation types with their mclass mappings
	const relevantMutationTypes: MutationType[] = [
		{
			mclassKey: mclassReverse['M'] || '0',
			mclassValue: 'M',
			displayName: 'Missense',
			description: 'Single nucleotide change resulting in amino acid substitution',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['N'] || '3',
			mclassValue: 'N',
			displayName: 'Nonsense',
			description: 'Premature stop codon introduction',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['F'] || '2',
			mclassValue: 'F',
			displayName: 'Frameshift',
			description: 'Insertion/deletion causing reading frame shift',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['D'] || '5',
			mclassValue: 'D',
			displayName: 'Deletion',
			description: 'In-frame deletion',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['I'] || '6',
			mclassValue: 'I',
			displayName: 'Insertion',
			description: 'In-frame insertion',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['S'] || '4',
			mclassValue: 'S',
			displayName: 'Silent',
			description: 'Synonymous mutation (no amino acid change)',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['ProteinAltering'] || '7',
			mclassValue: 'ProteinAltering',
			displayName: 'Protein Altering',
			description: 'Mutations that alter protein sequence',
			category: 'coding'
		},
		{
			mclassKey: mclassReverse['ITD'] || '13',
			mclassValue: 'ITD',
			displayName: 'Internal Tandem Duplication',
			description: 'Tandem duplication within gene',
			category: 'structural'
		}
	]

	// Filter out any that don't exist in the current mclass
	return relevantMutationTypes.filter(type => {
		const exists = Object.values(mclass).some(m => m.key === type.mclassValue)
		if (!exists) {
			console.warn(`Mutation type ${type.displayName} (${type.mclassValue}) not found in mclass`)
		}
		return exists
	})
}

/**
 * Gets just the display names for backward compatibility
 */
function getMutationTypeNames(): string[] {
	return generateMutationTypesFromMclass().map(type => type.displayName.toLowerCase())
}

/**
 * Gets mutation types grouped by category
 */
function getMutationTypesByCategory(): { [category: string]: MutationType[] } {
	const allTypes = generateMutationTypesFromMclass()

	return allTypes.reduce((groups, type) => {
		if (!groups[type.category]) {
			groups[type.category] = []
		}
		groups[type.category].push(type)
		return groups
	}, {} as { [category: string]: MutationType[] })
}

/**
 * Gets the mclass constant for a given mutation type name
 */
function getMclassConstant(mutationTypeName: string): string | number | null {
	const types = generateMutationTypesFromMclass()
	const found = types.find(type => type.displayName.toLowerCase() === mutationTypeName.toLowerCase())
	return found ? found.mclassValue : null
}

/**
 * Validates if a mutation type is supported
 */
function isValidMutationType(mutationTypeName: string): boolean {
	return getMclassConstant(mutationTypeName) !== null
}

// Export the functions
export {
	generateMutationTypesFromMclass,
	getMutationTypeNames,
	getMutationTypesByCategory,
	getMclassConstant,
	isValidMutationType,
	type MutationType
}

// For debugging - log the available mutation types
console.log('Available MAF mutation types from mclass:')
generateMutationTypesFromMclass().forEach(type => {
	console.log(`  ${type.displayName}: mclass[${type.mclassKey}] = "${type.mclassValue}"`)
})

/*
a UI to list open-access maf and cnv files from current cohort
let user selects some, for the backend to run GRIN2 analysis
and display the resulting visualization
*/

/**
 * Function to show the deduplication popup
 * Pass your deduplication stats that include the console.log data
 */
function gdcGrin2ShowDeduplicationPopup(deduplicationStats) {
	// Remove any existing popup
	select('.deduplication-popup').remove()

	// Create popup overlay
	const popup = select('body')
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
					} MAF files, keeping largest (${gdcGrin2FormatBytes(caseInfo.keptFileSize)})`
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
				`${deduplicationStats.filteredFiles.length} files were excluded for being too large (>${gdcGrin2FormatBytes(
					1000000
				)})`
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
				.text(`Size: ${gdcGrin2FormatBytes(fileInfo.fileSize)} - ${fileInfo.reason}`)
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
	select('body').on('keydown.popup', function (event) {
		if (event.key === 'Escape') {
			popup.remove()
			select('body').on('keydown.popup', null)
		}
	})
}
/**
 * Helper function to format bytes
 */
function gdcGrin2FormatBytes(bytes) {
	if (bytes === 0) return '0 Bytes'
	const k = 1024
	const sizes = ['Bytes', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(k))
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Function to show the failed files popup
 * Similar to deduplication popup but for download failures
 */
function gdcGrin2ShowFailedFilesPopup(failedFilesData) {
	// Remove any existing popup
	select('.failed-files-popup').remove()

	// Create popup overlay
	const popup = select('body')
		.append('div')
		.attr('class', 'failed-files-popup')
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
		.style('max-width', '800px')
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

	header
		.append('h3')
		.style('margin', '0')
		.style('color', '#333')
		.text(`Failed File Downloads (${failedFilesData.count} files)`)

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
		.style('max-height', '60vh')
		.style('overflow-y', 'auto')

	// Error summary section
	if (failedFilesData.errorSummary) {
		content
			.append('h4')
			.style('margin', '0 0 12px 0')
			.style('color', '#d32f2f')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.html('📊 Error Summary')

		const summaryDiv = content
			.append('div')
			.style('margin-bottom', '20px')
			.style('padding', '12px')
			.style('background-color', '#fff3e0')
			.style('border-radius', '6px')
			.style('border-left', '4px solid #ff9800')

		const { errorSummary } = failedFilesData
		const summaryItems: string[] = []

		if (errorSummary.connectionErrors > 0) {
			summaryItems.push(`${errorSummary.connectionErrors} connection errors`)
		}
		if (errorSummary.timeoutErrors > 0) {
			summaryItems.push(`${errorSummary.timeoutErrors} timeout errors`)
		}
		if (errorSummary.serverErrors > 0) {
			summaryItems.push(`${errorSummary.serverErrors} server errors`)
		}
		if (errorSummary.otherErrors > 0) {
			summaryItems.push(`${errorSummary.otherErrors} other errors`)
		}

		summaryDiv.append('div').style('font-size', '14px').style('color', '#333').text(summaryItems.join(', '))

		// Add separator
		content.append('hr').style('margin', '20px 0').style('border', 'none').style('border-top', '1px solid #e0e0e0')
	}

	// Failed files table section
	content
		.append('h4')
		.style('margin', '0 0 12px 0')
		.style('color', '#d32f2f')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')
		.html('📋 Failed Files Details')

	// Create table container
	const tableContainer = content.append('div').style('margin-top', '12px')

	// Render the failed files table using your existing renderTable function
	renderTable({
		div: tableContainer,
		columns: failedFilesData.tableData.headers.map(header => ({
			label: header,
			sortable: true
		})),
		rows: failedFilesData.tableData.rows.map(row => row.map(cell => ({ value: cell }))),
		showLines: true,
		striped: true,
		showHeader: true,
		maxHeight: '300px',
		resize: false,
		header: {
			allowSort: true,
			style: {
				'background-color': '#f8f9fa',
				'font-weight': 'bold',
				'border-bottom': '2px solid #dee2e6'
			}
		}
	})

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
		.text('These files could not be downloaded due to network or server issues.')

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
	select('body').on('keydown.failed-popup', function (event) {
		if (event.key === 'Escape') {
			popup.remove()
			select('body').on('keydown.failed-popup', null)
		}
	})
}

// Adding type definitions to solve typescript errors
// Interface for table row item
interface TableRowItem {
	html?: string
	value?: any
}

// const tip = new Menu()

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
	// Initialize options objects with mclass-aware defaults
	if (!obj.mafOptions) {
		// Get available mutation types from mclass
		const availableMutationTypes = getMutationTypeNames()

		// Set smart defaults - prefer common coding mutations if available
		const preferredDefaults = ['missense', 'nonsense', 'frameshift']
		const defaultConsequences = preferredDefaults.filter(type => availableMutationTypes.includes(type))

		// If none of the preferred defaults are available, use the first few available
		if (defaultConsequences.length === 0) {
			defaultConsequences.push(...availableMutationTypes.slice(0, 3))
		}

		obj.mafOptions = {
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: defaultConsequences, // Dynamic defaults from mclass
			hypermutatorMaxCutoff: 8000
		}

		console.log('Initialized MAF options with mclass-based consequences:', obj.mafOptions.consequences)
	}

	if (!obj.cnvOptions) {
		obj.cnvOptions = {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			segLength: 2000000
		}
	}

	// Initialize checkbox states - MAF checked by default
	obj.dataTypeStates = {
		maf: true,
		cnv: false,
		fusion: false
	}

	// Create the main 2-column, 4-row table for data type options
	const optionsTable = obj.controlDiv
		.append('table')
		.style('width', 'auto')
		.style('border-collapse', 'collapse')
		.style('margin-top', '10px')
		.style('border', '1px solid #ddd')

	// Create table header
	const headerRow = optionsTable.append('tr')

	headerRow
		.append('th')
		.style('width', '200px')
		.style('padding', '12px')
		.style('background-color', '#f8f9fa')
		.style('border', '1px solid #ddd')
		.style('font-weight', 'bold')
		.style('text-align', 'left')
		.text('Data Type')

	headerRow
		.append('th')
		.style('padding', '12px')
		.style('background-color', '#f8f9fa')
		.style('border', '1px solid #ddd')
		.style('font-weight', 'bold')
		.style('text-align', 'left')
		.text('Options')

	// Row 1: MAF (checked by default, shows all the MAF-related options)
	const mafRow = optionsTable.append('tr')

	const mafCheckboxCell = mafRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// MAF checkbox and label
	const mafCheckboxContainer = mafCheckboxCell
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')

	const mafCheckbox = mafCheckboxContainer
		.append('input')
		.attr('type', 'checkbox')
		.attr('id', 'maf-checkbox')
		.property('checked', true) // Checked by default
		.style('margin', '0')
		.style('cursor', 'pointer')

	mafCheckboxContainer
		.append('label')
		.attr('for', 'maf-checkbox')
		.style('cursor', 'pointer')
		.style('font-weight', '500')
		.text('MAF (Mutation)')

	// Add a small indicator showing how many mutation types are available
	const availableTypesCount = generateMutationTypesFromMclass().length
	mafCheckboxContainer
		.append('span')
		.style('font-size', '12px')
		.style('color', '#666')
		.style('margin-left', '8px')
		.text(`(${availableTypesCount} types available)`)

	const mafOptionsCell = mafRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// MAF options container (visible by default since MAF is checked)
	const mafOptionsContainer = mafOptionsCell.append('div').style('display', 'block') // Visible by default
	createMAFOptionsContent(mafOptionsContainer, obj)

	/**
	 * Updated createMAFOptionsContent function using mclass mutation types
	 * Replace your existing function with this version
	 */
	function createMAFOptionsContent(container, obj) {
		// Clear any existing content
		container.selectAll('*').remove()

		// Generate mutation types dynamically from mclass
		const mutationTypesFromMclass = generateMutationTypesFromMclass()
		const mutationTypesByCategory = getMutationTypesByCategory()

		console.log('Available mutation types from mclass:', mutationTypesFromMclass)

		// Create a grid layout for MAF options
		const optionsGrid = container
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto auto')
			.style('gap', '15px')
			.style('margin-top', '10px')
			.style('max-width', 'fit-content')

		// Row 1: Min Total Depth
		const depthContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')

		depthContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '140px')
			.text('Min Total Depth:')

		const depthInput = depthContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions.minTotalDepth || 10)
			.style('width', '80px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		depthInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.minTotalDepth = value
			}
		})

		// Row 1: Min Mutant Allele Count
		const alleleContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')

		alleleContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '160px')
			.text('Min Mutant Allele Count:')

		const alleleInput = alleleContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions.minAltAlleleCount || 2)
			.style('width', '80px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		alleleInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.minAltAlleleCount = value
			}
		})

		// Row 2: Consequences Section - Using Dynamic mclass Types
		const consequencesContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'flex-start') // Changed to flex-start for better alignment
			.style('gap', '8px')
			.style('grid-column', '1 / -1') // Span full width for more space

		consequencesContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '100px')
			.style('margin-top', '4px') // Align with first checkbox
			.text('Consequences:')

		// Initialize consequences with smart defaults from mclass
		if (!obj.mafOptions.consequences) {
			// Default to common protein-coding mutations
			const defaultTypes = ['missense', 'nonsense', 'frameshift']
			obj.mafOptions.consequences = defaultTypes.filter(type => isValidMutationType(type))
			console.log('Initialized default consequences from mclass:', obj.mafOptions.consequences)
		}

		// Create consequences selection area
		const consequencesSelectionDiv = consequencesContainer.append('div').style('flex', '1')

		// Group mutation types by category for better organization
		Object.entries(mutationTypesByCategory).forEach(([category, types]) => {
			if (types.length === 0) return

			// Add category header
			const categoryDiv = consequencesSelectionDiv.append('div').style('margin-bottom', '12px')

			categoryDiv
				.append('div')
				.style('font-size', '13px')
				.style('font-weight', '600')
				.style('color', '#495057')
				.style('margin-bottom', '6px')
				.style('text-transform', 'capitalize')
				.text(`${category} Mutations`)

			// Create checkboxes for this category
			const categoryCheckboxContainer = categoryDiv
				.append('div')
				.style('display', 'grid')
				.style('grid-template-columns', 'repeat(auto-fit, minmax(180px, 1fr))')
				.style('gap', '8px')
				.style('margin-left', '12px')

			types.forEach(mutationType => {
				const checkboxDiv = categoryCheckboxContainer
					.append('div')
					.style('display', 'flex')
					.style('align-items', 'center')
					.style('gap', '6px')
					.style('font-size', '13px')

				const mutationTypeKey = mutationType.displayName.toLowerCase()

				const checkbox = checkboxDiv
					.append('input')
					.attr('type', 'checkbox')
					.attr('id', `consequence-${mutationTypeKey}`)
					.property('checked', obj.mafOptions.consequences.includes(mutationTypeKey))
					.style('margin', '0')
					.style('cursor', 'pointer')

				const label = checkboxDiv
					.append('label')
					.attr('for', `consequence-${mutationTypeKey}`)
					.style('cursor', 'pointer')
					.style('font-size', '13px')
					.style('color', '#333')
					.text(mutationType.displayName)
					.attr('title', mutationType.description) // Tooltip with description

				// Add mclass constant indicator (for debugging/reference)
				if (process.env.NODE_ENV === 'development') {
					label
						.append('span')
						.style('font-size', '10px')
						.style('color', '#999')
						.style('margin-left', '4px')
						.text(`(${mutationType.mclassValue})`)
				}

				// Add change handler
				checkbox.on('change', function (this: HTMLInputElement) {
					const isChecked = this.checked
					if (isChecked) {
						// Add to consequences if not already present
						if (!obj.mafOptions.consequences.includes(mutationTypeKey)) {
							obj.mafOptions.consequences.push(mutationTypeKey)
						}
					} else {
						// Remove from consequences
						obj.mafOptions.consequences = obj.mafOptions.consequences.filter(c => c !== mutationTypeKey)
					}
					console.log('Updated consequences:', obj.mafOptions.consequences)
					console.log(
						'Corresponding mclass values:',
						obj.mafOptions.consequences.map(c => getMclassConstant(c))
					)
				})
			})
		})

		// Add helper text explaining the mutation types
		consequencesSelectionDiv
			.append('div')
			.style('margin-top', '8px')
			.style('padding', '8px')
			.style('background-color', '#f8f9fa')
			.style('border-radius', '4px')
			.style('border-left', '3px solid #6c757d')
			.style('font-size', '12px')
			.style('color', '#495057')
			.style('line-height', '1.4').html(`
				<strong>Mutation Types:</strong> Select the types of mutations to include in your analysis. 
				Hover over each option to see detailed descriptions. These correspond to standard MAF consequence types.
			`)

		// Row 3: Hypermutator Max Cut Off
		const hyperContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')

		hyperContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '160px')
			.text('Hypermutator Max Cut Off:')

		const hyperInput = hyperContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '100')
			.attr('value', obj.mafOptions.hypermutatorMaxCutoff || 8000)
			.style('width', '70px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		hyperInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.hypermutatorMaxCutoff = value
			}
		})

		// Row 4: Workflow Type (read-only display)
		const workflowContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1') // Span full width

		workflowContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '100px')
			.text('Workflow Type:')

		workflowContainer
			.append('span')
			.style('font-size', '14px')
			.style('color', '#666')
			.text('Aliquot Ensemble Somatic Variant Merging and Masking')

		// Row 5: Dedup (placeholder with clickable link)
		const dedupContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1') // Span full width

		dedupContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '100px')
			.text('Deduplication:')

		// Create the dedup status area (this will be updated when files are loaded)
		const dedupStatus = dedupContainer
			.append('span')
			.attr('id', 'dedup-status')
			.style('font-size', '14px')
			.style('color', '#666')

		// Initial placeholder text
		dedupStatus.text('File deduplication status will appear here after loading files')

		// Store reference for later updates
		obj.dedupStatusElement = dedupStatus
	}

	// Row 2: CNV (unchecked by default)
	const cnvRow = optionsTable.append('tr')

	const cnvCheckboxCell = cnvRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	const cnvCheckboxContainer = cnvCheckboxCell
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')

	const cnvCheckbox = cnvCheckboxContainer
		.append('input')
		.attr('type', 'checkbox')
		.attr('id', 'cnv-checkbox')
		.property('checked', true) // Unchecked by default
		.style('margin', '0')
		.style('cursor', 'pointer')

	cnvCheckboxContainer
		.append('label')
		.attr('for', 'cnv-checkbox')
		.style('cursor', 'pointer')
		.style('font-weight', '500')
		.text('CNV (Copy Number)')

	const cnvOptionsCell = cnvRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// CNV options container (hidden by default since CNV is unchecked)
	const cnvOptionsContainer = cnvOptionsCell.append('div').style('display', 'block') // Visible by default
	createCNVOptionsContent(cnvOptionsContainer, obj)

	function createCNVOptionsContent(container, obj) {
		// Clear any existing content
		container.selectAll('*').remove()

		// Initialize CNV data type if not exists
		if (!obj.cnvOptions.dataType) {
			obj.cnvOptions.dataType = 'segment_mean' // default selection
		}

		// Create a grid layout for CNV options
		const optionsGrid = container
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto auto')
			.style('gap', '15px')
			.style('margin-top', '10px')
			.style('max-width', 'fit-content')

		// Row 0: Data Type (spans full width)
		const dataTypeContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1') // Span full width

		dataTypeContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '80px')
			.text('Data Type:')

		const radioContainer = dataTypeContainer
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '6px')

		const segmentMeanRadio = radioContainer
			.append('input')
			.attr('type', 'radio')
			.attr('id', 'cnv-segment-mean')
			.attr('name', 'cnv-data-type')
			.attr('value', 'segment_mean')
			.property('checked', obj.cnvOptions.dataType === 'segment_mean')
			.style('margin', '0')
			.style('cursor', 'pointer')

		radioContainer
			.append('label')
			.attr('for', 'cnv-segment-mean')
			.style('cursor', 'pointer')
			.style('font-size', '14px')
			.style('color', '#333')
			.text('Segment mean')

		// Add change handler for radio button
		segmentMeanRadio.on('change', function (this: HTMLInputElement) {
			if (this.checked) {
				obj.cnvOptions.dataType = this.value
				console.log('CNV data type updated:', obj.cnvOptions.dataType)
			}
		})

		// Row 1: Loss Threshold
		const lossContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')

		lossContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '120px')
			.text('Loss Threshold:')

		const lossInput = lossContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '-10')
			.attr('max', '0')
			.attr('step', '0.1')
			.attr('value', obj.cnvOptions.lossThreshold || -0.4)
			.style('width', '70px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		// Add input handler
		lossInput.on('input', function (this: HTMLInputElement) {
			const value = parseFloat(this.value)
			if (!isNaN(value) && value <= 0) {
				obj.cnvOptions.lossThreshold = value
			}
		})

		// Row 1: Gain Threshold
		const gainContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')

		gainContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '120px')
			.text('Gain Threshold:')

		const gainInput = gainContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('max', '10')
			.attr('step', '0.1')
			.attr('value', obj.cnvOptions.gainThreshold || 0.3)
			.style('width', '70px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		// Add input handler
		gainInput.on('input', function (this: HTMLInputElement) {
			const value = parseFloat(this.value)
			if (!isNaN(value) && value >= 0) {
				obj.cnvOptions.gainThreshold = value
			}
		})

		// Row 2: Segment Length Cutoff (spans full width)
		const segmentContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1') // Span full width

		segmentContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '140px')
			.text('Segment Length Cutoff:')

		const segmentInput = segmentContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('max', '2000000')
			.attr('step', '1000')
			.attr('value', obj.cnvOptions.segLength || 2000000)
			.style('width', '100px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		// Add input handler
		segmentInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.cnvOptions.segLength = value
			}
		})

		segmentContainer.append('span').style('font-size', '13px').style('color', '#666').text('bp')

		// Row 4: Help/Info section (spans full width)
		const helpContainer = optionsGrid
			.append('div')
			.style('grid-column', '1 / -1') // Span full width
			.style('margin-top', '8px')
			.style('padding', '8px')
			.style('background-color', '#f8f9fa')
			.style('border-radius', '4px')
			.style('border-left', '3px solid #6c757d')

		helpContainer.append('div').style('font-size', '12px').style('color', '#495057').style('line-height', '1.4').html(`
			<strong>CNV Thresholds:</strong><br>
			• Loss Threshold: Log2 ratio for copy number loss (negative values)<br>
			• Gain Threshold: Log2 ratio for copy number gain (positive values)<br>
			• Segment Length: Maximum CNV segment size to include (focal events only)
		`)
	}

	// Row 3: Fusion (unchecked by default)
	const fusionRow = optionsTable.append('tr')

	const fusionCheckboxCell = fusionRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	const fusionCheckboxContainer = fusionCheckboxCell
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')

	const fusionCheckbox = fusionCheckboxContainer
		.append('input')
		.attr('type', 'checkbox')
		.attr('id', 'fusion-checkbox')
		.property('checked', false) // Unchecked by default
		.style('margin', '0')
		.style('cursor', 'pointer')

	fusionCheckboxContainer
		.append('label')
		.attr('for', 'fusion-checkbox')
		.style('cursor', 'pointer')
		.style('font-weight', '500')
		.text('Fusion')

	const fusionOptionsCell = fusionRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// Fusion options container (hidden by default)
	const fusionOptionsContainer = fusionOptionsCell.append('div').style('display', 'none') // Hidden by default

	fusionOptionsContainer
		.append('div')
		.style('color', '#666')
		.style('font-style', 'italic')
		.text('Fusion analysis options will be configured here')

	// Row 4: GRIN2 (unchecked by default)
	const grin2Row = optionsTable.append('tr')

	const grin2CheckboxCell = grin2Row
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	grin2CheckboxCell.append('div').style('font-weight', '500').style('color', '#333').text('GRIN2 Analysis')

	const grin2OptionsCell = grin2Row
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// GRIN2 options container (hidden by default)
	const grin2OptionsContainer = grin2OptionsCell.append('div').style('display', 'inline')

	grin2OptionsContainer
		.append('div')
		.style('color', '#666')
		.style('font-style', 'plain')
		.text('GRIN2 analysis options will be configured here')

	// Add checkbox change handlers (basic show/hide functionality)
	mafCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.maf = isChecked
		mafOptionsContainer.style('display', isChecked ? 'block' : 'none')
	})

	cnvCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.cnv = isChecked
		cnvOptionsContainer.style('display', isChecked ? 'block' : 'none')

		// Create CNV options content when checkbox is checked for the first time
		if (isChecked) {
			createCNVOptionsContent(cnvOptionsContainer, obj)
		}
	})

	fusionCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.fusion = isChecked
		fusionOptionsContainer.style('display', isChecked ? 'block' : 'none')
	})

	// Store references for easy access later
	obj.mafOptionsContainer = mafOptionsContainer
	obj.cnvOptionsContainer = cnvOptionsContainer
	obj.fusionOptionsContainer = fusionOptionsContainer
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

		// Update the dedup status in MAF options
		if (result.deduplicationStats) {
			updateDedupStatus(obj, result.deduplicationStats)
		}
		// render
		if (result.filesTotal > result.files.length) {
			wait.text(
				`Showing first ${result.files.length.toLocaleString()} files out of ${result.filesTotal.toLocaleString()} total.`
			)
		} else {
			wait.text(`Showing ${result.files.length.toLocaleString()} files.`)
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
				minAltAlleleCount: obj.mafOptions.minAltAlleleCount,
				consequences: obj.mafOptions.consequences
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

			if (response.rustResult) {
				console.log('[GRIN2] rustResult received:', response.rustResult)
				console.log('[GRIN2] Summary:', response.rustResult.summary)
				console.log('[GRIN2] Failed files:', response.rustResult.failed_files)
				console.log('[GRIN2] Successful data arrays:', response.rustResult.successful_data?.length)
			} else {
				console.log('[GRIN2] No rustResult in response')
			}

			// Handle the structured Rust output
			const rustData = response.rustResult
			let failedFilesInfo: any = null

			// Parse the rustResult if it's a string
			let parsedRustResult
			let processedData: any[] = []

			try {
				parsedRustResult = typeof rustData === 'string' ? JSON.parse(rustData) : rustData
				console.log(`[GRIN2] Parsed Rust result structure received`)
				console.log(`[GRIN2] Parsed Rust result:`, parsedRustResult)

				// Handle the new structured output
				if (parsedRustResult) {
					// Check if it's the new structured format
					if (parsedRustResult.successful_data && parsedRustResult.summary) {
						console.log(`[GRIN2] New format detected - Processing ${parsedRustResult.summary.total_files} files`)
						console.log(
							`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
						)

						// Flatten all successful data arrays into one array - THIS GOES TO R
						processedData = parsedRustResult.successful_data.flat()

						console.log(`[GRIN2] parsedRustResult structure:`, parsedRustResult)

						// Process failed files information for UI display
						if (parsedRustResult.failed_files && parsedRustResult.failed_files.length > 0) {
							failedFilesInfo = {
								count: parsedRustResult.failed_files.length,
								files: parsedRustResult.failed_files,
								// Create table data for UI display (similar to your deduplication/filter tables)
								tableData: {
									headers: ['Case ID', 'Data Type', 'Error Type', 'Error Details', 'Attempts'],
									rows: parsedRustResult.failed_files.map(file => [
										file.case_id,
										file.data_type,
										file.error_type,
										file.error_details,
										file.attempts_made.toString()
									])
								},
								// Error summary for the popup
								errorSummary: {
									connectionErrors: parsedRustResult.failed_files.filter(f => f.error_type === 'connection_error')
										.length,
									timeoutErrors: parsedRustResult.failed_files.filter(f => f.error_type === 'timeout_error').length,
									serverErrors: parsedRustResult.failed_files.filter(f => f.error_type === 'server_error').length,
									otherErrors: parsedRustResult.failed_files.filter(
										f => !['connection_error', 'timeout_error', 'server_error'].includes(f.error_type)
									).length
								}
							}

							console.log(`[GRIN2] ${failedFilesInfo.count} files failed - error details prepared for UI`)
						}
					}

					console.log(`[GRIN2] Final processed data contains ${processedData.length} records`)
				}
			} catch (parseError) {
				console.error('[GRIN2] Error parsing Rust result:', parseError)
				// Set empty defaults on parse error
				processedData = []
				failedFilesInfo = null
			}

			// Always show file download summary if we have rustResult data
			if (parsedRustResult && parsedRustResult.summary) {
				// Create the summary info div (similar to deduplication div)
				if (!obj.failedFilesInfoDiv) {
					obj.failedFilesInfoDiv = obj.resultDiv.append('div')
				}

				obj.failedFilesInfoDiv.selectAll('*').remove()

				const summaryDiv = obj.failedFilesInfoDiv
					.append('div')
					.style('background-color', failedFilesInfo && failedFilesInfo.count > 0 ? '#fff3f3' : '#f0f8ff')
					.style('border', failedFilesInfo && failedFilesInfo.count > 0 ? '1px solid #f5c6cb' : '1px solid #87ceeb')
					.style('border-radius', '4px')
					.style('padding', '12px')
					.style('margin', '10px 0 20px 0')
					.style('max-width', '100%')
					.style('width', 'fit-content')

				// Header with appropriate icon and color
				const headerIcon = failedFilesInfo && failedFilesInfo.count > 0 ? '⚠️' : '✅'
				const headerColor = failedFilesInfo && failedFilesInfo.count > 0 ? '#721c24' : '#2c5aa0'
				const headerText =
					failedFilesInfo && failedFilesInfo.count > 0
						? 'File Download Summary (Some Files Failed)'
						: 'File Download Summary (All Files Successful)'

				summaryDiv
					.append('div')
					.style('font-weight', 'bold')
					.style('color', headerColor)
					.style('margin-bottom', '8px')
					.text(`${headerIcon} ${headerText}`)

				// Build description based on summary data
				const totalAttempted = parsedRustResult.summary.total_files
				const successful = parsedRustResult.summary.successful_files
				const failed = parsedRustResult.summary.failed_files

				let descriptionText = `Downloaded <strong>${successful}</strong> of <strong>${totalAttempted}</strong> files successfully`

				if (failed > 0) {
					descriptionText += `. <strong>${failed}</strong> files failed to download and were excluded from analysis.`
				} else {
					descriptionText += `. All files downloaded without issues.`
				}

				summaryDiv
					.append('div')
					.style('margin-bottom', '8px')
					.style('font-size', '14px')
					.style('color', headerColor)
					.html(descriptionText)

				// Add clickable link to view failed files (only if there are failures)
				if (failedFilesInfo && failedFilesInfo.count > 0) {
					summaryDiv
						.append('div')
						.append('a')
						.style('color', headerColor)
						.style('text-decoration', 'underline')
						.style('cursor', 'pointer')
						.style('font-size', '13px')
						.text('View failed files details')
						.on('click', function () {
							gdcGrin2ShowFailedFilesPopup(failedFilesInfo)
						})
				} else {
					// Optional: Add a message for successful downloads
					summaryDiv
						.append('div')
						.style('font-size', '13px')
						.style('color', '#666')
						.style('font-style', 'italic')
						.text('All files processed successfully for analysis.')
				}
			}

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
						tooltip: 'Gene name'
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

				// Add note about full results if truncated
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
	}
}

function updateDedupStatus(obj, deduplicationStats) {
	if (!obj.dedupStatusElement) return

	const dedupElement = obj.dedupStatusElement
	dedupElement.selectAll('*').remove() // Clear existing content

	if (!deduplicationStats) {
		dedupElement.style('color', '#666').text('No deduplication data available')
		return
	}

	// Create a container for the detailed dedup info
	const dedupContainer = dedupElement
		.append('div')
		.style('display', 'flex')
		.style('flex-direction', 'column')
		.style('gap', '8px')

	const duplicatesRemoved = deduplicationStats.duplicatesRemoved || 0
	const sizeFilteredCount = deduplicationStats.filteredFiles ? deduplicationStats.filteredFiles.length : 0
	const totalExcluded = duplicatesRemoved + sizeFilteredCount
	const originalTotal = deduplicationStats.originalFileCount + sizeFilteredCount

	if (totalExcluded > 0) {
		// Summary line
		const summaryDiv = dedupContainer
			.append('div')
			.style('font-size', '14px')
			.style('color', '#d84315')
			.style('font-weight', '500')

		summaryDiv.html(
			`Found <strong>${originalTotal}</strong> total MAF files, excluded <strong>${totalExcluded}</strong>`
		)

		// Details line
		const detailsDiv = dedupContainer.append('div').style('font-size', '13px').style('color', '#666')

		const exclusionDetails: string[] = []
		if (duplicatesRemoved > 0) {
			exclusionDetails.push(`${duplicatesRemoved} duplicates from same cases`)
		}
		if (sizeFilteredCount > 0) {
			exclusionDetails.push(`${sizeFilteredCount} files too large`)
		}

		detailsDiv.text(`(${exclusionDetails.join(' and ')})`)

		// Final result line
		const resultDiv = dedupContainer
			.append('div')
			.style('font-size', '13px')
			.style('color', '#28a745')
			.style('font-weight', '500')

		resultDiv.html(`Showing <strong>${deduplicationStats.deduplicatedFileCount}</strong> unique cases`)
		if (duplicatesRemoved > 0) {
			resultDiv.append('span').style('color', '#666').style('font-weight', 'normal').text(' (largest file per case)')
		}

		// Add clickable link to view excluded files
		if (totalExcluded > 0) {
			const linkDiv = dedupContainer.append('div').style('margin-top', '4px')

			linkDiv
				.append('a')
				.style('color', '#2c5aa0')
				.style('text-decoration', 'underline')
				.style('cursor', 'pointer')
				.style('font-size', '12px')
				.text('View excluded files details')
				.on('click', function () {
					gdcGrin2ShowDeduplicationPopup(deduplicationStats)
				})
		}
	} else {
		// No exclusions
		dedupContainer
			.append('div')
			.style('color', '#28a745')
			.style('font-weight', '500')
			.style('font-size', '14px')
			.html(`All <strong>${deduplicationStats.deduplicatedFileCount}</strong> files included`)

		dedupContainer
			.append('div')
			.style('color', '#666')
			.style('font-size', '13px')
			.text('No duplicates or oversized files found')
	}
}
