import { Menu } from '#dom'
import { sayerror } from '../../dom/sayerror.ts'

/** The popup under the search input that holds results, the no-match message, and inline pickers (genome
 * browser view chooser, methylation region picker, survival term tree). Owns the Menu and its timers so no
 * other module touches them. */
export class ResultsPopup {
	tip: any
	/** where results/pickers render; same node as tip.d */
	resultDiv: any
	inputNode: HTMLInputElement
	private noResultTimer?: ReturnType<typeof setTimeout>
	/** the "No match" message is shown once at the first miss, not on every keystroke */
	private noMatchShown = false
	private noMatchText: string

	constructor(inputNode: HTMLInputElement, opts: { noMatchText: string }) {
		this.inputNode = inputNode
		this.noMatchText = opts.noMatchText
		this.tip = new Menu({ padding: '5px' })
		this.resultDiv = this.tip.d
			.style('border-left', 'solid 1px rgb(133,182,225)')
			.style('padding-left', '5px')
			.attr('tabindex', -1)
	}

	/** empty the popup; hide it, or keep it open under the input */
	clear(opts: { hide?: boolean } = {}) {
		this.tip.clear()
		if (opts.hide) this.tip.hide()
		else this.tip.showunder(this.inputNode)
	}

	/** dismiss the popup and forget the no-match state (input cleared, tab left, plot launched) */
	hide() {
		clearTimeout(this.noResultTimer)
		this.noMatchShown = false
		this.clear({ hide: true })
	}

	/** show a table with one <tr> per row, rendered by `renderRow` */
	showRows<T>(rows: T[], renderRow: (tr: any, row: T) => void) {
		// cancel any pending no-match hide so a stale timer can't wipe these results
		clearTimeout(this.noResultTimer)
		this.noMatchShown = false
		this.clear({ hide: !rows.length })
		if (!rows.length) return
		const table = this.resultDiv.append('table')
		for (const row of rows) renderRow(table.append('tr'), row)
	}

	/** "No match" message, auto-hidden after a delay. Tracked so successive misses don't stack timers and
	 * showRows can cancel it. */
	showNoMatch() {
		if (this.noMatchShown) return
		this.noMatchShown = true
		this.clear()
		this.resultDiv.append('div').text(this.noMatchText).style('padding', '3px 3px 3px 0px').style('opacity', 0.5)
		clearTimeout(this.noResultTimer)
		// keep noMatchShown set so further misses while typing don't re-show the message
		this.noResultTimer = setTimeout(() => this.clear({ hide: true }), 1500)
	}

	/** replace the popup content with a titled holder for an inline picker */
	openPicker(title?: string) {
		this.tip.clear()
		this.tip.showunder(this.inputNode)
		const holder = this.resultDiv.append('div').style('margin', '10px')
		if (title) holder.append('div').style('margin-bottom', '5px').text(title)
		return holder
	}

	showError(e: any) {
		sayerror(this.resultDiv, 'Error: ' + (e?.message || e))
	}
}
