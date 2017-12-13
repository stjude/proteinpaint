export function expressionrankfromtemplate(tk,template) {
	if(!template.file && !template.url) return 'no file or url'
	if(!template.compareTo) return '.compareTo missing'
	if(!Array.isArray(template.compareTo)) return '.compareTo should be array'
	tk.compareTo = []
	for(const c of template.compareTo) {
		if(c.isdataset) {
			if(!c.name) return '.name missing from a comparing dataset'
			if(!Number.isInteger(c.queryidx) || c.queryidx<0) return '.queryidx should be non-negative integer for comparing dataset'
			tk.compareTo.push({
				isdataset:1,
				name: c.name,
				queryidx: c.queryidx,
			})
		} else if(c.isjsonbed) {
			if(!c.file && !c.url) return '.file or .url missing for a comparing json bed track'
			tk.compareTo.push({
				isjsonbed:1,
				file:c.file,
				url:c.url,
				indexURL: c.indexURL
			})
		}
	}
	if(!tk.pcolorbar || !tk.pcolorfill) {
		tk.pcolorbar = 'rgb(250,125,57)'
		tk.pcolorfill = 'rgba(250,125,57,.2)'
	}
	if(!tk.ncolorbar || !tk.ncolorfill) {
		tk.ncolorbar = 'rgb(82,82,242)'
		tk.ncolorfill = 'rgba(82,82,242,.2)'
	}
	if(!tk.barheight) tk.barheight = 60
	return null
}


export function expressionrankmaketk(tk,block) {
	tk.uninitialized=true
}


export function expressionrankload(tk,block) {
	import('./block.tk.expressionrank').then(module=>{
		module.loadTk(tk,block)
	})
}
