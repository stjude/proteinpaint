export function mds2_fromtemplate(tk,template) {
	return null
}



export function mds2_maketk(tk,block) {
	tk.uninitialized=true
}



export function mds2_load(tk,block) {
	import('./block.mds2').then(_=>{
		_.loadTk(tk,block)
	})
}
