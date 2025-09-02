import type { Selection } from 'd3-selection'
import type { Div } from './d3'

/**File intented to collect global proteinpaint data formats. Like the genome
 * chrlookup, dt, mutation classes, etc.
 * Maybe rename to something more appriopriate later?? Make more specific?
 */

export type Pane = {
	header: Div
	body: Selection<any, any, any, any>
}
