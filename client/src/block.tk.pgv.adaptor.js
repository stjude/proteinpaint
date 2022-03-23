export function pgvfromtemplate(tk, template) {
	tk._template = template
}

export function pgvmaketk(tk, block) {
	tk.uninitiated = 1
}

export function pgvload(tk, block) {
	import('./block.tk.pgv').then(p => {
		p.loadTk(tk, block)
	})
}
