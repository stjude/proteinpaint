/*
Offer back the geneVariant settings that a user built earlier for the gene(s) they just
picked, so that a grouping is reused rather than rebuilt -- e.g. a BCR-ABL1 fusion grouping
built as a barchart overlay, offered again when the same gene becomes a survival overlay.
The settings themselves are remembered by remember_gvq() in client/mass/store.ts.

Kept apart from any one gene-picking UI, since a gene is picked in several: the search
handler in ./geneVariant.ts, and the chart-specific menus in client/plots/ that run their
own gene searchbox. Each of those decides *whether* to offer (see below); this renders.

!!! NOTE !!!
Only offer where the q of the selected term reaches the consumer. A UI that keeps just the
term{} -- or that pins the q itself, as the mutation-vs-cnv menus do with q.dtLst -- would
show the user a setting it then discards or overrides. See keepsQ in
client/termdb/TermTypeSearch.ts for how the tree states this.
*/

type RememberedQOpts = {
	/** where the options are rendered. Emptied and hidden on every call, so the same holder
	 * can be reused as the user picks one gene after another */
	holder: any
	/** supplies the remembered settings, and returns none outside a mass app */
	vocabApi: any
	/** the geneVariant term just picked */
	term: any
	/** names the option that declines the remembered settings, in the caller's own terms,
	 * e.g. 'Continue with SNV/indel (somatic)' */
	skipLabel: string
	/** called with the q of the picked setting, or with nothing when it is declined */
	callback: (q?: any) => void | Promise<void>
}

/** True when settings were offered, so that the caller waits for a choice instead of
 * proceeding with the q it would otherwise have built */
export function mayShowRememberedGvQ(opts: RememberedQOpts): boolean {
	const { holder, vocabApi, term, skipLabel, callback } = opts
	holder.style('display', 'none').selectAll('*').remove()

	// getGvQLst() is only defined by a host app whose store remembers these
	const lst = vocabApi.getGvQLst?.(term) || []
	if (!lst.length) return false

	const div = holder.style('display', 'block')
	div
		.append('div')
		.style('margin-bottom', '5px')
		.style('opacity', 0.65)
		.style('font-size', '.9em')
		.text(`Previously used for ${term.name}`)

	/* these options are rendered after any enclosing menu has already wired its own tab
	navigation, which only covers what existed when the menu opened (see setTabNavigation()
	in client/dom/menu.js), so each one makes itself keyboard operable */
	const options: any[] = []
	const addOption = (label: string, onActivate: () => void | Promise<void>) => {
		const option = div
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('tabindex', 0)
			.attr('role', 'button')
			.text(label)
			.on('click', onActivate)
			.on('keydown', (event: KeyboardEvent) => {
				/* activating on keydown rather than keyup: a gene is picked by pressing Enter in the
				search box above, and the keyup of that same press would otherwise land on the option
				focused below and apply it without the user choosing it */
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault()
					;(event.target as HTMLElement).click()
					return
				}
				const step = event.key == 'ArrowDown' ? 1 : event.key == 'ArrowUp' ? -1 : 0
				if (!step) return
				// wraps, so that arrowing past either end stays within the options
				const i = options.indexOf(option)
				options[(i + step + options.length) % options.length].node().focus()
				event.preventDefault() // arrowing moves the focus, it does not scroll the menu
			})
		options.push(option)
		return option
	}

	for (const entry of lst) {
		addOption(entry.label, async () => await callback(entry.q)).attr('data-testid', 'sjpp-genevariant-rememberedQ')
	}
	addOption(skipLabel, async () => await callback()).style('margin-top', '8px')

	// the most recent setting is the likely choice, so it starts focused
	options[0].node().focus()
	return true
}
