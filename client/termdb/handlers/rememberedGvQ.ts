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
	/** the mutation type the caller has selected, so that a setting built for that same
	 * mutation type can lead -- a dt term, or an entry declaring the dts[] it spans as the
	 * Bi/mono-allelic groupset does. Omitted by a UI that offers no such choice, which leaves
	 * the remembered settings in the order they arrived */
	mutationType?: { dt?: number; origin?: string; dts?: number[] }
	/** names the option that declines the remembered settings, in the caller's own terms,
	 * e.g. 'Continue with SNV/indel (somatic)' */
	skipLabel: string
	/** called with the q of the picked setting, or with nothing when it is declined */
	callback: (q?: any) => void | Promise<void>
}

/** True when settings were offered, so that the caller waits for a choice instead of
 * proceeding with the q it would otherwise have built */
export function mayShowRememberedGvQ(opts: RememberedQOpts): boolean {
	const { holder, vocabApi, term, mutationType, skipLabel, callback } = opts
	holder.style('display', 'none').selectAll('*').remove()

	// getGvQLst() is only defined by a host app whose store remembers these
	const lst = vocabApi.getGvQLst?.(term) || []
	if (!lst.length) return false

	const div = holder.style('display', 'block')

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

	const addHeader = () =>
		div
			.append('div')
			.style('margin-bottom', '5px')
			.style('opacity', 0.65)
			.style('font-size', '.9em')
			.text(`Previously used for ${term.name}`)
	const addRemembered = (entries: any[]) => {
		for (const entry of entries) {
			addOption(entry.label, async () => await callback(entry.q)).attr('data-testid', 'sjpp-genevariant-rememberedQ')
		}
	}
	const addSkip = () => addOption(skipLabel, async () => await callback())

	/* a setting built for the mutation type the caller has selected is what the user would
	otherwise rebuild by hand, so it leads; the settings of other mutation types keep their
	place behind it, most recent first */
	const matched = lst.filter((entry: any) => matchesMutationType(entry.q, mutationType))
	if (matched.length) {
		addHeader()
		addRemembered([...matched, ...lst.filter((entry: any) => !matched.includes(entry))])
		addSkip().style('margin-top', '8px')
	} else {
		/* nothing was remembered for the selected mutation type, so continuing with it is the
		likely choice and leads, with what was built for other mutation types offered below */
		addSkip()
		addHeader().style('margin-top', '12px')
		addRemembered(lst)
	}

	// the leading option is the likely choice, so it starts focused
	options[0].node().focus()
	return true
}

/*
Whether a remembered setting was built for the mutation type the caller has selected: it
filters by exactly the dt term(s) of that type, e.g. a grouping of SNV/indel (somatic)
classes when that radio is selected, or one spanning snvindel and cnv for Bi/mono-allelic.
Origin counts, since a dataset that separates somatic from germline offers a mutation type,
and hence a grouping, for each.

A caller that names no mutation type matches everything, leaving the settings in the order
it found them.
*/
function matchesMutationType(q: any, mutationType?: RememberedQOpts['mutationType']): boolean {
	if (!mutationType) return true
	// a mutation type that names no dt cannot be matched against, so nothing leads
	if (!mutationType.dts?.length && !Number.isInteger(mutationType.dt)) return false
	const selected = new Set(
		mutationType.dts?.length
			? mutationType.dts.map(dt => getDtKey(dt))
			: [getDtKey(mutationType.dt, mutationType.origin)]
	)
	const filtered = getFilteredDtKeys(q)
	return filtered.size == selected.size && [...filtered].every(key => selected.has(key))
}

const getDtKey = (dt?: number, origin?: string) => `${dt}|${origin || ''}`

/* the dt term(s) a remembered setting filters by, as dt+origin keys.

Reads the tvs of each group filter rather than every nested tvs, the way getDtsFromGroups()
in shared/utils/src/terms.ts does: the maf filter nested in a bi/mono-allelic tvs wraps a
dictionary term, which is not a dt the setting filters by. */
function getFilteredDtKeys(q: any): Set<string> {
	const keys = new Set<string>()
	const readFilter = (filter: any) => {
		for (const item of filter?.lst || []) {
			if (item.type == 'tvslst') readFilter(item)
			else if (item.tvs?.term) keys.add(getDtKey(item.tvs.term.dt, item.tvs.term.origin))
		}
	}
	for (const group of q?.customset?.groups || []) readFilter(group.filter)
	return keys
}
