import { select } from 'd3-selection'

/*********************************************************************
 * tile cards
 *
 * Dataset-agnostic card grid shared by tile-based plots (proteinView,
 * proteome cohort compare, sampleView). Each card has a compact face and
 * may expand in place to the full grid width; one card per grid is open
 * at a time.
 *********************************************************************/

// uniform card footprint so the grid reads as even rows
const CARD_W = 230
const CARD_MIN_H = 235

// outer card width (content CARD_W + 2×12px padding + 2×1px border); the
// grid column track, so cards line up in even columns
const CARD_OUTER_W = CARD_W + 26

export function makeTileGrid(holder: any) {
	// CSS grid with fixed column tracks: an expanded card spans every column
	// (grid-column 1 / -1) and `dense` packing lets the cards after it back-fill
	// the gap it leaves in the row above, so the rest of the grid shifts around
	// it. Default align-items (stretch) equalizes card heights within a row.
	// white-space is reset because the mass plot holder sets nowrap (for
	// horizontally-scrolling plots), which would keep card text from wrapping.
	return holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', `repeat(auto-fill, ${CARD_OUTER_W}px)`)
		.style('grid-auto-flow', 'row dense')
		.style('gap', '14px')
		.style('margin-top', '10px')
		.style('white-space', 'normal')
}

/** in-place expansion of a tile card: render() fills the expanded body each
 *  time the card opens (so it reflects the current data); `open` starts the
 *  card expanded (to keep a tile open across re-renders) and onToggle reports
 *  every open/close so the caller can remember which tile is open */
export type TileExpand = {
	render: (holder: any) => void | Promise<void>
	open?: boolean
	/** with .open: settles when the face is drawn, for a face drawn after the card is made */
	faceDrawn?: Promise<unknown>
	onToggle?: (open: boolean) => void
}

// the one expanded card per grid, as its collapse function
const expandedInGrid = new WeakMap<Element, () => void>()

// clicks on these never expand a card: they belong to controls on the face
const NO_EXPAND_SELECTOR = 'button,select,input,textarea,label,a,[role="button"],[role="tab"],[data-no-expand]'

/** remember which tile of a plot instance is expanded, so a re-render (new
 *  filter, refetch, cutoff change) reopens it; one expanded tile per plot */
export function tileExpandState(self: any, key: string): Pick<TileExpand, 'open' | 'onToggle'> {
	return {
		open: self.expandedTileKey === key,
		onToggle: open => {
			if (open) self.expandedTileKey = key
			else if (self.expandedTileKey === key) self.expandedTileKey = null
		}
	}
}

export function makeTileCard(
	grid: any,
	opts: {
		title: string
		subtitle?: string
		// fixed footprint (CARD_W × ≥CARD_MIN_H) so tile cards line up evenly
		uniform?: boolean
		// with uniform: the footprint height is fixed instead of a minimum, so a taller
		// face is clipped rather than making its whole grid row taller
		fixedHeight?: boolean
		// greyed placeholder card (tile exists in the atlas but has no data here)
		disabled?: boolean
		// when set, clicking the card (or its ⤢ button) expands it in place to the
		// full grid width; ⤡ collapses it back to the face
		expand?: TileExpand
		// the grid whose one open card this is, when the card is appended into a
		// slot (a display:contents wrapper) of the grid instead of the grid itself
		openGroup?: Element
	}
) {
	const card = grid
		.append('div')
		.style('border', opts.disabled ? '1px dashed #e5e7eb' : '1px solid #e5e7eb')
		.style('border-radius', '8px')
		.style('padding', '10px 12px')
		.style('background', opts.disabled ? '#f9fafb' : '#fff')
		.style('min-width', '0')
	const fixedH = opts.uniform && opts.fixedHeight
	const setFootprint = () => {
		if (!opts.uniform) return
		card.style('width', `${CARD_W}px`).style('min-height', `${CARD_MIN_H}px`)
		if (fixedH) card.style('height', `${CARD_MIN_H}px`)
	}
	if (opts.uniform) {
		setFootprint()
		card.style('display', 'flex').style('flex-direction', 'column')
	}

	const header = card
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'baseline')
		.style('gap', '8px')
		.style('flex-wrap', 'wrap')
	header
		.append('span')
		.style('font-weight', '600')
		.style('font-size', '.9em')
		.style('min-width', '0') // let long titles wrap instead of overflowing the card
		.style('color', opts.disabled ? '#9ca3af' : '#111827')
		.text(opts.title)
	if (opts.subtitle) {
		card
			.append('div')
			.style('font-size', '.75em')
			.style('color', '#6b7280')
			.style('margin', '2px 0 4px 0')
			.text(opts.subtitle)
	}
	const face = card.append('div')
	if (fixedH) face.style('flex', '1 1 auto').style('min-height', '0').style('overflow', 'hidden')
	const expand = opts.expand
	if (!expand) return face

	const expandedBody = card.append('div').style('display', 'none').style('overflow-x', 'auto')
	const gridNode = opts.openGroup || (grid.node() as Element)
	let isOpen = false

	const toggleBtn = header
		.append('span')
		.attr('role', 'button')
		.attr('tabindex', '0')
		.style('margin-left', 'auto')
		.style('cursor', 'pointer')
		.style('color', '#9ca3af')
		.style('font-size', '1em')
		.style('line-height', '1')
		.on('mouseover', function (this: any) {
			select(this).style('color', '#374151')
		})
		.on('mouseout', function (this: any) {
			select(this).style('color', '#9ca3af')
		})
	const setToggleBtn = () =>
		toggleBtn
			.text(isOpen ? '⤡' : '⤢')
			.attr('title', isOpen ? 'Collapse' : 'Expand')
			.attr('aria-label', `${isOpen ? 'Collapse' : 'Expand'} ${opts.title}`)
			.attr('aria-expanded', String(isOpen))
	setToggleBtn()

	const collapse = () => {
		if (!isOpen) return
		isOpen = false
		if (expandedInGrid.get(gridNode) === collapse) expandedInGrid.delete(gridNode)
		const bodyNode = expandedBody.node() as HTMLElement
		// detach only the direct children: an expanded view may re-attach a kept-alive
		// subtree on the next open (selectAll('*') would also take apart its descendants)
		bodyNode.replaceChildren()
		expandedBody.style('display', 'none')
		face.style('display', null)
		card.style('grid-column', null).style('cursor', 'pointer')
		setFootprint()
		setToggleBtn()
		expand.onToggle?.(false)
	}
	const open = (scroll: boolean) => {
		if (isOpen) return
		expandedInGrid.get(gridNode)?.()
		isOpen = true
		expandedInGrid.set(gridNode, collapse)
		face.style('display', 'none')
		card
			.style('grid-column', '1 / -1')
			.style('width', null)
			.style('min-height', null)
			.style('height', null)
			.style('cursor', null)
		expandedBody.style('display', null)
		;(expandedBody.node() as HTMLElement).replaceChildren()
		setToggleBtn()
		expand.onToggle?.(true)
		const holder = expandedBody.append('div').style('padding', '4px 4px 0 4px')
		try {
			const p = expand.render(holder)
			if (p instanceof Promise) {
				const wait = holder.append('div').style('color', '#6b7280').style('font-size', '.85em').text('Loading…')
				p.catch(err => renderTileError(holder, err, null)).finally(() => wait.remove())
			}
		} catch (err: any) {
			renderTileError(holder, err, null)
		}
		if (scroll) (card.node() as HTMLElement).scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
	}

	toggleBtn
		.on('click', (event: MouseEvent) => {
			event.stopPropagation()
			if (isOpen) collapse()
			else open(true)
		})
		.on('keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault()
				if (isOpen) collapse()
				else open(true)
			}
		})
	// clicking anywhere on a collapsed card expands it, except on face controls
	// (tabs, selects, search boxes) and data marks that stop propagation
	card.style('cursor', 'pointer').on('click', (event: MouseEvent) => {
		if (isOpen) return
		const t = event.target as Element | null
		if (t?.closest?.(NO_EXPAND_SELECTOR)) return
		open(true)
	})
	// start expanded once the caller has drawn the face (faces measure their own
	// layout, which needs them visible)
	if (expand.open) (expand.faceDrawn || Promise.resolve()).finally(() => open(false))
	return face
}

export function renderTileError(holder: any, err: any, self: any) {
	holder
		.append('div')
		.style('color', '#b91c1c')
		.style('font-size', '.8em')
		.text(`Failed to render: ${err?.message || err}`)
	if (self?.app?.opts?.debug) console.error(err)
}

/** greyed placeholder card: the tile exists but has no data here */
export function renderPlaceholderCard(grid: any, title: string, note: string) {
	const body = makeTileCard(grid, { title, disabled: true, uniform: true })
	body
		.style('flex', '1')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('justify-content', 'center')
		.append('div')
		.style('font-size', '.75em')
		.style('color', '#9ca3af')
		.style('max-width', '200px')
		.style('text-align', 'center')
		.text(note)
	return body
}

/** card for data that loads asynchronously: the face and the expanded view are both drawn from the
 *  loaded data (so expanding does not refetch). Shows a loading card until `data` resolves; the card is
 *  removed when it resolves to null (no data) */
export function makeAsyncCard<T>(
	grid: any,
	opts: {
		title: string
		data: Promise<T | null>
		renderFace: (face: any, data: T) => void | Promise<void>
		renderExpanded: (holder: any, data: T) => void | Promise<void>
	} & Pick<TileExpand, 'open' | 'onToggle'>
) {
	// a slot that is not a grid item itself, so each card it holds is laid out by the grid
	const slot = grid.append('div').style('display', 'contents')
	makeTileCard(slot, { title: opts.title, uniform: true, fixedHeight: true })
		.append('div')
		.style('color', '#6b7280')
		.style('font-size', '.85em')
		.text('Loading…')
	opts.data.then(
		data => {
			if (!slot.node().isConnected) return
			slot.node().replaceChildren()
			if (data == null) {
				slot.remove()
				return
			}
			let faceDone!: () => void
			const faceDrawn = new Promise<void>(resolve => (faceDone = resolve))
			const face = makeTileCard(slot, {
				title: opts.title,
				uniform: true,
				fixedHeight: true,
				openGroup: grid.node(),
				expand: {
					open: opts.open,
					faceDrawn,
					onToggle: opts.onToggle,
					render: holder => opts.renderExpanded(holder, data)
				}
			})
			// a sync or async face
			new Promise(resolve => resolve(opts.renderFace(face, data)))
				.catch(e => renderTileError(face, e, null))
				.finally(faceDone)
		},
		e => {
			if (!slot.node().isConnected) return
			slot.node().replaceChildren()
			renderTileError(makeTileCard(slot, { title: opts.title, uniform: true, fixedHeight: true }), e, null)
		}
	)
	return slot
}
