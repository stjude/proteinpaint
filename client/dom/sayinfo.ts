import { disappear } from './animation'

/*
---------Exported---------
sayinfo()
	- Displays an informational message in a closable, blue div with a
	  leading ℹ icon. Same shape as sayerror() but blue/info-tinted, for
	  non-error states the user can simply acknowledge (e.g. "server is
	  busy, try again shortly").
	- Optional third argument can supply an action button (e.g. "Retry")
	  that is appended to the bar. Clicking it dismisses the bar and
	  invokes the supplied callback.
*/

export type SayInfoOpts = {
	/** Label shown on the action button. Required to render the button. */
	actionLabel?: string
	/** Click handler. Required to render the button. Bar dismisses
	 * automatically before this fires. */
	onAction?: () => void
}

export function sayinfo(holder: any, o: any, opts: SayInfoOpts = {}) {
	// 2nd argument is a string or an Error-like object
	let msg: any
	if (typeof o == 'string') {
		msg = o
	} else {
		msg = o.message || o.error
	}
	holder.style('padding-left', '10px') // align with sandbox padding
	const div = holder
		.append('div')
		.attr('class', holder.classed('sja_infobar') ? null : 'sja_infobar')
		.style('border-radius', '5px')
	div
		.append('div')
		.style('padding-right', '8px')
		.html('&#10005;')
		.style('display', 'inline-block')
		.style('cursor', 'pointer')
		.on('click', () => {
			disappear(div, true)
		})
	div.append('div').style('display', 'inline-block').style('padding-right', '6px').html('&#8505;')
	// msg can contain injected XSS, so never do .html(msg)
	div.append('div').style('display', 'inline-block').text(msg)

	if (opts.actionLabel && opts.onAction) {
		div
			.append('button')
			.style('margin-left', '10px')
			.text(opts.actionLabel)
			.on('click', () => {
				disappear(div, true)
				opts.onAction!()
			})
	}
}
