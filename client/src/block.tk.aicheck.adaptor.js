export function aicheckfromtemplate(tk,template) {
	if(!template.file && !template.url) return 'no file or url'
	return null
}


export function aicheckmaketk(tk,block) {
	tk.uninitialized=true
}


export function aicheckload(tk,block) {
	import('./block.tk.aicheck').then(_=>{
		_.loadTk(tk,block)
	})
}
export function aicheckloadsubpanel(tk,block,panel) {
	import('./block.tk.aicheck').then(_=>{
		_.loadTksubpanel(tk,block,panel)
	})
}
