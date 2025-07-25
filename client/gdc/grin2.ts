/*
================================================================================
GRIN2 UI Module - Genomic Data Analysis Interface
================================================================================
A comprehensive UI for listing genomic data (MAF, CNV, Fusion)
from GDC cohorts and analyzing and visualizing with GRIN2.

Author: PP Team
================================================================================
*/

import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror, make_one_checkbox } from '#dom'
import { select } from 'd3-selection'
import type { GdcGRIN2listRequest } from '#types'
import { mclass, dtsnvindel, class2SOterm, bplen } from '@sjcrh/proteinpaint-shared/common.js'
import {
	STYLES,
	applyStyles,
	createNumberInput,
	createOptionsTable,
	createTableHeader,
	createDataTypeRow,
	createInfoPanel
} from './grin2/ui-components'

// ================================================================================
// TYPE DEFINITIONS, INTERFACES, & DEFAULTS
// ================================================================================

// Interface for table row item
interface TableRowItem {
	html?: string
	value?: any
	rawData?: any
	dataType?: string
}

// Default MAF classes for mutation types
const defaultCheckedClasses = ['M', 'F', 'N', 'StopLost', 'StartLost', 'L', 'I', 'D', 'ProteinAltering']

// Classes to skip in MAF analysis
const skipMAFclasses = ['WT', 'Blank', 'X']

// ================================================================================
// UI COMPONENT BUILDERS
// ================================================================================

/** Function to transform our R top gene table to the format expected by renderTable for proper sorting
 * @param rows - Array of rows from R, each row is an array of objects with a 'value' property
 * @param columns - Array of column headers from R, each header is an object with a 'label' property
 * @returns Transformed rows in the format expected by renderTable
 */
// Transform rows to match the expected format for renderTable
function transformRows(rows, columns) {
	return rows.map(row => {
		const transformedRow: Array<{ value: any }> = []

		for (let i = 0; i < columns.length; i++) {
			const cellData = row[i]
			let value = null

			// Extract value from complex structure from R
			if (cellData && cellData.value && Array.isArray(cellData.value)) {
				value = cellData.value[0]
			} else if (cellData && 'value' in cellData) {
				value = cellData.value
			} else {
				value = cellData
			}

			// Create object with value property
			transformedRow.push({ value: value })
		}

		return transformedRow
	})
}

function parseRecordsByCaseData(
	recordsByCase: any,
	excludedByMaxRecord: { maf?: string[]; cnv?: string[] } = {}
): { columns: any[]; rows: any[][] } {
	// Adding columns for detailed filtering stats
	const columns = [
		{ label: 'Case ID', sortable: true },
		{ label: 'MAF Total Processed', sortable: true },
		{ label: 'MAF Included', sortable: true },
		{ label: 'MAF Excluded by Depth', sortable: true },
		{ label: 'MAF Excluded by Alt Count', sortable: true },
		{ label: 'MAF Excluded by Consequence', sortable: true },
		{ label: 'MAF Skipped Chromosomes', sortable: true },
		{ label: 'MAF Excluded by Records Cap', sortable: true },
		{ label: 'CNV Total Processed', sortable: true },
		{ label: 'CNV Included', sortable: true },
		{ label: 'CNV Excluded by Thresholds', sortable: true },
		{ label: 'CNV Excluded by Length', sortable: true },
		{ label: 'CNV Skipped Chromosomes', sortable: true },
		{ label: 'CNV Excluded by Records Cap', sortable: true },
		{ label: 'Invalid Rows', sortable: true }
	]

	const rows: TableRowItem[][] = []

	Object.entries(recordsByCase).forEach(([caseId, caseData]: [string, any]) => {
		const row: TableRowItem[] = []

		// Case ID
		row.push({ value: caseId })

		// Parse the case data
		let parsedData
		try {
			parsedData = typeof caseData === 'string' ? JSON.parse(caseData) : caseData
		} catch (_e) {
			parsedData = caseData
		}

		// MAF Statistics
		let mafTotalProcessed = 0
		let mafIncluded = 0
		let mafExcludedByDepth = 0
		let mafExcludedByAltCount = 0
		let mafExcludedByConsequence = 0
		let mafSkippedChromosomes = 0

		if (parsedData.maf) {
			mafTotalProcessed = parsedData.maf.total_processed || 0
			mafIncluded = parsedData.maf.total_included || 0
			mafExcludedByDepth = parsedData.maf.excluded_by_min_depth || 0
			mafExcludedByAltCount = parsedData.maf.excluded_by_min_alt_count || 0
			mafExcludedByConsequence = parsedData.maf.excluded_by_consequence_type || 0

			// Calculate total count from the chromosome object
			if (parsedData.maf.skipped_chromosomes && typeof parsedData.maf.skipped_chromosomes === 'object') {
				mafSkippedChromosomes = Object.values(parsedData.maf.skipped_chromosomes).reduce(
					(sum: number, count: any) => sum + (Number(count) || 0),
					0
				)
			}
		}

		row.push({ value: mafTotalProcessed })
		row.push({ value: mafIncluded })
		row.push({ value: mafExcludedByDepth })
		row.push({ value: mafExcludedByAltCount })
		row.push({ value: mafExcludedByConsequence })
		if (parsedData.maf?.skipped_chromosomes && Object.keys(parsedData.maf.skipped_chromosomes).length > 0) {
			const chromosomeEntries = Object.entries(parsedData.maf.skipped_chromosomes)
			const tableHtml = `
				<div style="text-align: center;">
				<table style="border-collapse: collapse; margin: 0 auto; font-size: 11px; border: 1px solid #ddd;">
					<thead>
					<tr style="background-color: #f8f9fa;">
						<th style="border: 1px solid #ddd; padding: 2px 6px;">Chr</th>
						<th style="border: 1px solid #ddd; padding: 2px 6px;">Count</th>
					</tr>
					</thead>
					<tbody>
					${chromosomeEntries
						.map(
							([chr, count]) =>
								`<tr>
						<td style="border: 1px solid #ddd; padding: 2px 6px;">${chr}</td>
						<td style="border: 1px solid #ddd; padding: 2px 6px; text-align: right;">${count}</td>
						</tr>`
						)
						.join('')}
					</tbody>
				</table>
				</div>
			`
			row.push({
				html: tableHtml,
				value: mafSkippedChromosomes,
				rawData: parsedData.maf.skipped_chromosomes,
				dataType: 'chromosome-details'
			})
		} else {
			row.push({
				value: mafSkippedChromosomes,
				rawData: null,
				dataType: 'chromosome-details'
			})
		}

		// Check if this case was excluded by max record for MAF
		const mafExcludedByMax = excludedByMaxRecord.maf?.includes(caseId) ? 'Yes' : 'No'
		row.push({
			value: mafExcludedByMax,
			html:
				mafExcludedByMax === 'Yes'
					? `<span style="color: #dc3545; font-weight: bold;">${mafExcludedByMax}</span>`
					: mafExcludedByMax
		})

		// CNV Statistics
		let cnvTotalProcessed = 0
		let cnvIncluded = 0
		let cnvExcludedByThresholds = 0
		let cnvExcludedByLength = 0
		let cnvSkippedChromosomes = 0

		if (parsedData.cnv) {
			cnvTotalProcessed = parsedData.cnv.total_processed || 0
			cnvIncluded = parsedData.cnv.total_included || 0
			// Combine loss and gain threshold exclusions
			cnvExcludedByThresholds =
				(parsedData.cnv.excluded_by_loss_threshold || 0) + (parsedData.cnv.excluded_by_gain_threshold || 0)
			cnvExcludedByLength = parsedData.cnv.excluded_by_segment_length || 0
			// Calculate total count from the chromosome object
			if (parsedData.cnv.skipped_chromosomes && typeof parsedData.cnv.skipped_chromosomes === 'object') {
				cnvSkippedChromosomes = Object.values(parsedData.cnv.skipped_chromosomes).reduce(
					(sum: number, count: any) => sum + (Number(count) || 0),
					0
				)
			}
		}

		row.push({ value: cnvTotalProcessed })
		row.push({ value: cnvIncluded })
		row.push({ value: cnvExcludedByThresholds })
		row.push({ value: cnvExcludedByLength })
		if (parsedData.cnv?.skipped_chromosomes && Object.keys(parsedData.cnv.skipped_chromosomes).length > 0) {
			const chromosomeEntries = Object.entries(parsedData.cnv.skipped_chromosomes)
			const tableHtml = `
    <div style="text-align: center;">
      <table style="border-collapse: collapse; margin: 0 auto; font-size: 11px; border: 1px solid #ddd;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="border: 1px solid #ddd; padding: 2px 6px;">Chr</th>
            <th style="border: 1px solid #ddd; padding: 2px 6px;">Count</th>
          </tr>
        </thead>
        <tbody>
          ${chromosomeEntries
						.map(
							([chr, count]) =>
								`<tr>
              <td style="border: 1px solid #ddd; padding: 2px 6px;">${chr}</td>
              <td style="border: 1px solid #ddd; padding: 2px 6px; text-align: right;">${count}</td>
            </tr>`
						)
						.join('')}
        </tbody>
      </table>
    </div>
  `
			row.push({
				html: tableHtml,
				value: cnvSkippedChromosomes,
				rawData: parsedData.cnv.skipped_chromosomes,
				dataType: 'chromosome-details'
			})
		} else {
			row.push({
				value: cnvSkippedChromosomes,
				rawData: null,
				dataType: 'chromosome-details'
			})
		}

		// Check if this case was excluded by max record for CNV
		const cnvExcludedByMax = excludedByMaxRecord.cnv?.includes(caseId) ? 'Yes' : 'No'
		row.push({
			value: cnvExcludedByMax,
			html:
				cnvExcludedByMax === 'Yes'
					? `<span style="color: #dc3545; font-weight: bold;">${cnvExcludedByMax}</span>`
					: cnvExcludedByMax
		})

		// Invalid Rows (MAF + CNV combined)
		let totalInvalidRows = 0
		if (parsedData.maf && parsedData.maf.invalid_rows !== undefined) {
			totalInvalidRows += Number(parsedData.maf.invalid_rows) || 0
		}
		if (parsedData.cnv && parsedData.cnv.invalid_rows !== undefined) {
			totalInvalidRows += Number(parsedData.cnv.invalid_rows) || 0
		}
		row.push({ value: totalInvalidRows })

		rows.push(row)
	})

	return { columns, rows }
}

/**
 * Adds expandable failed files section to any stats container
 * @param statsContainer - The stats container to append the expandable section to
 * @param failedFilesInfo - Object containing failed files data and error summaries
 * @returns void
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
 * @returns void
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
 * @returns void
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

/** Main UI Builders */

/**
 * Creates MAF options content using the new component system
 */
function createMAFOptionsContent(container: any, obj: any) {
	container.selectAll('*').remove()

	// Create options grid
	const optionsGrid = container.append('div')
	applyStyles(optionsGrid, STYLES.gridTwoColumn)
	optionsGrid.style('margin-top', '10px')

	// Min Total Depth input
	createNumberInput(optionsGrid, {
		label: 'Min Total Depth:',
		value: obj.mafOptions.minTotalDepth || 10,
		min: 0,
		step: 1,
		width: '80px',
		labelWidth: '140px',
		onChange: value => {
			if (value >= 0) obj.mafOptions.minTotalDepth = value
		}
	})

	// Min Mutant Allele Count input
	createNumberInput(optionsGrid, {
		label: 'Min Mutant Allele Count:',
		value: obj.mafOptions.minAltAlleleCount || 2,
		min: 0,
		step: 1,
		width: '80px',
		labelWidth: '160px',
		onChange: value => {
			if (value >= 0) obj.mafOptions.minAltAlleleCount = value
		}
	})

	// Consequences section
	createConsequencesSection(optionsGrid, obj)

	// Hypermutator input
	createNumberInput(optionsGrid, {
		label: 'Hypermutator Max Cut Off:',
		value: obj.mafOptions.hyperMutator || 8000,
		min: 0,
		step: 100,
		width: '70px',
		labelWidth: '160px',
		onChange: value => {
			if (value >= 0) obj.mafOptions.hyperMutator = value
		}
	})

	// Workflow type (read-only)
	createWorkflowSection(optionsGrid)

	// Deduplication status
	createDeduplicationSection(optionsGrid, obj)
}

/**
 * Creates the consequences selection section
 */
function createConsequencesSection(optionsGrid: any, obj: any) {
	const consequencesContainer = optionsGrid
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'flex-start')
		.style('gap', '8px')
		.style('grid-column', '1 / -1')

	consequencesContainer
		.append('label')
		.style('font-size', '14px')
		.style('font-weight', '500')
		.style('min-width', '100px')
		.style('margin-top', '4px')
		.text('Consequences:')

	const selectionDiv = consequencesContainer.append('div').style('flex', '1')

	// Checkbox container
	const checkboxContainer = selectionDiv
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))')
		.style('gap', '8px')
		.style('margin-bottom', '12px')

	// Create checkboxes for mutation classes
	createMutationClassCheckboxes(checkboxContainer, obj)

	// Add info panel
	createInfoPanel(selectionDiv, {
		title: 'Mutation Types:',
		content: `Select the types of mutations to include in your analysis.
              High-impact mutations (missense, nonsense, frameshift) are selected by default.
              Silent/synonymous mutations are excluded by default as they don't change protein sequence.`
	})
}

/**
 * Creates mutation class checkboxes
 */
function createMutationClassCheckboxes(container: any, obj: any) {
	const seenLabels = new Set()

	for (const cls in mclass) {
		if (mclass[cls].dt !== dtsnvindel) continue
		if (skipMAFclasses.includes(cls)) continue

		const labelText = mclass[cls].label
		if (seenLabels.has(labelText)) continue
		seenLabels.add(labelText)

		const isDefaultChecked = defaultCheckedClasses.includes(cls)
		const checkboxDiv = container.append('div')

		make_one_checkbox({
			holder: checkboxDiv,
			labeltext: labelText,
			checked: isDefaultChecked,
			id: `consequence-${cls}`,
			divstyle: {
				'font-size': '13px',
				margin: '0'
			},
			callback: async isChecked => {
				if (isChecked) {
					if (!obj.mafOptions.consequences.includes(cls)) {
						obj.mafOptions.consequences.push(cls)
					}
				} else {
					obj.mafOptions.consequences = obj.mafOptions.consequences.filter(c => c !== cls)
				}
			}
		})

		checkboxDiv.select('label').attr('title', mclass[cls].desc)

		if (isDefaultChecked && !obj.mafOptions.consequences.includes(cls)) {
			obj.mafOptions.consequences.push(cls)
		}
	}
}

/**
 * Creates workflow type section (read-only)
 */
function createWorkflowSection(optionsGrid: any) {
	const workflowContainer = optionsGrid.append('div')
	applyStyles(workflowContainer, STYLES.flexRow)
	workflowContainer.style('grid-column', '1 / -1')

	const label = workflowContainer.append('label')
	applyStyles(label, STYLES.label)
	label.style('min-width', '100px').text('Workflow Type:')

	workflowContainer
		.append('span')
		.style('font-size', '14px')
		.style('color', '#666')
		.text('Aliquot Ensemble Somatic Variant Merging and Masking')
}

/**
 * Creates deduplication status section
 */
function createDeduplicationSection(optionsGrid: any, obj: any) {
	const dedupContainer = optionsGrid.append('div')
	applyStyles(dedupContainer, STYLES.flexRow)
	dedupContainer.style('grid-column', '1 / -1')

	const label = dedupContainer.append('label')
	applyStyles(label, STYLES.label)
	label.style('min-width', '100px').text('Deduplication:')

	const dedupStatus = dedupContainer
		.append('span')
		.attr('id', 'dedup-status')
		.style('font-size', '14px')
		.style('color', '#666')

	obj.dedupStatusElement = dedupStatus
}

/**
 * Creates CNV options content using the new component system
 */
function createCNVOptionsContent(container: any, obj: any) {
	container.selectAll('*').remove()

	if (!obj.cnvOptions.dataType) {
		obj.cnvOptions.dataType = 'segment_mean'
	}

	const optionsGrid = container.append('div')
	applyStyles(optionsGrid, STYLES.gridTwoColumn)
	optionsGrid.style('margin-top', '10px')

	// Data Type radio section
	createDataTypeRadioSection(optionsGrid, obj)

	// Loss Threshold
	createNumberInput(optionsGrid, {
		label: 'Loss Threshold:',
		value: obj.cnvOptions.lossThreshold || -0.4,
		min: -10,
		max: 0,
		step: 0.1,
		width: '70px',
		labelWidth: '120px',
		onChange: value => {
			if (value <= 0) obj.cnvOptions.lossThreshold = value
		}
	})

	// Gain Threshold
	createNumberInput(optionsGrid, {
		label: 'Gain Threshold:',
		value: obj.cnvOptions.gainThreshold || 0.3,
		min: 0,
		max: 10,
		step: 0.1,
		width: '70px',
		labelWidth: '120px',
		onChange: value => {
			if (value >= 0) obj.cnvOptions.gainThreshold = value
		}
	})

	// Hypermutator
	createNumberInput(optionsGrid, {
		label: 'Hypermutator Max Cut Off:',
		value: obj.cnvOptions.hyperMutator || 500,
		min: 0,
		step: 100,
		width: '70px',
		labelWidth: '160px',
		onChange: value => {
			if (value >= 0) obj.cnvOptions.hyperMutator = value
		}
	})

	// Segment Length
	createSegmentLengthSection(optionsGrid, obj)

	// Help section
	createCNVHelpSection(optionsGrid)
}

/**
 * Creates CNV data type radio section
 */
function createDataTypeRadioSection(optionsGrid: any, obj: any) {
	const dataTypeContainer = optionsGrid.append('div')
	applyStyles(dataTypeContainer, STYLES.flexRow)
	dataTypeContainer.style('grid-column', '1 / -1')

	const label = dataTypeContainer.append('label')
	applyStyles(label, STYLES.label)
	label.style('min-width', '80px').text('Data Type:')

	const radioContainer = dataTypeContainer.append('div')
	applyStyles(radioContainer, STYLES.flexRow)
	radioContainer.style('gap', '6px')

	const radio = radioContainer
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

	radio.on('change', function (this: HTMLInputElement) {
		if (this.checked) {
			obj.cnvOptions.dataType = this.value
		}
	})
}

/**
 * Creates segment length section with unit
 */
function createSegmentLengthSection(optionsGrid: any, obj: any) {
	const segmentContainer = optionsGrid.append('div')
	applyStyles(segmentContainer, STYLES.flexRow)
	segmentContainer.style('grid-column', '1 / -1')

	const label = segmentContainer.append('label')
	applyStyles(label, STYLES.label)
	label.style('min-width', '140px').text('Segment Length Cutoff:')

	const input = segmentContainer
		.append('input')
		.attr('type', 'number')
		.attr('min', '0')
		.attr('max', '2000000')
		.attr('step', '1000')
		.attr('value', obj.cnvOptions.segLength || 0)

	applyStyles(input, STYLES.numberInput)
	input.style('width', '100px')

	segmentContainer.append('span').style('font-size', '13px').style('color', '#666').text('bp')

	input.on('input', function (this: HTMLInputElement) {
		const value = parseInt(this.value, 10)
		if (!isNaN(value) && value >= 0) {
			obj.cnvOptions.segLength = value
		}
	})
}

/**
 * Creates CNV help section
 */
function createCNVHelpSection(optionsGrid: any) {
	const helpContainer = optionsGrid.append('div').style('grid-column', '1 / -1').style('margin-top', '8px')

	createInfoPanel(helpContainer, {
		title: 'CNV Options:',
		content: `• Loss Threshold: Log2 ratio for copy number loss (negative values)<br>
              • Gain Threshold: Log2 ratio for copy number gain (positive values)<br>
              • Hypermutator Max Cut Off: Maximum number of CNVs per case<br>
              • Segment Length: Maximum CNV segment size to include (no filter if 0)`
	})
}

/**
 * Main refactored makeControls function
 */
function makeControls(obj: any) {
	// Initialize options if not exists
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
			segLength: 0,
			hyperMutator: 500
		}
	}

	obj.dataTypeStates = {
		maf: true,
		cnv: true,
		fusion: false
	}

	// Create main options table
	const optionsTable = createOptionsTable(obj.controlDiv)
	createTableHeader(optionsTable, ['Data Type', 'Options'])

	// MAF row
	const mafRow = createDataTypeRow(optionsTable, {
		id: 'maf-checkbox',
		label: 'MAF (Mutation)',
		checked: true,
		onChange: isChecked => {
			obj.dataTypeStates.maf = isChecked
			mafRow.optionsContainer.style('display', isChecked ? 'block' : 'none')
			obj.updateSubmitButtonState?.()
		},
		createOptionsContent: container => createMAFOptionsContent(container, obj)
	})

	// CNV row
	const cnvRow = createDataTypeRow(optionsTable, {
		id: 'cnv-checkbox',
		label: 'CNV (Copy Number)',
		checked: true,
		onChange: isChecked => {
			obj.dataTypeStates.cnv = isChecked
			cnvRow.optionsContainer.style('display', isChecked ? 'block' : 'none')
			if (isChecked) {
				createCNVOptionsContent(cnvRow.optionsContainer, obj)
			}
			obj.updateSubmitButtonState?.()
		},
		createOptionsContent: container => createCNVOptionsContent(container, obj)
	})

	// Fusion row (placeholder)
	const fusionRow = createDataTypeRow(optionsTable, {
		id: 'fusion-checkbox',
		label: 'Fusion',
		checked: false,
		onChange: isChecked => {
			obj.dataTypeStates.fusion = isChecked
			fusionRow.optionsContainer.style('display', isChecked ? 'block' : 'none')
			obj.updateSubmitButtonState?.()
		},
		createOptionsContent: container => {
			container
				.append('div')
				.style('color', '#666')
				.style('font-style', 'italic')
				.text('Please login to access RNA fusion data.')
		}
	})

	// GRIN2 row (info only)
	createGRIN2InfoRow(optionsTable)

	// Submit button
	createSubmitButton(obj)

	// Store references
	obj.mafOptionsContainer = mafRow.optionsContainer
	obj.cnvOptionsContainer = cnvRow.optionsContainer
	obj.fusionOptionsContainer = fusionRow.optionsContainer
}

/**
 * Creates GRIN2 info row
 */
function createGRIN2InfoRow(optionsTable: any) {
	const grin2Row = optionsTable.append('tr')

	const labelCell = grin2Row.append('td')
	applyStyles(labelCell, STYLES.tableCell)
	labelCell.append('div').style('font-weight', '500').style('color', '#333').text('GRIN2 Analysis')

	const optionsCell = grin2Row.append('td')
	applyStyles(optionsCell, STYLES.tableCell)
	optionsCell.append('div').style('color', '#666').text('GRIN2 analysis options will be configured here')
}

/**
 * Creates submit button with state management
 */
function createSubmitButton(obj: any) {
	const submitButtonContainer = obj.controlDiv
		.append('div')
		.style('margin-top', '2px')
		.style('margin-bottom', '2px')
		.style('text-align', 'left')

	const submitButton = submitButtonContainer
		.append('button')
		.attr('id', 'submit-options-button')
		.style('margin', '10px 10px 0 0')
		.text('Apply Options & Refresh Files')

	obj.submitButton = submitButton

	submitButton.on('click', function (this: HTMLButtonElement) {
		if (!this.disabled) {
			getFilesAndShowTable(obj)
		}
	})

	// State management function
	obj.updateSubmitButtonState = function () {
		const hasAnyDataTypeSelected = obj.dataTypeStates.maf || obj.dataTypeStates.cnv || obj.dataTypeStates.fusion

		if (hasAnyDataTypeSelected) {
			submitButton.attr('disabled', null).text('Apply Options & Refresh Files')
		} else {
			submitButton.attr('disabled', true).text('Select at least one data type')
		}
	}

	// Initial state check
	obj.updateSubmitButtonState()
}

/**
 * Fetches available files and renders the selection table
 * Main data loading function that handles file filtering and display
 *
 * @param obj - Main application object containing configuration
 * @returns void
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
	 * @param button - Button element that triggered the action
	 * @param obj - Main application object containing configuration
	 * @param filteredFiles - Array of files to filter from (default: result.files)
	 * @returns void
	 * Creates structure expected by Rust:
	 * {
	 *   caseFiles: {
	 *     [case_submitter_id]: { maf: file_id, cnv: file_id },
	 *   },
	 *   mafOptions: { minTotalDepth: 10, minAltAlleleCount: 2, consequences: [] },
	 *   cnvOptions: { dataType: 'segment_mean', lossThreshold: -0.4, gainThreshold: 0.3, segLength: 0, hyperMutator: 500 }
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
				segLength: obj.cnvOptions.segLength,
				hyperMutator: obj.cnvOptions.hyperMutator
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
			const response = await dofetch3('gdc/runGRIN2', { body: caseFiles })
			if (!response) throw 'invalid response'
			if (response.error) throw response.error

			console.log('GRIN2 response:', response)

			if (response.rustResult) {
				// console.log('[GRIN2] Rust result received: ', response)
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
						// console.log(`[GRIN2] New format detected - Processing ${parsedRustResult.summary.total_files} files`)
						// console.log(
						// 	`[GRIN2] Success: ${parsedRustResult.summary.successful_files}, Failed: ${parsedRustResult.summary.failed_files}`
						// )

						// Successful data goes to python
						processedData = parsedRustResult.successful_data

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

					console.log(`[GRIN2] Final processed data contains ${processedData.length.toLocaleString()} characters`)
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

				// Apply transformation
				const transformedRows = transformRows(response.topGeneTable.rows, response.topGeneTable.columns)

				// Render the table using your existing table component
				renderTable({
					div: tableContainer,
					rows: transformedRows,
					columns: response.topGeneTable.columns,
					showLines: true,
					striped: true,
					showHeader: true,
					maxHeight: '500px',
					maxWidth: '100%',
					resize: false,
					header: {
						allowSort: true,
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

				// This consolidates both the analysis stats and file download stats into one panel
				// Create summary statistics panel
				if (parsedRustResult?.summary) {
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

					// Processing Timings Section
					if (response.timing) {
						const timingStats = statsPanel.append('div').style('margin-bottom', '20px')

						timingStats
							.append('h6')
							.text('Timings')
							.style('margin', '0 0 10px 0')
							.style('color', '#495057')
							.style('font-size', '14px')
							.style('font-weight', 'bold')

						const timingStatsGrid = timingStats
							.append('div')
							.style('display', 'grid')
							.style('grid-template-columns', '1fr 1fr')
							.style('gap', '8px')
							.style('font-size', '13px')

						// Rust Processing Time
						if (response.timing.rustProcessingTime !== undefined) {
							timingStatsGrid.append('div').style('color', '#6c757d').text('GDC API Data Query and Parsing (s):')
							timingStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.timing.rustProcessingTime)
						}

						// GRIN2 Processing Time
						if (response.timing.grin2ProcessingTime !== undefined) {
							timingStatsGrid.append('div').style('color', '#6c757d').text('GRIN2 Analysis (s):')
							timingStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.timing.grin2ProcessingTime)
						}

						// Total Time
						if (response.timing.totalTime !== undefined) {
							timingStatsGrid.append('div').style('color', '#6c757d').text('Total Processing Time (s):')
							timingStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.timing.totalTime)
						}
					}

					// Data Filtering Stats Section (if available)
					if (
						response.rustResult.summary &&
						(response.rustResult.summary.filtered_records !== undefined ||
							response.rustResult.summary.filtered_maf_records !== undefined ||
							response.rustResult.summary.filtered_cnv_records !== undefined)
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
						if (response.rustResult.summary.filtered_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('Total Number of Excluded Records:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.rustResult.summary.filtered_records.toLocaleString())
						}

						// Total included records in the analysis
						const mafRecords = response.rustResult.summary.included_maf_records || 0
						const cnvRecords = response.rustResult.summary.included_cnv_records || 0
						const totalIncludedRecords = mafRecords + cnvRecords
						filterStatsGrid.append('div').style('color', '#6c757d').text('Total Number of Included Records:')
						filterStatsGrid
							.append('div')
							.style('font-weight', 'bold')
							.style('color', 'black')
							.text(totalIncludedRecords.toLocaleString())

						// MAF excluded (filtered) records
						if (response.rustResult.summary.filtered_maf_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('MAF Records Excluded:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.rustResult.summary.filtered_maf_records.toLocaleString())
						}

						// MAF included (non-filtered) records
						if (response.rustResult.summary.included_maf_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('MAF Records Included:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.rustResult.summary.included_maf_records.toLocaleString())
						}

						// CNV excluded (filtered) records
						if (response.rustResult.summary.filtered_cnv_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('CNV Records Excluded:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.rustResult.summary.filtered_cnv_records.toLocaleString())
						}

						// CNV included (non-filtered) records
						if (response.rustResult.summary.included_cnv_records !== undefined) {
							filterStatsGrid.append('div').style('color', '#6c757d').text('CNV Records Included:')
							filterStatsGrid
								.append('div')
								.style('font-weight', 'bold')
								.style('color', 'black')
								.text(response.rustResult.summary.included_cnv_records.toLocaleString())
						}

						// Records by case
						if (response.rustResult.summary.filtered_records_by_case !== undefined) {
							// Parse the records by case data and create table structure
							const { columns, rows } = parseRecordsByCaseData(
								response.rustResult.summary.filtered_records_by_case,
								response.rustResult.summary.excluded_by_max_record
							)

							// Create container that spans both columns
							const recordsByCaseContainer = filterStats
								.append('div')
								.style('grid-column', '1 / -1')
								.style('margin-top', '15px')

							// Create expandable header
							const expandableHeader = recordsByCaseContainer
								.append('div')
								.style('display', 'flex')
								.style('align-items', 'center')
								.style('gap', '8px')
								.style('cursor', 'pointer')
								.style('padding', '8px')
								.style('border-radius', '4px')
								.style('transition', 'background-color 0.2s')
								.style('background-color', 'rgba(0, 123, 255, 0.1)')
								.style('border', '1px solid rgba(0, 123, 255, 0.2)')
								.on('mouseenter', function (this: HTMLElement) {
									select(this).style('background-color', 'rgba(0, 123, 255, 0.15)')
								})
								.on('mouseleave', function (this: HTMLElement) {
									select(this).style('background-color', 'rgba(0, 123, 255, 0.1)')
								})

							// Expand/collapse icon
							const expandIcon = expandableHeader
								.append('span')
								.style('font-size', '12px')
								.style('color', '#007bff')
								.style('transition', 'transform 0.2s')
								.text('▶')

							// Header text
							expandableHeader
								.append('span')
								.style('color', '#007bff')
								.style('text-decoration', 'underline')
								.style('font-size', '13px')
								.style('font-weight', '500')
								.text(
									`View detailed statistics for ${
										Object.keys(response.rustResult.summary.filtered_records_by_case).length
									} cases`
								)

							// Create expandable content (hidden by default)
							const expandableContent = recordsByCaseContainer
								.append('div')
								.style('display', 'none')
								.style('margin-top', '12px')

							// Create table container
							const tableContainer = expandableContent
								.append('div')
								.style('max-height', '400px')
								.style('overflow-y', 'auto')
								.style('border', '1px solid #dee2e6')
								.style('border-radius', '4px')

							// Render the table using renderTable
							renderTable({
								div: tableContainer,
								columns: columns,
								rows: rows,
								showLines: true,
								striped: true,
								showHeader: true,
								maxHeight: '380px',
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
								.text('This table shows analysis statistics per case.')

							// Track expanded state and add click handler
							let isExpanded = false
							expandableHeader.on('click', function () {
								isExpanded = !isExpanded
								if (isExpanded) {
									expandableContent.style('display', 'block')
									expandIcon.style('transform', 'rotate(90deg)').text('▼')
								} else {
									expandableContent.style('display', 'none')
									expandIcon.style('transform', 'rotate(0deg)').text('▶')
								}
							})
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
						.style('max-width', '100%')
						.style('width', 'fit-content')
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
					.style('max-width', '100%')
					.style('width', 'fit-content')
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
