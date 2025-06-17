/*
================================================================================
GRIN2 UI Module - Genomic Data Analysis Interface
================================================================================
A comprehensive UI for listing and analyzing genomic files (MAF, CNV, Fusion)
from GDC cohorts, with GRIN2 analysis capabilities and result visualization.

Author: PP Team
================================================================================
*/

import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror } from '#dom'
import { select } from 'd3-selection'
import { formatElapsedTime } from '@sjcrh/proteinpaint-shared/time.js'
import type { GdcGRIN2listRequest } from '#types'
import { mclass, dtsnvindel, class2SOterm, bplen } from '@sjcrh/proteinpaint-shared/common.js'

// ================================================================================
// TYPE DEFINITIONS, INTERFACES, & DEFAULTS
// ================================================================================

// Interface for table row item
interface TableRowItem {
	html?: string
	value?: any
}

const defaultMAFclasses = [
	'M',
	'F',
	'N',
	'StopLost',
	'StartLost',
	'L',
	'I',
	'D',
	'ProteinAltering',
	'P',
	'E',
	'S',
	'Intron',
	'Utr3',
	'Utr5',
	'noncoding',
	'snv',
	'mnv',
	'insertion',
	'deletion'
]

const skipMAFclasses = ['WT', 'Blank', 'X']

// ================================================================================
// UI COMPONENT BUILDERS
// ================================================================================

/**
 * Adds expandable failed files section to any stats container
 * @param statsContainer - The stats container to append the expandable section to
 * @param failedFilesInfo - Object containing failed files data and error summaries
 */
function addExpandableFailedFilesToStats(statsContainer, failedFilesInfo) {
	// Create expandable container for failed files
	const expandableContainer = statsContainer.append('div').style('margin-top', '12px')

	// Create clickable header
	const expandableHeader = expandableContainer
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')
		.style('cursor', 'pointer')
		.style('padding', '8px')
		.style('border-radius', '4px')
		.style('transition', 'background-color 0.2s')
		.style('background-color', 'rgba(220, 53, 69, 0.1)')
		.style('border', '1px solid rgba(220, 53, 69, 0.2)')
		.on('mouseenter', function (this: HTMLElement) {
			select(this).style('background-color', 'rgba(220, 53, 69, 0.15)')
		})
		.on('mouseleave', function (this) {
			select(this).style('background-color', 'rgba(220, 53, 69, 0.1)')
		})

	// Expand/collapse icon
	const expandIcon = expandableHeader
		.append('span')
		.style('font-size', '12px')
		.style('color', '#dc3545')
		.style('transition', 'transform 0.2s')
		.text('▶')

	// Clickable text
	expandableHeader
		.append('span')
		.style('color', '#dc3545')
		.style('text-decoration', 'underline')
		.style('font-size', '13px')
		.style('font-weight', '500')
		.text(`View ${failedFilesInfo.count} failed files details`)

	// Error summary text (visible by default)
	if (failedFilesInfo.errorSummary) {
		const { errorSummary } = failedFilesInfo
		const summaryItems: string[] = []

		if (errorSummary.connectionErrors > 0) {
			summaryItems.push(`${errorSummary.connectionErrors} connection`)
		}
		if (errorSummary.timeoutErrors > 0) {
			summaryItems.push(`${errorSummary.timeoutErrors} timeout`)
		}
		if (errorSummary.serverErrors > 0) {
			summaryItems.push(`${errorSummary.serverErrors} server`)
		}
		if (errorSummary.otherErrors > 0) {
			summaryItems.push(`${errorSummary.otherErrors} other`)
		}

		if (summaryItems.length > 0) {
			expandableHeader
				.append('span')
				.style('margin-left', '8px')
				.style('font-size', '12px')
				.style('color', '#666')
				.style('font-weight', 'normal')
				.text(`(${summaryItems.join(', ')})`)
		}
	}

	// Create expandable content (hidden by default)
	const expandableContent = expandableContainer
		.append('div')
		.style('display', 'none')
		.style('margin-top', '12px')
		.style('padding', '12px')
		.style('background-color', '#fff')
		.style('border', '1px solid #f5c6cb')
		.style('border-radius', '4px')
		.style('box-shadow', 'inset 0 1px 3px rgba(0, 0, 0, 0.1)')

	// Failed files table section (no error summary box)
	const tableSection = expandableContent.append('div')

	tableSection
		.append('h6')
		.style('margin', '0 0 12px 0')
		.style('color', '#721c24')
		.style('font-size', '14px')
		.style('font-weight', 'bold')
		.text('Failed Files Details')

	// Create table container with max height and scroll
	const tableContainer = tableSection
		.append('div')
		.style('max-height', '300px')
		.style('overflow-y', 'auto')
		.style('border', '1px solid #dee2e6')
		.style('border-radius', '4px')

	// Render the failed files table using existing renderTable function
	renderTable({
		div: tableContainer,
		columns: failedFilesInfo.tableData.headers.map(header => ({
			label: header,
			sortable: true
		})),
		rows: failedFilesInfo.tableData.rows.map(row => row.map(cell => ({ value: cell }))),
		showLines: true,
		striped: true,
		showHeader: true,
		maxHeight: '280px',
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

	// Add explanatory text
	expandableContent
		.append('div')
		.style('margin-top', '12px')
		.style('padding', '8px')
		.style('background-color', '#f8f9fa')
		.style('border-radius', '4px')
		.style('font-size', '12px')
		.style('color', '#495057')
		.style('line-height', '1.4')
		.text('These files could not be downloaded due to network or server issues and were excluded from the analysis.')

	// Track expanded state
	let isExpanded = false

	// Add click handler for expand/collapse
	expandableHeader.on('click', function () {
		isExpanded = !isExpanded

		if (isExpanded) {
			// Expand
			expandableContent.style('display', 'block')
			expandIcon.style('transform', 'rotate(90deg)').text('▼')
		} else {
			// Collapse
			expandableContent.style('display', 'none')
			expandIcon.style('transform', 'rotate(0deg)').text('▶')
		}
	})
}

/**
 * Creates an expandable deduplication section inline with multi-column layout
 * @param container - The container to append the expandable section to
 * @param deduplicationStats - Object containing deduplication data
 */
function createExpandableDeduplicationSection(container, deduplicationStats) {
	const duplicatesRemoved = deduplicationStats.duplicatesRemoved || 0
	const sizeFilteredCount = deduplicationStats.filteredFiles ? deduplicationStats.filteredFiles.length : 0
	const totalExcluded = duplicatesRemoved + sizeFilteredCount

	if (totalExcluded === 0) {
		// No exclusions - just show success message
		return
	}

	// Create expandable container for excluded files
	const expandableContainer = container.append('div').style('margin-top', '8px')

	// Create clickable header
	const expandableHeader = expandableContainer
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '8px')
		.style('cursor', 'pointer')
		.style('padding', '6px 8px')
		.style('border-radius', '4px')
		.style('transition', 'background-color 0.2s')
		.style('background-color', 'rgba(216, 67, 21, 0.1)') // Orange theme for deduplication
		.style('border', '1px solid rgba(216, 67, 21, 0.2)')
		.on('mouseenter', function (this: HTMLElement) {
			select(this).style('background-color', 'rgba(216, 67, 21, 0.15)')
		})
		.on('mouseleave', function (this: HTMLElement) {
			select(this).style('background-color', 'rgba(216, 67, 21, 0.1)')
		})

	// Expand/collapse icon
	const expandIcon = expandableHeader
		.append('span')
		.style('font-size', '12px')
		.style('color', '#d84315')
		.style('transition', 'transform 0.2s')
		.text('▶')

	// Clickable text
	expandableHeader
		.append('span')
		.style('color', '#d84315')
		.style('text-decoration', 'underline')
		.style('font-size', '12px')
		.style('font-weight', '500')
		.text('View excluded files details')

	// Summary text (visible by default)
	const exclusionDetails: string[] = []
	if (duplicatesRemoved > 0) {
		exclusionDetails.push(`${duplicatesRemoved} duplicates`)
	}
	if (sizeFilteredCount > 0) {
		exclusionDetails.push(`${sizeFilteredCount} oversized`)
	}

	if (exclusionDetails.length > 0) {
		expandableHeader
			.append('span')
			.style('margin-left', '8px')
			.style('font-size', '11px')
			.style('color', '#666')
			.style('font-weight', 'normal')
			.text(`(${exclusionDetails.join(', ')})`)
	}

	// Create expandable content
	const expandableContent = expandableContainer
		.append('div')
		.style('display', 'none')
		.style('margin-top', '8px')
		.style('padding', '12px')
		.style('background-color', '#fff')
		.style('border', '1px solid rgba(216, 67, 21, 0.3)')
		.style('border-radius', '4px')
		.style('box-shadow', 'inset 0 1px 3px rgba(0, 0, 0, 0.1)')
		.style('max-height', '400px')
		.style('overflow-y', 'auto')

	// Section 1: Duplicate Files Removed
	if (deduplicationStats.caseDetails && deduplicationStats.caseDetails.length > 0) {
		const duplicatesSection = expandableContent.append('div').style('margin-bottom', '16px')

		duplicatesSection
			.append('h6')
			.style('margin', '0 0 8px 0')
			.style('color', '#d84315')
			.style('font-size', '13px')
			.style('font-weight', 'bold')
			.text('Duplicate Files Removed')

		duplicatesSection
			.append('p')
			.style('margin', '0 0 12px 0')
			.style('font-size', '12px')
			.style('color', '#666')
			.text(`${deduplicationStats.duplicatesRemoved} duplicate files were removed (largest file kept for each case)`)

		// Create multi-column container for duplicate cases
		const duplicatesCasesContainer = duplicatesSection
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(auto-fill, minmax(300px, 1fr))')
			.style('gap', '8px')

		deduplicationStats.caseDetails.forEach(caseInfo => {
			const caseDiv = duplicatesCasesContainer
				.append('div')
				.style('padding', '6px 8px')
				.style('background-color', '#fff3e0')
				.style('border-radius', '3px')
				.style('border-left', '3px solid #ff9800')

			caseDiv
				.append('div')
				.style('font-size', '12px')
				.style('color', '#333')
				.style('line-height', '1.3')
				.html(
					`<strong>Case ${caseInfo.caseName}:</strong> Found ${caseInfo.fileCount} MAF files, keeping largest (${bplen(
						caseInfo.keptFileSize
					)})`
				)
		})
	}

	// Section 2: Size-Filtered Files
	if (deduplicationStats.filteredFiles && deduplicationStats.filteredFiles.length > 0) {
		// Add separator if we have both sections
		if (deduplicationStats.caseDetails && deduplicationStats.caseDetails.length > 0) {
			expandableContent
				.append('hr')
				.style('margin', '12px 0')
				.style('border', 'none')
				.style('border-top', '1px solid #e0e0e0')
		}

		const sizeFilterSection = expandableContent.append('div')

		sizeFilterSection
			.append('h6')
			.style('margin', '0 0 8px 0')
			.style('color', '#c62828')
			.style('font-size', '13px')
			.style('font-weight', 'bold')
			.text('Files Excluded by Size')

		sizeFilterSection
			.append('p')
			.style('margin', '0 0 12px 0')
			.style('font-size', '12px')
			.style('color', '#666')
			.text(`${deduplicationStats.filteredFiles.length} files were excluded for being too large (>${bplen(1000000)})`)

		// Create multi-column container for oversized files
		const oversizedFilesContainer = sizeFilterSection
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'repeat(auto-fill, minmax(280px, 1fr))')
			.style('gap', '8px')

		deduplicationStats.filteredFiles.forEach(fileInfo => {
			const fileDiv = oversizedFilesContainer
				.append('div')
				.style('padding', '6px 8px')
				.style('background-color', '#ffebee')
				.style('border-radius', '3px')
				.style('border-left', '3px solid #f44336')

			fileDiv
				.append('div')
				.style('font-size', '11px')
				.style('color', '#333')
				.style('margin-bottom', '2px')
				.style('line-height', '1.2')
				.html(`<strong>File ID:</strong> ${fileInfo.fileId}`)

			fileDiv
				.append('div')
				.style('font-size', '10px')
				.style('color', '#666')
				.style('line-height', '1.2')
				.text(`Size: ${bplen(fileInfo.fileSize)} - ${fileInfo.reason}`)
		})
	}

	// Add explanatory text
	expandableContent
		.append('div')
		.style('margin-top', '12px')
		.style('padding', '6px 8px')
		.style('background-color', '#f8f9fa')
		.style('border-radius', '4px')
		.style('font-size', '11px')
		.style('color', '#495057')
		.style('line-height', '1.3')
		.text('Files are filtered to ensure optimal performance and avoid duplicates.')

	// Track expanded state
	let isExpanded = false

	// Add click handler for expand/collapse
	expandableHeader.on('click', function () {
		isExpanded = !isExpanded

		if (isExpanded) {
			// Expand
			expandableContent.style('display', 'block')
			expandIcon.style('transform', 'rotate(90deg)').text('▼')
		} else {
			// Collapse
			expandableContent.style('display', 'none')
			expandIcon.style('transform', 'rotate(0deg)').text('▶')
		}
	})
}

/**
 * Updates deduplication status display in MAF options section
 * Shows summary of file filtering and provides expandable details
 *
 * @param obj - Main application object containing UI references
 * @param deduplicationStats - Statistics from backend deduplication process
 */
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
		.style('gap', '6px')

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

		// Add inline expandable section instead of popup link
		createExpandableDeduplicationSection(dedupContainer, deduplicationStats)
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

// ================================================================================
// MAIN UI BUILDERS
// ================================================================================

/**
 * Creates the main data type options table with MAF, CNV, and Fusion sections
 * Builds the primary configuration interface for analysis parameters
 *
 * @param obj - Main application object containing state and UI references
 */
function makeControls(obj) {
	if (!obj.mafOptions) {
		obj.mafOptions = {
			minTotalDepth: 10,
			minAltAlleleCount: 2,
			consequences: [],
			hyperMutator: 8000
		}
	}
	if (!obj.cnvOptions) {
		obj.cnvOptions = {
			lossThreshold: -0.4,
			gainThreshold: 0.3,
			segLength: 0
		}
	}

	obj.dataTypeStates = {
		maf: true,
		cnv: true,
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
		.property('checked', true)
		.style('margin', '0')
		.style('cursor', 'pointer')

	mafCheckboxContainer
		.append('label')
		.attr('for', 'maf-checkbox')
		.style('cursor', 'pointer')
		.style('font-weight', '500')
		.text('MAF (Mutation)')

	const mafOptionsCell = mafRow
		.append('td')
		.style('padding', '12px')
		.style('border', '1px solid #ddd')
		.style('vertical-align', 'top')

	// MAF options container
	const mafOptionsContainer = mafOptionsCell.append('div').style('display', 'block')
	createMAFOptionsContent(mafOptionsContainer, obj)

	// createMAFOptionsContent function using mclass mutation types
	function createMAFOptionsContent(container, obj) {
		// Clear any existing content
		container.selectAll('*').remove()

		// Create a grid layout for MAF options
		const optionsGrid = container
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', 'auto auto')
			.style('gap', '15px')
			.style('margin-top', '10px')
			.style('max-width', 'fit-content')

		// Reusable styles for the row elements
		const styles = {
			flexRow: 'display: flex; align-items: center; gap: 8px;',
			label: 'font-size: 14px; font-weight: 500;',
			input: 'padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;'
		}

		// Row 1: Min Total Depth
		const depthContainer = optionsGrid.append('div').attr('style', styles.flexRow)

		depthContainer
			.append('label')
			.attr('style', styles.label + ' min-width: 140px;')
			.text('Min Total Depth:')

		const depthInput = depthContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions.minTotalDepth || 10)
			.attr('style', styles.input + ' width: 80px;')

		depthInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.minTotalDepth = value
			}
		})

		// Row 1: Min Mutant Allele Count
		const alleleContainer = optionsGrid.append('div').attr('style', styles.flexRow)

		alleleContainer
			.append('label')
			.attr('style', styles.label + ' min-width: 160px;')
			.text('Min Mutant Allele Count:')

		const alleleInput = alleleContainer
			.append('input')
			.attr('type', 'number')
			.attr('min', '0')
			.attr('step', '1')
			.attr('value', obj.mafOptions.minAltAlleleCount || 2)
			.attr('style', styles.input + ' width: 80px;')

		alleleInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.minAltAlleleCount = value
			}
		})

		// Row 2: Consequences Section
		const consequencesContainer = optionsGrid
			.append('div')
			.attr('style', 'display: flex; align-items: flex-start; gap: 8px; grid-column: 1 / -1;')

		consequencesContainer
			.append('label')
			.attr('style', 'font-size: 14px; font-weight: 500; min-width: 100px; margin-top: 4px;')
			.text('Consequences:')

		// Create consequences selection area
		const consequencesSelectionDiv = consequencesContainer.append('div').attr('style', 'flex: 1;')

		// Create checkbox container with grid layout
		const checkboxContainer = consequencesSelectionDiv
			.append('div')
			.attr(
				'style',
				'display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px;'
			)

		// Direct iteration through mclass
		for (const cls in mclass) {
			// Skip if not SNV/indel
			if (mclass[cls].dt !== dtsnvindel) continue
			// Skip any classes defined in skipMAFclasses
			if (skipMAFclasses.includes(cls)) continue

			// Create checkbox div
			const checkboxDiv = checkboxContainer
				.append('div')
				.attr('style', 'display: flex; align-items: center; gap: 6px; font-size: 13px;')

			// Determine if this should be checked by default
			const isDefaultChecked = defaultMAFclasses.includes(cls)

			// Create checkbox
			const checkbox = checkboxDiv
				.append('input')
				.attr('type', 'checkbox')
				.attr('id', `consequence-${cls}`)
				.property('checked', isDefaultChecked)
				.attr('style', 'margin: 0; cursor: pointer;')

			// If it's checked by default, add it to the consequences array
			if (isDefaultChecked && !obj.mafOptions.consequences.includes(cls)) {
				obj.mafOptions.consequences.push(cls)
			}

			// Create label
			const label = checkboxDiv
				.append('label')
				.attr('for', `consequence-${cls}`)
				.attr('style', 'cursor: pointer; font-size: 13px; color: #333;')
				.attr('title', mclass[cls].desc)

			// Add label text
			label.text(mclass[cls].label)

			// Add change handler
			checkbox.on('change', function (this: HTMLInputElement) {
				const isChecked = this.checked
				if (isChecked) {
					if (!obj.mafOptions.consequences.includes(cls)) {
						obj.mafOptions.consequences.push(cls)
					}
				} else {
					obj.mafOptions.consequences = obj.mafOptions.consequences.filter(c => c !== cls)
				}
			})
		}

		// Add helper text
		consequencesSelectionDiv
			.append('div')
			.attr(
				'style',
				'margin-top: 8px; padding: 8px; background-color: #f8f9fa; border-radius: 4px; border-left: 3px solid #6c757d; font-size: 12px; color: #495057; line-height: 1.4;'
			).html(`
				<strong>Mutation Types:</strong> Select the types of mutations to include in your analysis.
				If none are selected, all mutation types will be included.<br>
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
			.attr('value', obj.mafOptions.hyperMutator || 8000)
			.style('width', '70px')
			.style('padding', '4px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '4px')
			.style('font-size', '14px')

		hyperInput.on('input', function (this: HTMLInputElement) {
			const value = parseInt(this.value, 10)
			if (!isNaN(value) && value >= 0) {
				obj.mafOptions.hyperMutator = value
			}
		})

		// Row 4: Workflow Type (read-only display)
		const workflowContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1')

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

		// Row 5: Dedup status
		const dedupContainer = optionsGrid
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('grid-column', '1 / -1')

		dedupContainer
			.append('label')
			.style('font-size', '14px')
			.style('font-weight', '500')
			.style('min-width', '100px')
			.text('Deduplication:')

		const dedupStatus = dedupContainer
			.append('span')
			.attr('id', 'dedup-status')
			.style('font-size', '14px')
			.style('color', '#666')

		obj.dedupStatusElement = dedupStatus
	}

	// Row 2: CNV options container
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
		.property('checked', true) // Checked by default
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

	// CNV options container
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
			.attr('value', obj.cnvOptions.segLength || 0)
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

		// Row 4: Help/Info section
		const helpContainer = optionsGrid
			.append('div')
			.style('grid-column', '1 / -1')
			.style('margin-top', '8px')
			.style('padding', '8px')
			.style('background-color', '#f8f9fa')
			.style('border-radius', '4px')
			.style('border-left', '3px solid #6c757d')

		helpContainer.append('div').style('font-size', '12px').style('color', '#495057').style('line-height', '1.4').html(`
			<strong>CNV Thresholds:</strong><br>
			• Loss Threshold: Log2 ratio for copy number loss (negative values)<br>
			• Gain Threshold: Log2 ratio for copy number gain (positive values)<br>
			• Segment Length: Maximum CNV segment size to include (no filter if 0)
		`)
	}

	// Row 3: Fusion
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
		.property('checked', false)
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

	// Fusion options container
	const fusionOptionsContainer = fusionOptionsCell.append('div').style('display', 'none')

	fusionOptionsContainer
		.append('div')
		.style('color', '#666')
		.style('font-style', 'italic')
		.text('Fusion analysis options will be configured here')

	// Add checkbox change handlers (basic show/hide functionality)
	mafCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.maf = isChecked
		mafOptionsContainer.style('display', isChecked ? 'block' : 'none')

		// Update submit button state
		if (obj.updateSubmitButtonState) {
			obj.updateSubmitButtonState()
		}
	})

	cnvCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.cnv = isChecked
		cnvOptionsContainer.style('display', isChecked ? 'block' : 'none')

		// Create CNV options content when checkbox is checked for the first time
		if (isChecked) {
			createCNVOptionsContent(cnvOptionsContainer, obj)
		}

		// Update submit button state
		if (obj.updateSubmitButtonState) {
			obj.updateSubmitButtonState()
		}
	})

	fusionCheckbox.on('change', function (this: HTMLInputElement) {
		const isChecked = this.checked
		obj.dataTypeStates.fusion = isChecked
		fusionOptionsContainer.style('display', isChecked ? 'block' : 'none')

		// Update submit button state
		if (obj.updateSubmitButtonState) {
			obj.updateSubmitButtonState()
		}
	})

	// Row 4: GRIN2
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
	// Store references for easy access later
	obj.mafOptionsContainer = mafOptionsContainer
	obj.cnvOptionsContainer = cnvOptionsContainer
	obj.fusionOptionsContainer = fusionOptionsContainer

	// Add submit button after the options table
	const submitButtonContainer = obj.controlDiv
		.append('div')
		.style('margin-top', '2px')
		.style('margin-bottom', '2px')
		.style('text-align', 'left')

	const submitButton = submitButtonContainer
		.append('button')
		.attr('id', 'submit-options-button')
		.style('margin', '10px 10px 0 0') // Same margin as table.ts buttons
		.text('Apply Options & Refresh Files')

	// Store submit button reference for easy access
	obj.submitButton = submitButton

	// Add submit button click handler
	submitButton.on('click', function (this: HTMLButtonElement) {
		if (!this.disabled) {
			// Re-fetch files with current options
			getFilesAndShowTable(obj)
		}
	})

	// Store the update function for use in checkbox handlers
	obj.updateSubmitButtonState = updateSubmitButtonState

	// Initial button state check
	updateSubmitButtonState()

	// Function to update submit button state based on checkbox selections
	function updateSubmitButtonState() {
		const hasAnyDataTypeSelected = obj.dataTypeStates.maf || obj.dataTypeStates.cnv || obj.dataTypeStates.fusion

		if (hasAnyDataTypeSelected) {
			// Enable button
			submitButton.attr('disabled', null).text('Apply Options & Refresh Files')
		} else {
			// Disable button
			submitButton.attr('disabled', true).text('Select at least one data type')
		}
	}

	// Store the update function for use in checkbox handlers
	obj.updateSubmitButtonState = updateSubmitButtonState

	// Initial button state check
	updateSubmitButtonState()
}

// ================================================================================
// DATA FETCHING & TABLE MANAGEMENT
// ================================================================================

/**
 * Fetches available files and renders the selection table
 * Main data loading function that handles file filtering and display
 *
 * @param obj - Main application object containing configuration
 */
async function getFilesAndShowTable(obj) {
	obj.tableDiv.selectAll('*').remove()
	obj.resultDiv.selectAll('*').remove()
	const wait = obj.tableDiv.append('div').style('margin', '30px 10px 10px 10px').text('Loading...')

	let result
	try {
		const body: GdcGRIN2listRequest = {}

		if (obj.opts.filter0) body.filter0 = obj.opts.filter0

		// Always include mafOptions when MAF is selected
		if (obj.dataTypeStates.maf) {
			body.mafOptions = {
				experimentalStrategy: obj.opts.experimentalStrategy || 'WXS'
			}
		}

		// Only include cnvOptions when CNV is selected
		if (obj.dataTypeStates.cnv) {
			body.cnvOptions = {
				dataType: obj.cnvOptions.dataType
			}
		}
		console.log('Request body for GRIN2list:', body)
		result = await dofetch3('gdc/GRIN2list', { body })
		console.log('GRIN2list result:', result)

		// Modified to handle both MAF and CNV files
		if (result.error) throw result.error

		// Validate that we have the expected data structure based on selected data types
		if (obj.dataTypeStates.maf && (!result.mafFiles || !Array.isArray(result.mafFiles.files))) {
			throw 'Invalid response: missing mafFiles.files array'
		}

		if (obj.dataTypeStates.cnv && (!result.cnvFiles || !Array.isArray(result.cnvFiles.files))) {
			throw 'Invalid response: missing cnvFiles.files array'
		}

		// Check if we have any files to work with
		const hasMafFiles = result.mafFiles?.files?.length > 0
		const hasCnvFiles = result.cnvFiles?.files?.length > 0

		if (obj.dataTypeStates.maf && !hasMafFiles) {
			throw 'No MAF files available for the selected criteria.'
		}

		if (obj.dataTypeStates.cnv && !hasCnvFiles) {
			throw 'No CNV files available for the selected criteria.'
		}

		if (!hasMafFiles && !hasCnvFiles) {
			throw 'No files available for the selected data types.'
		}

		// Update the dedup status in MAF options (only if MAF files exist)
		if (result.mafFiles && result.mafFiles.deduplicationStats) {
			updateDedupStatus(obj, result.mafFiles.deduplicationStats)
		}

		// Create CNV files map for lookup
		const cnvFilesByCase = new Map<string, any>()
		if (obj.dataTypeStates.cnv && result.cnvFiles && result.cnvFiles.files) {
			for (const cnvFile of result.cnvFiles.files) {
				const caseId = cnvFile.case_submitter_id
				if (!cnvFilesByCase.has(caseId)) {
					cnvFilesByCase.set(caseId, cnvFile)
				}
			}
		}

		// Filter files based on selected data types and availability
		let filteredFiles = result.mafFiles ? result.mafFiles.files : []
		let filteringMessage = ''

		// Determine which data types are selected
		const mafSelected = obj.dataTypeStates.maf
		const cnvSelected = obj.dataTypeStates.cnv

		// If both MAF and CNV are selected, only include cases that have both
		if (mafSelected && cnvSelected) {
			const originalCount = filteredFiles.length
			filteredFiles = filteredFiles.filter(mafFile => {
				const caseId = mafFile.case_submitter_id
				const hasCnv = cnvFilesByCase.has(caseId)
				return hasCnv
			})
			const filteredCount = filteredFiles.length
			const excludedCount = originalCount - filteredCount

			if (excludedCount > 0) {
				filteringMessage = `Filtered to ${filteredCount} cases with both MAF and CNV files (excluded ${excludedCount} cases with only MAF files)`
			} else {
				filteringMessage = `All ${filteredCount} cases have both MAF and CNV files`
			}
		}
		// If only CNV is selected, filter to cases that have CNV files
		else if (cnvSelected && !mafSelected) {
			const originalCount = filteredFiles.length
			// In this case, we need to build the list from CNV files instead
			// const cnvCases = Array.from(cnvFilesByCase.keys())
			filteredFiles = result.cnvFiles ? result.cnvFiles.files : []
			const filteredCount = filteredFiles.length
			const excludedCount = originalCount - filteredCount

			if (excludedCount > 0) {
				filteringMessage = `Filtered to ${filteredCount} cases with CNV files (excluded ${excludedCount} cases without CNV files)`
			}
		}
		// If only MAF is selected, no additional filtering needed
		else if (mafSelected && !cnvSelected) {
			filteringMessage = `Showing ${filteredFiles.length} cases with MAF files`
		}

		// Check if we have any files left after filtering
		if (filteredFiles.length === 0) {
			throw 'No files match the selected data type criteria. Try adjusting your data type selections.'
		}

		// Render status message with filtering information
		const mafFiles = result.mafFiles ? result.mafFiles.files : []
		const cnvFiles = result.cnvFiles ? result.cnvFiles.files : []
		const mafTotal = result.mafFiles ? result.mafFiles.filesTotal : 0

		// Determine what to show based on selected data types
		let statusMessage = ''
		if (mafSelected && cnvSelected) {
			// Both selected - show based on MAF files (which is the base)
			if (mafTotal > mafFiles.length) {
				statusMessage = `Showing first ${mafFiles.length.toLocaleString()} files out of ${mafTotal.toLocaleString()} total.`
			} else {
				statusMessage = `Showing ${filteredFiles.length.toLocaleString()} files.`
			}
		} else if (mafSelected && !cnvSelected) {
			// MAF only
			if (mafTotal > mafFiles.length) {
				statusMessage = `Showing first ${mafFiles.length.toLocaleString()} MAF files out of ${mafTotal.toLocaleString()} total.`
			} else {
				statusMessage = `Showing ${filteredFiles.length.toLocaleString()} MAF files.`
			}
		} else if (!mafSelected && cnvSelected) {
			// CNV only
			statusMessage = `Showing ${cnvFiles.length.toLocaleString()} CNV files.`
		}

		wait.html(`
			${statusMessage}<br>
			${filteringMessage ? `<span style="color: #666; font-style: italic;">${filteringMessage}</span>` : ''}
		`)

		// Build table columns dynamically based on selected data types
		const dynamicTableColumns = [
			{ label: 'Case', sortable: true },
			{ label: 'Project', sortable: true }
		]

		// Add MAF columns only if MAF is selected
		if (obj.dataTypeStates.maf) {
			dynamicTableColumns.push({ label: 'MAF Sample', sortable: false }, {
				label: 'MAF File Size',
				barplot: { tickFormat: '~s' },
				sortable: true
			} as any)
		}

		// Add CNV columns only if CNV is selected
		if (obj.dataTypeStates.cnv) {
			dynamicTableColumns.push({ label: 'CNV File ID', sortable: true }, { label: 'CNV Sample', sortable: false }, {
				label: 'CNV File Size',
				barplot: { tickFormat: '~s' },
				sortable: true
			} as any)
		}

		// Add Fusion columns only if Fusion is selected (when implemented)
		if (obj.dataTypeStates.fusion) {
			dynamicTableColumns.push(
				{ label: 'Fusion File ID', sortable: true },
				{ label: 'Fusion Sample', sortable: false },
				{ label: 'Fusion File Size', barplot: { tickFormat: '~s' }, sortable: true } as any
			)
		}

		const rows: TableRowItem[][] = []

		// Build table rows using filtered files**
		for (const f of filteredFiles) {
			const row: TableRowItem[] = []

			// Always include Case and Project columns
			row.push(
				{
					html: `<a href=https://portal.gdc.cancer.gov/files/${f.id} target=_blank>${f.case_submitter_id}</a>`,
					value: f.case_submitter_id
				},
				{ value: f.project_id }
			)

			// Add MAF columns only if MAF is selected
			if (obj.dataTypeStates.maf) {
				row.push(
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
					{ value: f.file_size }
				)
			}

			// Add CNV columns only if CNV is selected
			if (obj.dataTypeStates.cnv) {
				const cnvFile = cnvFilesByCase.get(f.case_submitter_id)

				// **IMPROVED: Better handling when CNV file should exist**
				if (cnvSelected && !cnvFile) {
					console.warn(`Expected CNV file for case ${f.case_submitter_id} but not found`)
				}

				row.push(
					{
						html: cnvFile
							? `<a href=https://portal.gdc.cancer.gov/files/${cnvFile.id} target=_blank>${cnvFile.id}</a>`
							: '<span style="color: #dc3545; font-weight: 500;">Missing CNV file</span>',
						value: cnvFile ? cnvFile.id : 'Missing CNV file'
					},
					{
						html:
							cnvFile && cnvFile.sample_types
								? cnvFile.sample_types
										.map(i => {
											return (
												'<span class="sja_mcdot" style="padding:1px 8px;background:#ddd;color:black;white-space:nowrap">' +
												i +
												'</span>'
											)
										})
										.join(' ')
								: '<span style="color: #dc3545;">No CNV sample</span>',
						value: cnvFile && cnvFile.sample_types ? cnvFile.sample_types.join(' ') : 'No CNV sample'
					},
					{
						value: cnvFile ? cnvFile.file_size : 0
					}
				)
			}

			// Add Fusion columns only if Fusion is selected (placeholder for when implemented)
			if (obj.dataTypeStates.fusion) {
				row.push(
					{ html: '<span style="color: #6c757d;">No Fusion file</span>', value: 'No Fusion file' },
					{ html: '<span style="color: #6c757d;">No Fusion sample</span>', value: 'No Fusion sample' },
					{ value: 0 }
				)
			}

			rows.push(row)
		}

		// Use filteredFiles for table operations**
		obj.mafTableArg = {
			rows,
			columns: dynamicTableColumns,
			resize: false,
			div: obj.tableDiv.append('div'),
			selectAll: true,
			dataTestId: 'sja_FileTable',
			header: { allowSort: true },
			selectedRows: [],
			buttons: [
				{
					text: 'Run GRIN2 Analysis',
					onChange: (lst, button) => updateButtonBySelectionChange(lst, button, filteredFiles),
					callback: (lst, button) => runGRIN2Analysis(lst, button, obj, filteredFiles)
				}
			]
		}

		// Render the table with the dynamic columns
		renderTable(obj.mafTableArg)
	} catch (e) {
		wait.text(e instanceof Error ? e.message : String(e))
		if (e instanceof Error && e.stack) console.log(e.stack)
	}

	function updateButtonBySelectionChange(lst, button, filteredFiles) {
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
		for (const i of lst) sum += filteredFiles[i].file_size
		if (sum == 0) {
			button.innerHTML = 'No file selected'
			button.disabled = true
			return
		}

		// TEMP fix! later add `buttonsToLeft:true` at line 321; this fix avoid changing table.ts to make it easy to cherrypick for 2.16 gdc release
		select(button.parentElement).style('float', 'left')

		button.disabled = false
		const mafMaxSize = result.mafFiles ? result.mafFiles.maxTotalSizeCompressed : Infinity
		const cnvMaxSize = result.cnvFiles ? result.cnvFiles.maxTotalSizeCompressed : Infinity
		const maxSize = Math.min(mafMaxSize, cnvMaxSize) // Use the smaller limit

		button.innerHTML = sum < maxSize ? `Run GRIN2 Analysis` : `Run GRIN2 Analysis (Large Files)`
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
	 *     [case_submitter_id]: { maf: file_id, cnv: file_id },
	 *   },
	 *   mafOptions: { minTotalDepth: 10, minAltAlleleCount: 2, consequences: [] },
	 *   cnvOptions: { dataType: 'segment_mean', lossThreshold: -0.4, gainThreshold: 0.3, segLength: 0 }
	 * }
	 *
	 */

	async function runGRIN2Analysis(lst, button, obj, filteredFiles = result.files) {
		// Check what data types are selected
		const mafSelected = obj.dataTypeStates.maf
		const cnvSelected = obj.dataTypeStates.cnv

		// Build the request object conditionally
		const caseFiles: any = {
			caseFiles: {}
		}

		// Only add mafOptions if MAF is selected
		if (mafSelected) {
			// Convert mclass codes to SO terms using existing mapping for rust backend
			const soTerms: string[] = []
			for (const mclassCode of obj.mafOptions.consequences) {
				const soTermsForCode = class2SOterm.get(mclassCode) || []
				soTerms.push(...soTermsForCode)
			}

			caseFiles.mafOptions = {
				minTotalDepth: obj.mafOptions.minTotalDepth,
				minAltAlleleCount: obj.mafOptions.minAltAlleleCount,
				consequences: soTerms,
				hyperMutator: obj.mafOptions.hyperMutator
			}
		}

		// Only add cnvOptions if CNV is selected
		if (cnvSelected) {
			caseFiles.cnvOptions = {
				dataType: obj.cnvOptions.dataType,
				lossThreshold: obj.cnvOptions.lossThreshold,
				gainThreshold: obj.cnvOptions.gainThreshold,
				segLength: obj.cnvOptions.segLength
			}
		}

		// Create CNV files map for lookup (same as in getFilesAndShowTable)
		const cnvFilesByCase = new Map()
		if (result.cnvFiles && result.cnvFiles.files) {
			for (const cnvFile of result.cnvFiles.files) {
				const caseId = cnvFile.case_submitter_id
				if (!cnvFilesByCase.has(caseId)) {
					cnvFilesByCase.set(caseId, cnvFile)
				}
			}
		}

		for (const i of lst) {
			const file = filteredFiles[i]
			// console.log('File object:', file)
			const caseId = file.case_submitter_id

			if (!caseFiles.caseFiles[caseId]) {
				caseFiles.caseFiles[caseId] = {}
			}

			// Check what data types are selected to determine how to handle the files
			const mafSelected = obj.dataTypeStates.maf
			const cnvSelected = obj.dataTypeStates.cnv

			if (mafSelected) {
				// MAF is selected - files in result.files are MAF files
				caseFiles.caseFiles[caseId].maf = file.id
			}

			if (cnvSelected) {
				// CNV is selected - check if this case has a CNV file
				const cnvFile = cnvFilesByCase.get(caseId)
				if (cnvFile) {
					caseFiles.caseFiles[caseId].cnv = cnvFile.id
				}
			}
		}

		if (Object.keys(caseFiles.caseFiles).length === 0) return

		const oldText = button.innerHTML
		button.innerHTML = 'Analyzing... Please wait'
		button.disabled = true

		// Clear/hide download button when starting new analysis
		if (obj.downloadButtonDiv) {
			obj.downloadButtonDiv.selectAll('*').remove()
			obj.downloadButtonDiv.style('display', 'none')
		}

		// Clear previous results
		obj.resultDiv.selectAll('*').remove()

		try {
			obj.busy = true

			// Call the GRIN2 run endpoint with the correctly formatted data
			// console.log('Sending GRIN2 request:', caseFiles)
			// console.log('GRIN2 request structure:', JSON.stringify(caseFiles, null, 2))
			const startTime = Date.now()
			const response = await dofetch3('gdc/runGRIN2', { body: caseFiles })
			const elapsedTime = formatElapsedTime(Date.now() - startTime)
			console.log(`GRIN2 analysis took ${elapsedTime}`)
			if (!response) throw 'invalid response'
			if (response.error) throw response.error

			console.log('GRIN2 response:', response)

			if (response.rustResult) {
				console.log('[GRIN2] Rust result received: ', response)
				// console.log('[GRIN2] rustResult received:', response.rustResult)
				// console.log('[GRIN2] Summary:', response.rustResult.summary)
				// console.log('[GRIN2] Failed files:', response.rustResult.failed_files)
				// console.log('[GRIN2] Successful data arrays:', response.rustResult.successful_data?.length)
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
				// console.log(`[GRIN2] Parsed Rust result structure received`)
				// console.log(`[GRIN2] Parsed Rust result:`, parsedRustResult)

				// Handle the new structured output
				if (parsedRustResult) {
					// Check if it's the new structured format
					if (parsedRustResult.successful_data && parsedRustResult.summary) {
						// // console.log(`[GRIN2] New format detected - Processing ${parsedRustResult.summary.total_files} files`)
						// console.log(
						// 	`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
						// )

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

							// console.log(`[GRIN2] ${failedFilesInfo.count} files failed - error details prepared for UI`)
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

				// Create a container for the genes container
				const tableContainer = resultContainer
					.append('div')
					.style('margin-bottom', '20px')
					.style('display', 'flex')
					.style('flex', '2')

				// Summary statistics container
				const statsContainer = resultContainer
					.append('div')
					.style('flex', '1')
					.style('min-width', '250px')
					.style('max-width', '350px')

				// Render the table using your existing table component
				renderTable({
					div: tableContainer,
					columns: response.topGeneTable.columns,
					rows: response.topGeneTable.rows,
					showLines: true, // Show row numbers
					striped: true, // Alternate row colors
					showHeader: true, // Show column headers
					maxHeight: '500px',
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

				// This consolidates both analysisStats and file download stats into one panel
				// Create summary statistics panel
				if (response.analysisStats || (parsedRustResult && parsedRustResult.summary)) {
					const statsPanel = statsContainer
						.append('div')
						.style('background-color', '#f8f9fa')
						.style('border', '1px solid #dee2e6')
						.style('border-radius', '8px')
						.style('padding', '20px')
						.style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')

					// Stats panel title
					statsPanel
						.append('h5')
						.text('Analysis Summary')
						.style('margin', '0 0 15px 0')
						.style('color', '#343a40')
						.style('font-weight', 'bold')
						.style('border-bottom', '2px solid #dee2e6')
						.style('padding-bottom', '8px')

					// File Download/Processing Stats Section
					if (parsedRustResult && parsedRustResult.summary) {
						const downloadStats = statsPanel.append('div').style('margin-bottom', '20px')

						downloadStats
							.append('h6')
							.text('File Download & Processing')
							.style('margin', '0 0 10px 0')
							.style('color', '#495057')
							.style('font-size', '14px')
							.style('font-weight', 'bold')

						const downloadStatsGrid = downloadStats
							.append('div')
							.style('display', 'grid')
							.style('grid-template-columns', '1fr 1fr')
							.style('gap', '8px')
							.style('font-size', '13px')

						// File download metrics from parsedRustResult
						const totalAttempted = parsedRustResult.summary.total_files
						const successful = parsedRustResult.summary.successful_files
						const failed = parsedRustResult.summary.failed_files

						downloadStatsGrid.append('div').style('color', '#6c757d').text('Total Attempted:')
						downloadStatsGrid
							.append('div')
							.style('font-weight', 'bold')
							.text(totalAttempted || 0)

						downloadStatsGrid.append('div').style('color', '#28a745').text('Successfully Downloaded:')
						downloadStatsGrid
							.append('div')
							.style('font-weight', 'bold')
							.style('color', '#28a745')
							.text(successful || 0)

						downloadStatsGrid.append('div').style('color', '#dc3545').text('Failed Downloads:')
						downloadStatsGrid
							.append('div')
							.style('font-weight', 'bold')
							.style('color', '#dc3545')
							.text(failed || 0)

						// Add expandable failed files section if there are failures
						if (failedFilesInfo && failedFilesInfo.count > 0) {
							addExpandableFailedFilesToStats(downloadStats, failedFilesInfo)
						}
					}

					// Data Filtering Stats Section (if available)
					console.log('Response analysisStats:', response.analysisStats)

					if (
						response.analysisStats &&
						(response.analysisStats.filtered_records !== undefined ||
							response.analysisStats.filtered_maf_records !== undefined ||
							response.analysisStats.filtered_cnv_records !== undefined)
					) {
						const filterStats = statsPanel.append('div').style('margin-bottom', '20px')

						filterStats
							.append('h6')
							.text('Data Filtering')
							.style('margin', '0 0 10px 0')
							.style('color', '#495057')
							.style('font-size', '14px')
							.style('font-weight', 'bold')

						const filterStatsGrid = filterStats
							.append('div')
							.style('display', 'grid')
							.style('grid-template-columns', '1fr 1fr')
							.style('gap', '8px')
							.style('font-size', '13px')

						// Total excluded (filtered) records
						if (response.analysisStats.filtered_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('Total Number of Excluded Records:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.analysisStats.filtered_records.toLocaleString())
						}

						// Total included records in the analysis
						filterStatsGrid.append('div').style('color', '#6c757d').text('Total Number of Included Records:')
						filterStatsGrid
							.append('div')
							.style('font-weight', 'bold')
							.style('color', 'black')
							.text(processedData.length.toLocaleString())

						// MAF excluded (filtered) records
						if (response.analysisStats.filtered_maf_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('MAF Records Excluded:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.analysisStats.filtered_maf_records.toLocaleString())
						}

						// MAF included (non-filtered) records
						if (response.analysisStats.included_maf_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('MAF Records Included:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.analysisStats.included_maf_records.toLocaleString())
						}

						// CNV excluded (filtered) records
						if (response.analysisStats.filtered_cnv_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('CNV Records Excluded:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.analysisStats.filtered_cnv_records.toLocaleString())
						}

						// CNV included (non-filtered) records
						if (response.analysisStats.included_cnv_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('CNV Records Included:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.analysisStats.included_cnv_records.toLocaleString())
						}
					}
				}

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

// List of data type options
const datatypeOptions = [
	{ option: 'mafOption', selected: true, label: 'Include Mutation' },
	{ option: 'cnvOption', selected: false, label: 'Include CNV' },
	{ option: 'fusionOption', selected: false, label: 'Include Fusion' }
]

/**
 * Main GRIN2 UI initialization function
 * Entry point for the GRIN2 analysis interface
 *
 * @param config - Configuration object containing holder, filters, and callbacks
 * @returns Public API object with update method
 */
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
