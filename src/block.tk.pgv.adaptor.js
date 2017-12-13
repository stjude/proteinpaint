import * as client from './client'
import {bigwigfromtemplate} from './block.tk.bigwig'

// this is adaptor for block.tk.pgv.js


export function pgvfromtemplate(tk,template) {
	if(!template.tracks) return '.tracks[] missing from '+tk.name+' track'
	if(template.tracks.length==0) return '.tracks[] length 0 from '+tk.name+' track'
	tk.tracks=[]
	const nameset=new Set()
	for(const t0 of template.tracks) {
		const t={}
		for(const k in t0) {
			t[k]=t0[k]
		}
		if(!t.name) return 'no name for member track of '+tk.name+': '+JSON.stringify(t)
		if(nameset.has(t.name)) return 'duplicating member track name: '+t.name
		nameset.add(t.name)

		if(!t.type) return 'no type for member track of '+tk.name+': '+JSON.stringify(t)
		if(!t.file && !t.url) return 'neither file or url given for member "'+t.name+'" of '+tk.name

		if(t.type==client.tkt.bedj) {
			// pass
		} else if(t.type==client.tkt.bigwig) {
			bigwigfromtemplate(t, t0)
		} else {
			return 'invalid type of member track of '+tk.name+': '+t.type
		}
		t.toppad=t.toppad==undefined ? 4 : t.toppad
		t.bottompad=t.bottompad==undefined ? 4 : t.bottompad
		t.y=0
		tk.tracks.push(t)
	}

	tk.geneset=new Set()
	// all genes in current view

	if(template.genevaluetrack) {
		// single genevalue track setting is legacy, will be unified to .genevaluetklst[] in makeTk
		if(!template.genevaluetrack.file && template.genevaluetrack.url) return 'no .file or .url for genevaluetrack'
		tk.genevaluetrack={
			file:template.genevaluetrack.file,
			url:template.genevaluetrack.url
		}
	}

	if(template.genevaluetklst) {
		if(!Array.isArray(template.genevaluetklst)) return '.genevaluetklst should be an array'
		if(template.genevaluetklst.length==0) return 'zero length of .genevaluetklst'
		tk.genevaluetklst = []
		for(const gvtk of template.genevaluetklst) {
			if(!gvtk.name) return 'name missing for one genevalue track'
			if(!gvtk.file && !gvtk.url) return 'no file or url for genevalue track '+gvtk.name
			const t={}
			for(const k in gvtk) t[k] = gvtk[k]
			tk.genevaluetklst.push(t)
		}
	}

	if(template.bigwigsetting) {
		// common settings for bigwig member tracks
		tk.bigwigsetting = {}
		if(template.bigwigsetting.scale) {
			if(template.bigwigsetting.scale.max) {
				if(!Number.isFinite(template.bigwigsetting.scale.max)) return 'invalid max value in bigwigsetting.scale'
				if(!Number.isFinite(template.bigwigsetting.scale.min)) return 'invalid or missing min value in bigwigsetting.scale'
				if(template.bigwigsetting.scale.max <= template.bigwigsetting.scale.min) return 'max <= min in bigwigsetting.scale'
				tk.bigwigsetting.scale = {min:template.bigwigsetting.scale.min, max:template.bigwigsetting.scale.max}
			}
		}
		// default settings applied to member bigwig tracks
		for(const t of tk.tracks) {
			if(t.type!=client.tkt.bigwig) continue
			if(tk.bigwigsetting.scale) {
				if(tk.bigwigsetting.scale.max!=undefined) {
					delete t.scale.auto
					t.scale = {
						min:tk.bigwigsetting.scale.min,
						max:tk.bigwigsetting.scale.max
					}
				} else if(tk.bigwigsetting.scale.percentile) {
					delete t.scale.auto
					t.scale.percentile = tk.bigwigsetting.scale.percentile
				}
			}
			if(tk.bigwigsetting.pcolor) t.pcolor=tk.bigwigsetting.pcolor
			if(tk.bigwigsetting.ncolor) t.ncolor=tk.bigwigsetting.ncolor
			if(tk.bigwigsetting.pcolor2) t.pcolor=tk.bigwigsetting.pcolor2
			if(tk.bigwigsetting.ncolor2) t.ncolor=tk.bigwigsetting.ncolor2
		}
	}
}



export function pgvmaketk(tk,block) {
	tk.uninitiated=1
}



export function pgvload(tk, block) {
	import('./block.tk.pgv').then(p=>{
		p.loadTk(tk, block)
	})
}
