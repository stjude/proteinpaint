import { init_sampletable } from './sampletable'
import { itemtable } from './itemtable'
import { skewer_sety, mayHighlightDiskBySsmid } from './skewer.render'

const minoccur4sunburst = 10 // minimum occurrence for showing skewer, maybe ds specific

/*
************** EXPORT
click_variant()

************** tentative logic
custom method:
	if tk.click_snvindel() is set, call this; will also create hlssmid and call mayHighlightDiskBySsmid 
built-in methods
	if d.occurrence is set, show sunburst
	else, call variant_details()

************** arguments
d{} 
	3 cases:
	1. if d.aa{}, is a group of skewer.data[0].groups[], and is one or multiple variants sharing the same mname (kras Q61H)
	2. is one of skewer.data[] (e.g clicking ssk box under a skewer),
	   variants may be of different data type
	   both case, use d.mlst[] for full list
	3. from numeric mode. d.mlst[] should have just a single m
tk
block
tippos{ left, top }
	suggested itemtip position, if not sunburst
eventTarget
	svg <circle> element of the kick cover of the clicked disc
	used by click_snvindel to highlight this disc
*/
export async function click_variant(d, tk, block, tippos, eventTarget) {
	try {
		if (tk.click_snvindel) {
			// custom handler overrides default behavior
			tk.skewer.hlssmid = new Set(d.mlst.map(i => i.ssm_id))
			mayHighlightDiskBySsmid(tk)
			tk.click_snvindel(d.mlst[0])
			return
		}
		if (
			'occurrence' in d &&
			d.occurrence >= minoccur4sunburst &&
			tk.mds.variant2samples &&
			tk.mds.variant2samples.sunburst_twLst
		) {
			// show sunburst when meeting conditions: mutation have occurrence, have v2s.sunburst_twLst[]
			await click2sunburst(d, tk, block, tippos)
			return
		}
		// no sunburst, no matter occurrence, show details
		await variant_details({ mlst: d.mlst, tk, block, tippos })
	} catch (e) {
		block.error(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

async function click2sunburst(d, tk, block, tippos) {
	tk.glider.style('cursor', 'wait')
	const data = await tk.mds.variant2samples.get({
		mlst: d.mlst,
		querytype: tk.mds.variant2samples.type_sunburst
	})
	tk.glider.style('cursor', 'auto')
	const arg = {
		nodes: data.nodes,
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
		click_ring: async (event, d2) => {
			/* hardcoded attributes from d2.data{}, due to how stratinput structures the data
			.id0, v0 should exist for all levels
			.id1, v1 should exist for 2nd and next levels... etc
			add the key/values to tid2value{}
			*/
			tk.itemtip.clear()
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

			const x = event.clientX
			const y = event.clientY

			/* may delete later
			const width = window.innerWidth
			const height = window.innerHeight
			const middlex = width / 2
			const middley = height / 2

			arg.maxWidth = width - x > middlex ? width - x : x
			arg.maxHeight = height - y > middley ? height - y : y
			arg.maxWidth = arg.maxWidth - 150 + 'px'
			arg.maxHeight = arg.maxHeight - 150 + 'px'
			*/

			/* do not call variant_details() as no need to show info on variants
			only need to show sample display
			*/
			await init_sampletable(arg)
			tk.itemtip.show(x, y, false, false)
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
		const mnameSet = new Set(d.mlst.map(i => i.mname))
		if (mnameSet.size == 1) {
			arg.chartlabel = [...mnameSet][0]
		} else {
			// multiple m of different mname. use mname of most recurrent variant
			arg.chartlabel = d.mlst.reduce((i, j) => (j.occurrence > i.occurrence ? j : i)).mname + ' etc'
		}
	}
	const _ = await import('#src/sunburst')
	_.default(arg)
}

/*
arg{}
.mlst[]
	can be mixture of different dt
.tk
.block
.tippos
.tid2value{}
*/
async function variant_details(arg) {
	arg.tk.itemtip.clear().show(arg.tippos.left - 10, arg.tippos.top - 10)
	arg.div = arg.tk.itemtip.d
	arg.tipDiv = arg.tk.itemtip.d
	await itemtable(arg)
}
