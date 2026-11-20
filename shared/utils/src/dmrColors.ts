/* The colours that mean DIRECTION of methylation change, shared so the server-rendered scan
Manhattan and every client view encoding hyper/hypo use the same two. Direction is orange/blue
everywhere; group colours come from the picker and are free to be anything. */
export const HYPER_COLOR = '#e66101'
export const HYPO_COLOR = '#5e81f4'

/** The isoform starburst's palette, which the differential methylation volcano draws in too: on the starburst
 * methylation and expression moved the same way, the opposite way, or not past the cutoffs; on the volcano hyper,
 * hypo, and not significant */
export const STARBURST_COLORS = { same: '#d95f02', opposite: '#7570b3', below: '#bbb' }
