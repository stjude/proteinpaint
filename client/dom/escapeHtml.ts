// Escape a string for safe insertion into an HTML context (d3 .html() / innerHTML).
// Neutralizes both element and double-quoted-attribute contexts. Use this whenever
// user-supplied text (a term name, group/value label, etc.) is rendered as HTML.
export function escapeHtml(s: string): string {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}
