import { event as d3event } from 'd3-selection'
// variant label is always made
import { makeVariantLabel } from './leftlabel.variant'
import { mayMakeSampleLabel } from './leftlabel.sample'

const labyspace = 5
const font = 'Arial'

/*
********************** EXPORTED
make_leftlabels
positionLeftlabelg
makelabel
********************** INTERNAL


make left labels on main track render
labels are based on server data
labels are kept persistent by keys in tk.leftlabels.doms{}
must call after rendering skewer track
must reset leftLabelMaxwidth

TODO may not update every label when only updating certain sub track
*/

export async function make_leftlabels(data, tk, block) {
	tk.leftLabelMaxwidth = tk.tklabel.node().getBBox().width

	let laby = 0

	makeVariantLabel(data, tk, block, laby)
	if (tk.leftlabels.doms.variants) laby += labyspace + block.labelfontsize // later delete if

	if ('sampleTotalNumber' in data) {
		// only make sample label when there's sample count
		const _ = await import('./leftlabel.sample')
		_.makeSampleLabel(data, tk, block, laby)
		if (tk.leftlabels.doms.samples) laby += labyspace + block.labelfontsize // later delete if
	}

	// done creating all possible left labels
	tk.leftlabels.laby = laby
	positionLeftlabelg(tk, block)

	for (const k in tk.leftlabels.doms) {
		tk.leftLabelMaxwidth = Math.max(tk.leftLabelMaxwidth, tk.leftlabels.doms[k].node().getBBox().width)
	}
	tk.subtk2height.leftlabels = laby + 20 // account for tk.tklabel
}

export function positionLeftlabelg(tk, block) {
	if (tk.leftlabels.laby == 0) {
		// no labels
		return
	}
	let x = 0
	if (tk.skewer) {
		const nm = tk.skewer.viewModes.find(i => i.inuse)
		if (nm.type == 'numeric') {
			// in numeric mode now, axis opens to left,
			// need to prevent left label from overlapping with axis
			// use y position of last label
			const lly = tk.leftlabels.laby + labyspace + block.labelfontsize
			if (lly > nm.toplabelheight - 10) {
				x = nm.axisWidth
			}
		}
	}
	tk.leftlabels.g.attr('transform', `translate(${-x},${labyspace + block.labelfontsize})`)
}

export function makelabel(tk, block, y) {
	return tk.leftlabels.g
		.append('text')
		.attr('font-size', block.labelfontsize)
		.attr('font-family', font)
		.attr('y', block.labelfontsize / 2 + y)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('class', 'sja_clbtext2')
		.attr('fill', 'black')
		.attr('x', block.tkleftlabel_xshift)
}
