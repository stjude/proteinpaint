export function bedgraphdot_fromtemplate(tk,template) {
	return null
}



export function bedgraphdot_maketk(tk,block) {
	tk.uninitialized=true
}



export function bedgraphdot_load(tk,block) {
	import('./block.tk.bedgraphdot').then(_=>{
		_.loadTk(tk,block)
	})
}
