export function bamfromtemplate(tk, template) {
	if (!template.file && !template.url) return 'neither file or url given'
	return null
}

export function bammaketk(tk, block) {
	tk.uninitialized = true
}

export function bamload(tk, block) {
	import('./block.tk.bam').then(_ => {
		_.loadTk(tk, block)
	})
}
