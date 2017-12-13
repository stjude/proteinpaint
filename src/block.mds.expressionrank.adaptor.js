export function mdsexpressionrankfromtemplate(tk,template) {
	if(!tk.sample) return 'sample name missing'
	if(tk.iscustom) {
		if(!template.file && !template.url) return 'no file or url'
		if(!tk.datatype) {
			tk.datatype='unnamed_datatype'
		}
	} else {
		if(!tk.mds) return 'mds missing for native track'
		if(!tk.querykey) return 'querykey missing for native track'
	}
	if(!tk.barheight) tk.barheight = 60
	return null
}


export function mdsexpressionrankmaketk(tk,block) {
	tk.uninitialized=true
}


export function mdsexpressionrankload(tk,block) {
	import('./block.mds.expressionrank').then(module=>{
		module.loadTk(tk,block)
	})
}
