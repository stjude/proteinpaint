export function hicstrawfromtemplate(tk,template) {
	if(!template.file && !template.url) return 'no file or url'
	if(template.domainoverlay) {
		if(!template.domainoverlay.file && !template.domainoverlay.url) return 'file or url missing for domainoverlay'
		tk.domainoverlay = {}
		for(const k in template.domainoverlay) {
			tk.domainoverlay[k] = template.domainoverlay[k]
		}
	}
	if(!tk.color) {
		tk.color = 'red'
	}
	// the "hic" object to work with hic.straw.js
	tk.hic = {
		enzyme:template.enzyme
	}
	delete tk.enzyme
	return null
}


export function hicstrawmaketk(tk,block) {
	tk.uninitialized=true
}


export function hicstrawload(tk,block) {
	import('./block.tk.hicstraw').then(module=>{
		module.loadTk(tk,block)
	})
}
