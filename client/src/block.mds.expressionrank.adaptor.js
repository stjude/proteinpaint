export function mdsexpressionrankfromtemplate(tk,template, block) {
	if(!tk.sample) return 'sample name missing'

	if(tk.dslabel) {
		/*
		this one is official tk,
		unfortunately if it is added from embedding, it will be flagged as custom
		*/
		delete tk.iscustom
	}



	if(tk.iscustom) {
		if(!template.file && !template.url) return 'no file or url'
		tk.gecfg = {}

	} else {
		// must set gecfg here to validate
		if(!tk.dslabel) return 'dslabel missing for native track'
		if(!tk.querykey) return 'querykey missing for native track'
		tk.mds = block.genome.datasets[ tk.dslabel ]
		if(!tk.mds) return 'dataset not found: invalid value for dslabel'
		delete tk.dslabel
		tk.gecfg = tk.mds.queries[ tk.querykey ]
		if(!tk.gecfg) return 'expression query not found: invalid value for querykey'
	}

	if(tk.datatype) {
		tk.gecfg.datatype = tk.datatype
		delete tk.datatype
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
