/*

only one source of data: loaded from server

*/

export function mdscnvfromtemplate(tk, template) {
	tk.valueLabel = template.valueLabel || 'CNV'
	tk.toppad = tk.bottompad = 8

	tk.gain = {
		barheight: 70,
		color: '#ef8a62',
		color2: '#FFB236',
		scale: { auto: 1 }
	}
	if (template.gain) {
		for (const k in template.gain) {
			tk.gain[k] = template.gain[k]
		}
	}
	tk.loss = {
		barheight: 70,
		color: '#67a9cf',
		color2: '#FFB236',
		scale: { auto: 1 }
	}
	if (template.loss) {
		for (const k in template.loss) {
			tk.loss[k] = template.loss[k]
		}
	}

	tk.height_main = tk.toppad + tk.gain.barheight + tk.loss.barheight + tk.bottompad
	return null
}

export function mdscnvmaketk(tk, block) {
	tk.gain.axis = tk.gleft.append('g')
	tk.loss.axis = tk.gleft.append('g')

	tk.img = tk.glider.append('image')

	tk.tktip.d.style('padding', '8px')
	tk.subTracks = []
	tk.uninitialized = true
	// everything to be made in mdscnv.render, since handles and config will rerender the track
}

export function mdscnvload(tk, block) {
	import('./block.mds.cnv').then(module => {
		module.loadTk(tk, block)
	})
}
