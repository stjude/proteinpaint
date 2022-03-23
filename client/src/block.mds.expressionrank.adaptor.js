export function mdsexpressionrankfromtemplate(tk, template, block) {
	return null
}

export function mdsexpressionrankmaketk(tk, block) {
	tk.uninitialized = true
}

export function mdsexpressionrankload(tk, block) {
	import('./block.mds.expressionrank').then(module => {
		module.loadTk(tk, block)
	})
}
