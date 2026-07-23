export function j2_fromtemplate(tk, template) {
	return null
}

export function j2_maketk(tk, block) {
	tk.uninitialized = true
}

export function j2_load(tk, block) {
	import('./tk').then(_ => {
		_.loadTk(tk, block)
	})
}
