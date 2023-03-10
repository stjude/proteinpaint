export function mdssvcnvfromtemplate(tk,template) {
	if(tk.file || tk.url) {
		// svcnv file is now optional
		tk.iscustom=true
	}
	if(template.singlesample) {
		if(!template.singlesample.name) return 'singlesample.name missing'
		tk.singlesample = template.singlesample
	}
	if(template.checkexpressionrank) {
		if(tk.iscustom) {
			if(!template.checkexpressionrank.file && !template.checkexpressionrank.url) return 'file/url missing for checkexpressionrank in custom track'
		}
		tk.checkexpressionrank = {}
		for(const k in template.checkexpressionrank) {
			tk.checkexpressionrank[k] = template.checkexpressionrank[k]
		}
	}
	if( template.checkrnabam ) {
		if( !template.checkrnabam.samples) return 'samples{} missing from checkrnabam'
		// will check against a custom vcf
		tk.iscustom = true
	}

	tk.gaincolor= template.gaincolor || '#D6683C'
	tk.losscolor= template.losscolor || '#67a9cf'
	tk.lohcolor= template.lohcolor || '#545454'
	return null
}



export function mdssvcnvmaketk(tk,block) {
	tk.uninitialized=true
}



export function mdssvcnvload(tk,block) {
	import('./block.mds.svcnv').then(module=>{
		module.loadTk(tk,block)
	})
}
