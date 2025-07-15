import type { Tr } from '../../types/d3'
/** Types for #dom/table */

export type TableCell = {
	/** to print in <a> element */
	url?: string
	/** to print with .text() d3 method */
	value?: string | number
	/** color code to render as a color cell or, if value provided, cell font-color */
	color?: string
	/** to print with .html() d3 method, may be susceptible to attack
	 * If an a tag is used, 'onclick="event.stopPropagation()"' is
	 * added before the end of the opening tag to prevent uncheck the box. */
	html?: string
	/** is attached to each cell object pointing to <td>, for external code to render interactive contents in it */
	__td?: any
	disabled?: boolean
	/** may be used as a reference ID for aria-labelledby, or other use */
	elemId?: string
}

export type TableColumn = {
	/** the text to show as header of a column */
	label: string
	/** column width */
	width?: string
	/** method to fill contents to a cell. cell.url/value/html/color will override this setting! doesn't support async */
	fillCell?: (td: any, i: number) => void
	/** Makes this column editable  and allows to notify the change
	 * through the callback. It is only allowed for cells with a value or a color field */
	editCallback?: (i: number, cell: TableCell) => void
	/** set white-space=nowrap on all <td> of this column so strings do not wrap */
	nowrap?: boolean
	/** left, center, right. If missing it is aligned to the left by default */
	align?: string
	/** tooltip describing column content */
	tooltip?: string
	/** Used for sorting function
	 * Do not use this field for html columns */
	sortable?: boolean
	/** assume all values from this column are numbers; this renders the column into a barplot */
	barplot?: TableBarplot
}

export type TableBarplot = {
	/** width of numerical axis, also defines bar plotting width */
	axisWidth?: number
	/** color for negative value bars */
	colorNegative?: string
	/** color for positive value bars */
	colorPositive?: string
	/** horizontal padding on left/right of axis, svg scale width=axisWidth+xpadding*2 */
	xpadding?: number
	/** dynamically assigned d3 scale; not a parameter */
	scale?: any
	/** number of ticks to override an default */
	tickCount?: number
	/** tick format string */
	tickFormat?: string
}

export type TableButton = {
	dataTestId?: any
	/** the text to show in the button */
	text: string
	/** called when the button is clicked. Receives selected indexes and the button dom object */
	callback: (idxs: number[], button: any) => void
	disabled?: (index: number) => boolean
	button: any
	/** Called when selecting rows, it would update the button text */
	onChange?: (idx: number[], button: any) => void
	/** to customize button style or to assist detection in testing */
	class?: string
}

/** ariaLabelledBy is an optional attribute on the array object,
 * if present, will be used as aria-labelledby attribute on the
 * radio or checkbox input element, to address Section 508 requirement */
export type TableRow = TableCell[] & { ariaLabelledBy?: string }

export type TableArgs = {
	/** List of table columns */
	columns: TableColumn[]
	/** each element is an array of cells for a row, with array length must matching columns length */
	rows: TableRow[]
	/** Holder to render the table */
	div: any
	/** adds a special column. in each row at this column, render some buttons to perform action on that row.
    column position and header is fixed!
    good for Delete btn
    */
	columnButtons?: TableButton[]
	/** List of buttons to do actions after the table is edited */
	buttons?: TableButton[]
	/** Function that will be called when a row is selected */
	noButtonCallback?: (i: number, node: any) => void
	/** true for single-selection. use radio button instead of checkboxes for multiselect */
	singleMode?: boolean
	/** true to show no radio buttons. should only use when singleMode=true */
	noRadioBtn?: boolean
	/** set to false to hide line numbers */
	showLines?: boolean
	/** When active makes the table rows to alternate bg colors */
	striped?: boolean
	/** Render header or not */
	showHeader?: boolean
	/** Options for rendering the header */
	header?: {
		/** allow sorting from column headers */
		allowSort?: boolean
		/**  object of key-value pairs to customize style of header <th> elements, e.g. {'font-size':'1.1em', ...} */
		style?: object
	}
	/** The max width of the table, 90vw by default. */
	maxWidth?: string
	/** The max height of the table, 40vh by default */
	maxHeight?: string
	/** Preselect rows specified by index */
	selectedRows?: number[]
	/** Preselect all rows */
	selectAll?: boolean
	/** Allow to resize the table height dragging the border*/
	resize?: boolean
	/** An object of arbitrary css key-values on how to style selected rows,
	 * for example `{text-decoration: 'line-through'}`. If a row is not
	 * selected, each css property will be set to an empty string ''*/
	selectedRowStyle?: any
	/** For testing purposes */
	inputName?: any
	/** optional. value is predefined input name. this allows test to work.
	 * when not available, for each table made, create a unique name to use
	 * as the <input name=?> if the same name is always used, multiple tables
	 * created in one page will conflict in row selection */
	dataTestId?: any
	/** Show download icon that allows to download the table content and allow; object allows customization options e.g. placement of the button, styling, tooltip etc */
	download?: {
		/** optionally, provide download file name, if missing a default one is used */
		fileName?: string
	}
	/** Add row eventlisteners here
	 * eg.. () => {
	 * //logic for event listener with row data
	 * tr.on('mouseover', function() { //something })
	 * tr.on('mouseleave', function() { //something })
	 * }
	 * *** Do not *** use this for a click event!
	 * use noButtonCallback instead
	 */
	hoverEffects?: (tr: Tr, row: TableRow) => void
}
