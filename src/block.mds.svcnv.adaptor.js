export function mdssvcnvfromtemplate(tk,template) {
	if(tk.file || tk.url) {
		tk.iscustom=true
	}
	if(template.singlesample) {
		if(!template.singlesample.name) return 'singlesample.name missing'
		tk.singlesample = {
			name: template.singlesample.name
		}
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
	tk.gaincolor= template.gaincolor || '#D6683C'
	tk.losscolor= template.losscolor || '#67a9cf'
	tk.lohcolor= template.lohcolor || '#545454'
	
	// vcffile dictates cohort ase mode, independent of above
	if( tk.vcffile || tk.vcfurl ) {
		tk.iscustom = true
		// make rnabam optional?
		if( !tk.sample2rnabam ) return 'sample2rnabam missing'
	}
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
