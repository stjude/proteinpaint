import { rgb } from 'd3-color'

/** Resolve the case/control dot colors for a volcano plot in one place so the
 * interactive SVG overlay (VolcanoViewModel) and the server-rendered PNG
 * (VolcanoModel → Rust) paint each dot the same color.
 *
 * `caseColor` maps to points with `fold_change > 0` (group 2 in samplelst),
 * `controlColor` to `fold_change < 0` (group 1). Every returned color is a
 * `#rrggbb` hex string — CSS names like `'red'` are normalized via d3-color
 * so the Rust renderer's hex-only parser doesn't fall back to a muted tuple.
 */
export function getGroupColors(config: any): { caseColor: string; controlColor: string } {
	const groups = config?.samplelst?.groups
	const termValues = config?.tw?.term?.values
	const rawDown = termValues?.[groups?.[0]?.name]?.color || 'red'
	const rawUp = termValues?.[groups?.[1]?.name]?.color || 'blue'
	return {
		controlColor: toHex(rawDown, 'red'),
		caseColor: toHex(rawUp, 'blue')
	}
}

/** Normalize any CSS-accepted color string into `#rrggbb`. */
export function toHex(color: string | undefined, fallback: string): string {
	const c = rgb(color || fallback)
	return c.displayable() ? c.formatHex() : rgb(fallback).formatHex()
}
