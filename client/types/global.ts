/**File intented to collect global proteinpaint data formats. Like the genome
 * chrlookup, dt, mutation classes, etc.
 * Maybe rename to something more appriopriate later?? Make more specific?
 */

import { Selection } from 'd3-selection'

export type ChrLookUp = {
	[index: string]: { major?: boolean; len: number; name: string }
}

export type Pane = {
	header: Selection<HTMLDivElement, any, any, any>
	body: Selection<any, any, any, any>
}
