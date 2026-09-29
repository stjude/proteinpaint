import { DownloadMenu } from '../downloadMenu.ts'
import { to_textfile } from '../downloadTextfile.js'

export type DownloadMenuOption = {
	/** Text shown in the menu */
	label: string
	testid?: string
	/** Return a string to save it as `<filename>.<ext>`, or handle the download
	 * yourself and return nothing. */
	callback: () => string | void | Promise<string | void>
	/** File extension used when callback returns a string. Defaults to 'txt' */
	ext?: string
	/** Overrides the menu's filename for this option */
	filename?: string
}

/** Extends DownloadMenu with plot-specific options (e.g. stats tables)
 * appended below the standard PDF/SVG/TXT options. */
export class CustomDownloadMenu extends DownloadMenu {
	extraOptions: DownloadMenuOption[]

	constructor(opts) {
		if (!opts.chartImages) throw new Error('chartImages is required')
		super(opts.chartImages, opts?.filename, opts?.textCallback)
		this.extraOptions = []
		for (const opt of opts.extraOptions || []) this.addOption(opt)
	}

	addOption(opt: DownloadMenuOption) {
		if (typeof opt?.callback != 'function') throw new Error('download option callback not function')
		this.extraOptions.push(opt)
		return this
	}

	show(x, y, elem = null) {
		super.show(x, y, elem)
		if (!this.extraOptions.length) return

		const menuDiv = this.menu.d.select(':scope > div')
		for (const opt of this.extraOptions) {
			menuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.attr('data-testid', opt.testid || null)
				.attr('tabindex', 0)
				.text(opt.label)
				.on('click', async () => {
					this.menu.hide()
					const content = await opt.callback()
					if (typeof content == 'string') {
						const name = (opt.filename || this.filename).replace(/\s/g, '_')
						to_textfile(`${name}.${opt.ext || 'txt'}`, content)
					}
				})
		}
		// re-show so the position and tab navigation account for the appended options
		this.menu.show(x - 20, y - 10, true, true, true, elem)
	}
}
