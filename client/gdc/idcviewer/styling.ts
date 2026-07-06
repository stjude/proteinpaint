import type { BaseType, Selection } from 'd3-selection'

export type StyleDict = Record<string, string>

export function applyStyles<GElement extends BaseType, Datum, PElement extends BaseType, PDatum>(
	selection: Selection<GElement, Datum, PElement, PDatum>,
	styles: StyleDict
): Selection<GElement, Datum, PElement, PDatum> {
	for (const [name, value] of Object.entries(styles)) {
		selection.style(name, value)
	}
	return selection
}

export const sharedStyles = {
	centeredFlex: {
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'center'
	},
	transparentButton: {
		cursor: 'pointer',
		background: 'transparent',
		border: 'none',
		padding: '0',
		margin: '0',
		appearance: 'none'
	}
} satisfies Record<string, StyleDict>
export const sharedColors = {
	borderColor: '#4c4c4c',
	mainHeaderBgColor: '#f5f5f5',
	mainHeaderHoverBgColor: '#e6e6e6',
	detailsHeaderBgColor: '#e0e0e0',
	fullWhiteBgColor: '#ffffff',
	activeColor: '#c7501a'
}
export const sharedStyleFns = {
	display: (value: string): StyleDict => ({
		display: value
	})
}

export const idcViewerStyles = {
	loadingDiv: {
		display: 'none',
		'background-color': 'rgba(255, 255, 255, 0.8)',
		position: 'absolute',
		top: '0',
		left: '0',
		width: '100%',
		height: '100%'
	},
	searchDiv: {
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'space-between',
		'flex-wrap': 'wrap',
		'flex-direction': 'row'
	}
} satisfies Record<string, StyleDict>

export const idcSearchStyles = {
	releaseText: {
		'font-size': '6px'
	},
	searchInputHolder: {
		display: 'flex',
		'align-items': 'center',
		'flex-wrap': 'wrap',
		'flex-direction': 'row',
		gap: '10px'
	},
	caseCount: {
		'font-size': '18px',
		'font-family': 'Noto Sans, sans-serif',
		display: 'flex',
		'align-items': 'center',
		padding: '5px 10px'
	},
	inputDiv: {
		display: 'flex',
		'align-items': 'center',
		'justify-content': 'center',
		'min-height': '30px',
		border: '1px solid #ccc',
		'border-radius': '4px',
		padding: '0 5px'
	},
	searchIcon: {
		height: '100%',
		'aspect-ratio': '1 / 1'
	},
	searchInput: {
		'min-width': '200px',
		height: '100%',
		border: 'none',
		'background-color': 'transparent',
		outline: 'none'
	}
} satisfies Record<string, StyleDict>

export const idcTableStyles = {
	holder: {
		'font-family': 'Noto Sans, sans-serif'
	},
	table: {
		width: '100%',
		'border-collapse': 'collapse',
		'font-size': '14px'
	},
	headerRow: {
		'background-color': sharedColors.mainHeaderBgColor,
		height: '3rem'
	},
	headCell: {
		'text-align': 'left',
		'align-items': 'center',
		'background-color': sharedColors.mainHeaderBgColor,
		'font-family': 'Montserrat, sans-serif',
		'font-weight': '600',
		padding: '10px',
		gap: '5px'
	},
	headerLabelDiv: {
		display: 'flex',
		'align-items': 'left',
		gap: '5px'
	},
	activeSortIcon: {
		color: sharedColors.activeColor
	},
	paginationWrapper: {
		display: 'flex',
		'justify-content': 'space-between',
		'align-items': 'center',
		'flex-wrap': 'wrap',
		padding: '0.5rem'
	},
	pageSizeSelection: {
		display: 'flex',
		'align-items': 'center',
		gap: '0.5rem'
	},
	pageSizeDropdown: {
		position: 'relative'
	},
	pageSizeButton: {
		'min-width': '55px',
		gap: '0.5rem',
		padding: '0.3rem 0.45rem',
		'border-radius': '4px',
		'background-color': sharedColors.fullWhiteBgColor,
		cursor: 'pointer'
	},
	pageSizeChevron: {
		'font-size': '15px'
	},
	pageSizeOptionsPanel: {
		display: 'none',
		position: 'absolute',
		top: 'calc(100% + 4px)',
		left: '0',
		'min-width': '100%',
		'border-radius': '4px',
		'background-color': sharedColors.fullWhiteBgColor,
		'box-shadow': '0 4px 12px rgba(0,0,0,0.12)',
		'z-index': '1'
	},
	pageSizeOptionButton: {
		width: '100%',
		padding: '0.35rem 0.5rem',
		display: 'flex',
		'justify-content': 'space-between',
		'align-items': 'center',
		border: 'none',
		'background-color': sharedColors.fullWhiteBgColor,
		cursor: 'pointer'
	},
	selectedOptionCheck: {
		color: '#2a6f2a'
	},
	paginationSummary: {
		'font-size': '18px'
	},
	pageControlsDiv: {
		display: 'flex',
		gap: '0.5rem',
		'flex-wrap': 'wrap',
		'align-items': 'center',
		'justify-content': 'center'
	},
	activePageButton: {
		'font-weight': 'bold',
		'background-color': sharedColors.activeColor,
		padding: '3px'
	},
	disabledPaginationButton: {
		cursor: 'not-allowed'
	},
	detailsTable: {
		width: '100%',
		'border-collapse': 'collapse'
	},
	detailsHeaderRow: {
		'background-color': sharedColors.detailsHeaderBgColor
	},
	detailsHeaderCell: {
		padding: '8px',
		'text-align': 'left',
		'font-weight': '500'
	},
	cellLinkContainer: {
		display: 'flex',
		'align-items': 'center'
	},
	studyLink: {
		color: 'black',
		'font-size': '16px'
	},
	missingStudyMark: {
		'font-size': '16px'
	},
	studyCellDiv: {
		display: 'flex',
		'align-items': 'center',
		gap: '5px',
		color: sharedColors.activeColor,
		cursor: 'pointer'
	},
	studyCellButton: {
		display: 'flex',
		'align-items': 'center',
		gap: '5px'
	}
} satisfies Record<string, StyleDict>

export const idcTableStyleFns = {
	tableBorder: (color: string): StyleDict => ({
		border: `1px solid ${color}`
	}),
	headerRowBorder: (color: string): StyleDict => ({
		'border-bottom': `2px solid ${color}`
	}),
	headCellCursor: (isSortable: boolean): StyleDict => ({
		cursor: isSortable ? 'pointer' : 'default'
	}),
	bodyRowBg: (color: string): StyleDict => ({
		'background-color': color
	}),
	rowBottomBorder: (color: string): StyleDict => ({
		'border-bottom': `1px solid ${color}`
	}),
	paddingCell: (padding: string): StyleDict => ({
		padding
	}),
	cellColor: (color: string): StyleDict => ({
		color
	}),
	paginationBorder: (color: string): StyleDict => ({
		border: `1px solid ${color}`
	}),
	pageSizeButtonBorder: (color: string): StyleDict => ({
		border: `1px solid ${color}`
	}),
	optionsPanelBorder: (color: string): StyleDict => ({
		border: `1px solid ${color}`
	})
}
