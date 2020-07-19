export function mds3_fromtemplate(tk, template) {
	return null
}

export function mds3_maketk(tk, block) {
	tk.uninitialized = true
}

export function mds3_load(tk, block) {
	import('./block.mds3').then(_ => {
		_.loadTk(tk, block)
	})
}
