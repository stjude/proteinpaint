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

/** the subpanel coordinates of a block, to tell whether a hicstraw track has loaded the current subpanels */
export function hicstrawSubpanelsKey(block: any) {
	return block.subpanels.map(p => [p.chr, p.start, p.stop, p.width].join(':')).join(',')
}

/** called by block.add_subpanel() after it updates the subpanels of a track; a hicstraw track loads all subpanels
 * together with the main view, so it is loaded once instead of once per updated subpanel, and not again when its
 * latest load already used the current subpanels, such as the load when the block is created */
export function hicstrawloadsubpanels(tk: any, block: any) {
	if (tk.subpanelsKey == hicstrawSubpanelsKey(block)) return
	hicstrawload(tk, block)
}
