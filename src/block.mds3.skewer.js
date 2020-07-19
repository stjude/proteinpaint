import { select as d3select, event as d3event } from 'd3-selection'
import { axisTop, axisLeft, axisRight } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import * as common from './common'
import * as client from './client'
import { makeTk } from './block.mds3.makeTk'
import { update as update_legend } from './block.mds3.legend'

/*
********************** EXPORTED
loadTk
********************** INTERNAL

return track height
*/

export function may_render_skewer(data, tk, block) {
	if (!data.skewer) return 0

	return 100
}
