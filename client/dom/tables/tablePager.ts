/** Page numbers to show: the first, the last, and two either side of the current page. A gap becomes '…'. */
export function pageWindow(current: number, pages: number): (number | '…')[] {
	const shown = new Set([1, pages])
	for (let p = current - 2; p <= current + 2; p++) if (p >= 1 && p <= pages) shown.add(p)
	const sorted = [...shown].sort((a, b) => a - b)
	const items: (number | '…')[] = []
	sorted.forEach((page, i) => {
		if (i && page - sorted[i - 1] > 1) items.push('…')
		items.push(page)
	})
	return items
}

/** "Showing 11 to 20 of 25 entries". pageStart is the 0-based index of the first row on the page. */
export function pageInfoText(pageStart: number, pageSize: number, total: number): string {
	if (total === 0) return 'Showing 0 entries'
	const end = Math.min(pageStart + pageSize, total)
	return `Showing ${(pageStart + 1).toLocaleString()} to ${end.toLocaleString()} of ${total.toLocaleString()} entries`
}

/** Builds the pager once: the rows-per-page select, and empty holders for the info text and the buttons,
 * which renderPagerNav() and pageInfoText() fill on every page change. */
export function createPager(
	footer: any,
	opts: { pageSizeOptions: number[]; pageSize: number; onPageSize: (size: number) => void }
): { info: any; nav: any } {
	const pager = footer
		.append('div')
		.attr('class', 'sjpp-table-pager')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'space-between')
		.style('flex-wrap', 'wrap')
		.style('gap', '8px')
		.style('padding', '8px 4px')
		.style('font-size', '0.9em')

	const left = pager.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '8px')
	left.append('span').text('Show')
	const select = left
		.append('select')
		.attr('aria-label', 'Rows per page')
		.attr('class', 'sjpp-table-page-size')
		.style('padding', '2px 4px')
		.on('change', (event: Event) => opts.onPageSize(Number((event.target as HTMLSelectElement).value)))
	for (const size of opts.pageSizeOptions) {
		select
			.append('option')
			.attr('value', size)
			.property('selected', size === opts.pageSize)
			.text(size)
	}
	left.append('span').text('entries')

	return {
		info: pager.append('div').attr('class', 'sjpp-table-page-info'),
		nav: pager.append('nav').attr('aria-label', 'Pagination').attr('class', 'sjpp-table-page-nav')
	}
}

/** Redraws the Previous / page numbers / Next buttons. */
export function renderPagerNav(nav: any, current: number, pages: number, onGo: (page: number) => void): void {
	nav.selectAll('*').remove()
	const addButton = (text: string, page: number, disabled: boolean, label: string) => {
		const active = page === current
		const button = nav
			.append('button')
			.attr('type', 'button')
			.attr('aria-label', label)
			.text(text)
			.style('margin', '0 2px')
			.style('padding', '3px 8px')
			.style('border', '1px solid #ccc')
			.style('border-radius', '3px')
			.style('background-color', active ? '#000' : 'white')
			.style('color', active ? 'white' : disabled ? '#999' : '#000')
			.style('cursor', disabled ? 'not-allowed' : 'pointer')
		if (active) button.attr('aria-current', 'page')
		if (disabled) button.attr('disabled', 'disabled')
		else button.on('click', () => onGo(page))
	}

	addButton('Previous', current - 1, current === 1, 'Go to previous page')
	for (const item of pageWindow(current, pages)) {
		if (item === '…')
			nav.append('span').attr('aria-hidden', 'true').text('…').style('margin', '0 4px').style('color', '#999')
		else addButton(String(item), item, false, `Page ${item}`)
	}
	addButton('Next', current + 1, current === pages, 'Go to next page')
}
