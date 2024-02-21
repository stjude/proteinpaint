export function hicstrawfromtemplate(tk: any, template: any) {
	if (tk.textdata) {
		if (!tk.textdata.raw) return '.textdata.raw missing'
		if (typeof tk.textdata.raw != 'string') return '.textdata.raw should be string'
		delete template.enzyme
	} else if (tk.bedfile || tk.bedurl) {
		// bed file
	} else {
		// by hic straw file
		if (!template.file && !template.url)
			return 'none of the data sources available: text data, bedj file, or juicebox file'
	}
	if (template.domainoverlay) {
		if (!template.domainoverlay.file && !template.domainoverlay.url) return 'file or url missing for domainoverlay'
		tk.domainoverlay = {}
		for (const k in template.domainoverlay) {
			tk.domainoverlay[k] = template.domainoverlay[k]
		}
	}
	// the "hic" object to work with ../tracks/hic/app.ts
	tk.hic = {
		enzyme: template.enzyme
	}
	delete tk.enzyme
	return null
}

export function hicstrawmaketk(tk: any) {
	tk.uninitialized = true
}

export function hicstrawload(tk: any, block: any) {
	import('./block.tk.hicstraw.ts').then(module => {
		module.loadTk(tk, block)
	})
}
