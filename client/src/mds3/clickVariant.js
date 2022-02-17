import { event as d3event } from 'd3-selection'
import { init_sampletable } from './sampletable'
import { itemtable } from './itemtable'
import { skewer_sety } from './skewer.render'

const minoccur4sunburst = 10 // minimum occurrence for showing skewer, maybe ds specific
const highlight_color = 'red'

/*
d: 
	if d.aa{}, is a group of skewer.data[0].groups[], and is one or multiple variants sharing the same mname (kras Q61H)
	else, is one of skewer.data[], variants may be of different data type
	both case, use d.mlst[] for full list
tk, block
tippos: suggested itemtip position, if not sunburst
*/
export async function click_variant(d, tk, block, tippos, discKick, eventTarget) {
	try {
		console.log(d)
		if (tk.click_snvindel) {
			highlight_one_disk(eventTarget, discKick)
			tk.click_snvindel(m)
			return
		}
		if ('occurrence' in d && d.occurrence >= minoccur4sunburst && tk.mds.variant2samples) {
			// sunburst
			tk.glider.style('cursor', 'wait')
			const data = await tk.mds.variant2samples.get({ mlst: d.mlst, querytype: tk.mds.variant2samples.type_sunburst })
			tk.glider.style('cursor', 'auto')
			const arg = {
				nodes: data,
				occurrence: d.occurrence,
				boxyoff: tk.yoff,
				boxheight: tk.height,
				boxwidth: block.width,
				svgheight: Number.parseFloat(block.svg.attr('height')),
				g: tk.skewer.g.append('g'),
				pica: tk.pica,
				click_listbutton: (x, y) => {
					variant_details({ mlst: d.mlst, tk, block, tippos })
				},
				click_ring: d2 => {
					/* hardcoded attributes from d2.data{}, due to how stratinput structures the data
					.id0, v0 should exist for all levels
					.id1, v1 should exist for 2nd and next levels... etc
					add the key/values to tid2value{}
					*/
					tk.itemtip.clear().show(d3event.clientX - 10, d3event.clientY - 10)
					const arg = {
						mlst: d.mlst,
						tk,
						block,
						div: tk.itemtip.d,
						tid2value: {}
					}
					arg.tid2value[d2.data.id0] = d2.data.v0
					if (d2.data.id1) arg.tid2value[d2.data.id1] = d2.data.v1
					if (d2.data.id2) arg.tid2value[d2.data.id2] = d2.data.v2

					/*
					TEMP FIX to create a mock arg.mlst[]
					this wedge has less samples than d.mlst will have multiple.
					as mlst2samplesummary uses occurrence sum to decide what type of data to request
					must change occurrence sum to d2.value so mlst2samplesummary() can function based on sum of this wedge
					*/
					arg.mlst = d.mlst.map(m => {
						if (tk.mds.variant2samples.variantkey == 'ssm_id') {
							return { ssm_id: m.ssm_id, occurrence: 0 }
						}
						throw 'unknown variant2samples.variantkey'
					})
					arg.mlst[0].occurrence = d2.value
					/* do not call variant_details() as no need to show info on variants
					only need to show sample display
					*/
					init_sampletable(arg)
				}
			}
			if (d.aa) {
				arg.cx = d.aa.x
				arg.cy = skewer_sety(d, tk) + d.yoffset * (tk.aboveprotein ? -1 : 1)
			} else {
				arg.cx = d.x
				arg.cy = d.y + ((tk.aboveprotein ? 1 : -1) * tk.skewer.stem1) / 2
				// not to show list button in sunburst in case mlst has different data types
			}
			if (d.mlst.length == 1) {
				arg.chartlabel = d.mlst[0].mname
			} else {
				// multiple m, use mname of most recurrent variant
				arg.chartlabel = d.mlst.reduce((i, j) => (j.occurrence > i.occurrence ? j : i)).mname + ' etc'
			}
			const _ = await import('../sunburst')
			_.default(arg)
			return
		}
		// no sunburst, no matter occurrence, show details
		await variant_details({ mlst: d.mlst, tk, block, tippos })
	} catch (e) {
		block.error(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

/*
if items of mlst are of same type, show table view of the variant itself, plus the sample summary table
if of multiple data types, do not show variant table view; only show the sample summary table
should work with skewer and non-skewer data types
arg{}
.mlst[]
.tk
.block
.tippos
.tid2value{}
*/
async function variant_details(arg) {
	arg.tk.itemtip.clear().show(arg.tippos.left - 10, arg.tippos.top - 10)
	arg.div = arg.tk.itemtip.d
	// count how many dt
	const dtset = new Set()
	for (const m of arg.mlst) dtset.add(m.dt)
	if (dtset.size > 1) {
		// more than 1 data types, won't print detail table for each variant
		if (arg.tk.mds.variant2samples) {
			// show sample summary
			await init_sampletable(arg)
		} else {
			throw 'no variant2samples, do not know what to show'
		}
		return
	}
	// mlst are of one data type
	await itemtable(arg)
}

function highlight_one_disk(dot, discKick, tk) {
	// dot is the kick <circle>; apply highlight styling on it
	discKick
		.attr('r', m => m.radius - 0.5)
		.attr('stroke', m => tk.color4disc(m))
		.attr('stroke-opacity', 0)
	dot.setAttribute('r', nm.dotwidth * 0.7)
	dot.setAttribute('stroke', highlight_color)
	dot.setAttribute('stroke-opacity', 1)
}
