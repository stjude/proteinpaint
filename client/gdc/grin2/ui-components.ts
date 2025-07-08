// ================================================================================
// UI COMPONENT TEMPLATES AND UTILITIES for GDC-GRIN2
// ================================================================================

/**
 * Common style definitions to reduce repetitive inline styling
 */
export const STYLES = {
	// Layout styles
	flexRow: {
		display: 'flex',
		'align-items': 'center',
		gap: '8px'
	},

	gridTwoColumn: {
		display: 'grid',
		'grid-template-columns': 'auto auto',
		gap: '15px',
		'max-width': 'fit-content'
	},

	// Form element styles
	label: {
		'font-size': '14px',
		'font-weight': '500'
	},

	numberInput: {
		padding: '4px 8px',
		border: '1px solid #ccc',
		'border-radius': '4px',
		'font-size': '14px'
	},

	checkbox: {
		margin: '0',
		cursor: 'pointer'
	},

	checkboxLabel: {
		cursor: 'pointer',
		'font-weight': '500'
	},

	// Table styles
	tableHeader: {
		padding: '12px',
		'background-color': '#f8f9fa',
		border: '1px solid #ddd',
		'font-weight': 'bold',
		'text-align': 'left'
	},

	tableCell: {
		padding: '12px',
		border: '1px solid #ddd',
		'vertical-align': 'top'
	},

	optionsTable: {
		width: 'auto',
		'border-collapse': 'collapse',
		'margin-top': '10px',
		border: '1px solid #ddd'
	},

	// Panel styles
	infoPanel: {
		padding: '8px',
		'background-color': '#f8f9fa',
		'border-radius': '4px',
		'border-left': '3px solid #6c757d',
		'font-size': '12px',
		color: '#495057',
		'line-height': '1.4'
	},

	// Expandable section styles
	expandableHeader: {
		display: 'flex',
		'align-items': 'center',
		gap: '8px',
		cursor: 'pointer',
		padding: '8px',
		'border-radius': '4px',
		transition: 'background-color 0.2s'
	},

	expandIcon: {
		'font-size': '12px',
		transition: 'transform 0.2s'
	},

	expandableContent: {
		display: 'none',
		'margin-top': '12px',
		padding: '12px',
		'background-color': '#fff',
		'border-radius': '4px',
		'box-shadow': 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
	},

	expandHeaderText: {
		'text-decoration': 'underline',
		'font-size': '13px',
		'font-weight': '500'
	}
}

/**
 * Applies styles to a D3 selection
 */
export function applyStyles(selection: any, styles: Record<string, string>) {
	Object.entries(styles).forEach(([property, value]) => {
		selection.style(property, value)
	})
	return selection
}

/**
 * Creates a labeled number input with consistent styling
 */
export function createNumberInput(
	container: any,
	config: {
		label: string
		value: number
		min?: number
		max?: number
		step?: number | string
		width?: string
		onChange: (value: number) => void
		labelWidth?: string
	}
) {
	const inputContainer = container.append('div')
	applyStyles(inputContainer, STYLES.flexRow)

	const label = inputContainer.append('label')
	applyStyles(label, STYLES.label)
	if (config.labelWidth) {
		label.style('min-width', config.labelWidth)
	}
	label.text(config.label)

	const input = inputContainer.append('input').attr('type', 'number').attr('value', config.value)

	applyStyles(input, STYLES.numberInput)

	if (config.min !== undefined) input.attr('min', config.min)
	if (config.max !== undefined) input.attr('max', config.max)
	if (config.step !== undefined) input.attr('step', config.step)
	if (config.width) input.style('width', config.width)

	input.on('input', function (this: HTMLInputElement) {
		const value = parseFloat(this.value)
		if (!isNaN(value)) {
			config.onChange(value)
		}
	})

	return { container: inputContainer, input, label }
}

/**
 * Creates a checkbox with label
 */
export function createCheckbox(
	container: any,
	config: {
		id: string
		label: string
		checked: boolean
		onChange: (checked: boolean) => void
	}
) {
	const checkboxContainer = container.append('div')
	applyStyles(checkboxContainer, STYLES.flexRow)

	const checkbox = checkboxContainer
		.append('input')
		.attr('type', 'checkbox')
		.attr('id', config.id)
		.property('checked', config.checked)

	applyStyles(checkbox, STYLES.checkbox)

	const label = checkboxContainer.append('label').attr('for', config.id).text(config.label)

	applyStyles(label, STYLES.checkboxLabel)

	checkbox.on('change', function (this: HTMLInputElement) {
		config.onChange(this.checked)
	})

	return { container: checkboxContainer, checkbox, label }
}

/**
 * Creates an options table with consistent styling
 */
export function createOptionsTable(container: any) {
	const table = container.append('table')
	applyStyles(table, STYLES.optionsTable)
	return table
}

/**
 * Creates a table header row
 */
export function createTableHeader(table: any, columns: string[]) {
	const headerRow = table.append('tr')

	columns.forEach((columnText, index) => {
		const th = headerRow.append('th')
		applyStyles(th, STYLES.tableHeader)
		if (index === 0) {
			th.style('width', '200px')
		}
		th.text(columnText)
	})

	return headerRow
}

/**
 * Creates a table row with checkbox and options
 */
export function createDataTypeRow(
	table: any,
	config: {
		id: string
		label: string
		checked: boolean
		onChange: (checked: boolean) => void
		createOptionsContent: (container: any) => void
	}
) {
	const row = table.append('tr')

	// Checkbox cell
	const checkboxCell = row.append('td')
	applyStyles(checkboxCell, STYLES.tableCell)

	const { checkbox } = createCheckbox(checkboxCell, {
		id: config.id,
		label: config.label,
		checked: config.checked,
		onChange: config.onChange
	})

	// Options cell
	const optionsCell = row.append('td')
	applyStyles(optionsCell, STYLES.tableCell)

	const optionsContainer = optionsCell.append('div').style('display', config.checked ? 'block' : 'none')

	config.createOptionsContent(optionsContainer)

	return { row, optionsContainer, checkbox }
}

/**
 * Creates an expandable section with header and content
 */
export function createExpandableSection(
	container: any,
	config: {
		headerText: string
		headerColor?: string
		backgroundColor?: string
		borderColor?: string
		onToggle?: (expanded: boolean) => void
	}
) {
	const expandableContainer = container.append('div').style('margin-top', '12px')

	// Create header
	const header = expandableContainer.append('div')
	applyStyles(header, STYLES.expandableHeader)

	const bgColor = config.backgroundColor || 'rgba(220, 53, 69, 0.1)'
	const borderColor = config.borderColor || 'rgba(220, 53, 69, 0.2)'
	const hoverColor = config.backgroundColor?.replace('0.1)', '0.15)') || 'rgba(220, 53, 69, 0.15)'

	header
		.style('background-color', bgColor)
		.style('border', `1px solid ${borderColor}`)
		.on('mouseenter', function (this: HTMLElement) {
			header.style('background-color', hoverColor)
		})
		.on('mouseleave', function (this: HTMLElement) {
			header.style('background-color', bgColor)
		})

	// Expand icon
	const expandIcon = header.append('span')
	applyStyles(expandIcon, STYLES.expandIcon)
	expandIcon.style('color', config.headerColor || '#dc3545').text('▶')

	// Header text
	const headerText = header.append('span')
	applyStyles(headerText, STYLES.expandHeaderText)
	headerText.style('color', config.headerColor || '#dc3545').text(config.headerText)

	// Content (hidden by default)
	const content = expandableContainer.append('div')
	applyStyles(content, STYLES.expandableContent)
	content.style('border', `1px solid ${borderColor}`)

	// Track state and add click handler
	let isExpanded = false
	header.on('click', function () {
		isExpanded = !isExpanded
		if (isExpanded) {
			content.style('display', 'block')
			expandIcon.style('transform', 'rotate(90deg)').text('▼')
		} else {
			content.style('display', 'none')
			expandIcon.style('transform', 'rotate(0deg)').text('▶')
		}
		config.onToggle?.(isExpanded)
	})

	return { container: expandableContainer, header, content, expandIcon }
}

/**
 * Creates an info panel with consistent styling
 */
export function createInfoPanel(
	container: any,
	config: {
		title?: string
		content: string
		color?: string
	}
) {
	const panel = container.append('div')
	applyStyles(panel, STYLES.infoPanel)

	if (config.color) {
		panel.style('border-left-color', config.color)
	}

	if (config.title) {
		panel.append('strong').text(config.title)
		panel.append('br')
	}

	panel.append('span').html(config.content)

	return panel
}
