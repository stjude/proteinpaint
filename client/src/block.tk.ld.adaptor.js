export function ldfromtemplate(tk, template) {
	tk._template = template
}

export function ldmaketk(tk, block) {
	tk.uninitiated = 1
}

export function ldload(tk, block) {
	import('./block.tk.ld').then(p => {
		p.loadTk(tk, block)
	})
}
