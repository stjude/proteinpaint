import type { HandlerDeps } from './types.ts'

/** Append a clickable action button to `parent`. Errors thrown by onClick are shown in the popup. Every
 * result button is made here so styling, test ids and error handling live in one place. */
export function addActionButton(
	parent: any,
	deps: Pick<HandlerDeps, 'popup'>,
	/** onClick gets the button's own node, so a picker can open right under it */
	opts: { label: string; testid: string; onClick: (button: HTMLElement) => Promise<void> }
) {
	return parent
		.append('span')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', opts.testid)
		.style('display', 'inline-block')
		.style('margin', '0px 3px')
		.style('padding', '5px 10px')
		.style('border-radius', '5px')
		.style('cursor', 'pointer')
		.text(opts.label)
		.on('click', function (this: HTMLElement) {
			opts.onClick(this).catch(e => deps.popup.showError(e, this))
		})
}
