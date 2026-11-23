import { TableBase, Menu, icons, downloadTable, geneActionButtons } from '#dom'
import type { TableBaseColumn, TableBaseRow } from '#dom'

/** One line of the download icon's menu */
export type DownloadLine = { text: string; callback: () => void | Promise<void>; testId?: string }

export type GRIN2TopGenesTableOpts = {
	/** d3 selection to render into */
	holder: any
	/** mass app, for the Matrix and Lollipop buttons */
	app: any
	/** the first column holds the lesion-type circles (a cell's html); the others are the columns of the server's table */
	columns: TableBaseColumn[]
	rows: TableBaseRow[]
	/** the server's rows, without the circles column, in the order of `rows`: the Matrix and Lollipop buttons read
	 * gene names from them */
	dataItems: any[]
	/** the first line of the download icon's menu, and the tooltip of the icon */
	downloadTitle: string
	/** file name of the download of this table */
	fileName: string
	/** More lines for the download icon's menu, e.g. a download of more than this table holds. With none, a click on the
	 * icon downloads the table at once. */
	moreDownloads?: DownloadLine[]
}

/** CSS of the header cells: what the table had before it was a TableBase */
const HEADER_STYLE = { 'font-weight': 'bold', 'background-color': '#f8f8f8' }

/** Rows beyond which the table gets a fixed height, so that the user can drag its corner to resize it */
const RESIZABLE_FROM_ROWS = 15

/**
 * The top-genes table of a GRIN2 analysis, as a TableBase: a column of lesion-type circles, a sortable and
 * filterable column for each statistic, Matrix and Lollipop buttons for the selected genes, a button that clears
 * the sort and filters, and a download icon whose menu can offer more than this table.
 *
 * Behavior TableBase does not have is added here, as its README asks, by overriding its extension points:
 * render() and remove() for the download icon, createFooter() and applyViewChange() for the reset button,
 * createWrapper() for resizing, createTable() for the table's name.
 */
export class GRIN2TopGenesTable extends TableBase {
	private downloadTitle: string
	private fileName: string
	private moreDownloads: DownloadLine[]
	private downloadDiv?: any
	private downloadMenu?: any
	private resetButton?: any

	constructor(opts: GRIN2TopGenesTableOpts) {
		super({
			div: opts.holder,
			// every statistic can be sorted, so every one can be filtered too, e.g. ">=10" in a subject count
			columns: opts.columns.map(column => ({ ...column, filterable: column.sortable })),
			rows: opts.rows,
			dataTestId: 'sjpp-grin2-top-genes-table',
			styles: { maxWidth: '100%', maxHeight: '400px', header: HEADER_STYLE, buttonsAlign: 'left' },
			// the buttons make the rows selectable
			buttons: geneActionButtons({
				app: opts.app,
				dataItems: opts.dataItems,
				getRowKey: row => row[0]?.value,
				matrixButtonFormat: 'Matrix ({n} genes selected)'
			})
		})
		this.downloadTitle = opts.downloadTitle
		this.fileName = opts.fileName
		this.moreDownloads = opts.moreDownloads ?? []
		this.render()
	}

	/* ---- download ---- */

	render(): this {
		super.render()
		this.renderDownloadIcon()
		return this
	}

	remove(): void {
		this.downloadMenu?.destroy()
		this.downloadMenu = undefined
		this.downloadDiv?.remove()
		this.downloadDiv = undefined
		super.remove()
	}

	/** The download icon, to the left of the table */
	private renderDownloadIcon() {
		this.downloadDiv = this.div
			.insert('div', () => this.wrapper.node())
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('vertical-align', 'top')
		icons['download'](this.downloadDiv, {
			width: 15,
			height: 15,
			title: this.downloadTitle,
			handler: () => this.onDownloadClick()
		})
	}

	/** Downloads the rows that pass the filters, in the order the table shows them, as TSV. The circles column is
	 * left out: it has no label and no text. */
	downloadRows() {
		downloadTable(
			this.matched.map(row => row.slice(1)),
			this.columns.slice(1),
			this.fileName
		)
	}

	private onDownloadClick() {
		if (!this.moreDownloads.length) return this.downloadRows()
		if (!this.downloadMenu) this.downloadMenu = new Menu({ padding: '0px' })
		this.downloadMenu.clear()
		const lines: DownloadLine[] = [
			{ text: this.downloadTitle, callback: () => this.downloadRows(), testId: 'sjpp-grin2-download-top-genes' },
			...this.moreDownloads
		]
		for (const line of lines) {
			this.downloadMenu.d
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('data-testid', line.testId)
				.attr('role', 'button')
				.attr('tabindex', 0)
				.text(line.text)
				.on('click', () => {
					this.downloadMenu.hide()
					line.callback()
				})
				// Menu.setTabNavigation() clicks on Enter (keyup); Space is the other key that presses a button.
				// keydown, not keyup, so the menu still adds its own Enter handler, and the page does not scroll.
				.on('keydown', (event: KeyboardEvent) => {
					if (event.key != ' ') return
					event.preventDefault()
					;(event.currentTarget as HTMLElement).click()
				})
		}
		this.downloadMenu.showunder(this.downloadDiv.node())
	}

	/* ---- reset table ---- */

	/** The reset button goes first in the bar of buttons, hidden until the table is sorted or filtered (render() keeps
	 * both) */
	protected createFooter(): void {
		super.createFooter()
		this.resetButton = this.footer
			.select('.sjpp-table-buttons')
			.insert('button', ':first-child')
			.attr('type', 'button')
			.attr('data-testid', 'sjpp-table-restore-button')
			.style('display', this.resetButtonDisplay())
			.text('Reset table')
			.on('click', () => this.resetTable())
	}

	/** Back to the rows and the order the server sent: clears the sort and the filters. The selection stays. */
	resetTable(): this {
		this.sortState = undefined
		this.filters.clear()
		// text still waiting to be applied would bring a filter back
		this.typedFilter.clear()
		this.applyViewChange(() => 'Reset the table: cleared the sort and the filters')
		return this
	}

	protected applyViewChange(message: () => string): void {
		super.applyViewChange(message)
		this.resetButton?.style('display', this.resetButtonDisplay())
	}

	private resetButtonDisplay() {
		return this.sortState || this.filters.size ? null : 'none'
	}

	/* ---- accessible name ---- */

	/** Named by a visually hidden caption, not the ariaLabel option: style.css shows any aria-label as a hover tooltip,
	 * which on a table appears wherever the mouse is over it. */
	protected createTable() {
		const table = super.createTable()
		table
			.append('caption')
			.text('GRIN2 top genes')
			.style('position', 'absolute')
			.style('width', '1px')
			.style('height', '1px')
			.style('overflow', 'hidden')
			.style('clip', 'rect(0 0 0 0)')
			.style('white-space', 'nowrap')
		return table
	}

	/* ---- resize ---- */

	/** The corner of the table can be dragged to resize it. That needs a height, not only a maximum, and no
	 * inherited max-height, which would stop the table from being dragged taller than it starts. */
	protected createWrapper() {
		const wrapper = super.createWrapper().style('resize', 'both').style('max-height', null)
		if (this.originalRows.length > RESIZABLE_FROM_ROWS) wrapper.style('height', this.styles.maxHeight)
		return wrapper
	}
}
