import { formatElapsedTime } from '#shared'

/** Writes text into elem, then "<text> 12s elapsed." every second, so a long server wait is seen to be
 * still running rather than hung. Whole seconds, so the minutes form never reads "1m 60s". Returns the
 * function that stops it. */
export function startElapsedTimer(elem: any, text: string): () => void {
	const start = Date.now()
	elem.text(text)
	const id = setInterval(() => {
		const ms = Math.round((Date.now() - start) / 1000) * 1000
		elem.text(`${text} ${formatElapsedTime(ms, 0)} elapsed.`)
	}, 1000)
	return () => clearInterval(id)
}
