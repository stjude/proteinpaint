import { makeVariantLabel } from './leftlabel.variant'
import { select } from 'd3-selection'
// variant label is always made. sample label is optional and dynamically loads script when needed

const labyspace = 5

/*
make_leftlabels
	makeVariantLabel
	makeSampleLabel
	makeSampleFilterLabel
	positionLeftlabelg
	makelabel


make a column of functional labels on the left, under the track label
labels are based on server data
labels are kept persistent by keys in tk.leftlabels.doms{}
must call after rendering skewer track
must reset tk.leftlabels.maxwidth

*/

export async function make_leftlabels(data, tk, block) {
	let laby = 0 // cumulative y offset for various labels created here

	makeVariantLabel(data, tk, block, laby)
	if (tk.leftlabels.doms.variants) {
		// has variants label, increment laby
		laby += labyspace + block.labelfontsize
	}

	if ('sampleTotalNumber' in data || tk.leftlabels.doms.samples) {
		/* if either of two conditions is met, will create/update sample label
		1: data has sample. create label if missing (first time starting tk)
		2: data has no sample but label exists. should be that filtering dropped all samples
		*/
		const _ = await import('./leftlabel.sample')
		_.makeSampleLabel(data, tk, block, laby)
		laby += labyspace + block.labelfontsize

		if (tk.filterObj) {
			// this tk has a modifiable sample filter, create Filter label
			_.makeSampleFilterLabel(data, tk, block, laby)
		}
		if (tk.leftlabels.doms.filterObj) {
			laby += labyspace + block.labelfontsize
		}
	}

	if (tk.showCloseLeftlabel) {
		// allow shorthand to close tk
		if (!tk.leftlabels.doms.close) {
			// "Close" is missing, create
			tk.leftlabels.doms.close = makelabel(tk, block, laby)
				.text('Close')
				.on('click', () => {
					for (const [i, t] of block.tklst.entries()) {
						if (t.tkid == tk.tkid) {
							block.tk_remove(i)
						}
					}
					tk.onClose?.() // run if present
				})
		}
		// Close label is present, increment laby
		laby += labyspace + block.labelfontsize
	}

	// done creating all possible left labels
	tk.leftlabels.laby = laby
	positionLeftlabelg(tk, block)

	setLeftlabelsMaxWidth(tk)
	tk.subtk2height.leftlabels = laby + 20 // account for tk.tklabel
}

export function setLeftlabelsMaxWidth(tk) {
	// set tk.leftlabels.maxwidth anew, from all labels
	tk.leftlabels.maxwidth = tk.tklabel.node().getBBox().width
	for (const k in tk.leftlabels.doms) {
		tk.leftlabels.maxwidth = Math.max(tk.leftlabels.maxwidth, tk.leftlabels.doms[k].node().getBBox().width)
	}
}

export function positionLeftlabelg(tk, block) {
	if (tk.leftlabels.laby == 0) {
		// no labels
		return
	}
	tk.leftlabels.xoff = 0
	if (tk.skewer) {
		const nm = tk.skewer.viewModes.find(i => i.inuse)
		if (nm.type == 'numeric') {
			// in numeric mode now, axis opens to left,
			// need to prevent left label from overlapping with axis
			// use y position of last label
			const lly = tk.leftlabels.laby + labyspace + block.labelfontsize
			if (lly > nm.toplabelheight + 5) {
				// FIXME tentatively plus 5 here! was -10!
				tk.leftlabels.xoff = nm.axisWidth
			}
		}
	}
	// transition for nice effect when switching skewer mode
	tk.leftlabels.g.transition().attr('transform', `translate(-${tk.leftlabels.xoff},${labyspace + block.labelfontsize})`)
}

export function makelabel(tk, block, y) {
	const text = tk.leftlabels.g
		.append('text')
		.attr('font-size', block.labelfontsize)
		.attr('y', block.labelfontsize / 2 + y)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('class', 'sja_clbtext2')
		.attr('fill', 'black')
		.attr('x', block.tkleftlabel_xshift)
		.attr('tabindex', 0)
		.on('keydown', function (event) {
			// ignore this event if it bubbled up from a descendant element
			if (event.target != textElem) return
			if (event.key == 'Enter') textElem.dispatchEvent(new Event('click'))
		})

	const textElem = text.node()
	return text
}
