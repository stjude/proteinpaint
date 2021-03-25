const fs=require('fs')
const lazy=require('lazy')
const async=require('async')

const coord=require('../src/coord')


const isoform=new Map()


for(const line of fs.readFileSync('/home/xzhou/data/tp/anno/refGene.hg19','utf8').trim().split('\n')) {
	const j=JSON.parse(line.split('\t')[3])
	isoform.set(j.isoform,j)
}



async.series([
	next=>{
		new lazy(fs.createReadStream('/home/xzhou/data/tp/anno/db/pediatric.snvindel.hg19'))
		.on('end',()=>next(null))
		.lines
		.map(String)
		.forEach(line=>{
			const l=line.split('\t')
			const pos=Number.parseInt(l[38-1])-1
			const name=l[40-1]
			const sample=l[11-1]
			if(isoform.has(name)) {
				const gm=isoform.get(name)
				const t=coord.genomic2gm(pos,gm)
				if(t.aapos>0) {
					if(!gm.aa) {
						gm.aa=new Map()
					}
					if(!gm.aa.has(t.aapos)) {
						gm.aa.set(t.aapos,new Set())
					}
					gm.aa.get(t.aapos).add(sample)
				}
			}
		})
	},
	next=>{
		new lazy(fs.createReadStream('/home/xzhou/data/tp/anno/db/cosmic.snvindel.hg19'))
		.on('end',()=>next(null))
		.lines
		.map(String)
		.forEach(line=>{
			const l=line.split('\t')
			const pos=Number.parseInt(l[42-1])-1
			const name=l[56-1]
			const sample=l[5-1]
			if(isoform.has(name)) {
				const gm=isoform.get(name)
				const t=coord.genomic2gm(pos,gm)
				if(t.aapos>0) {
					if(!gm.aa) {
						gm.aa=new Map()
					}
					if(!gm.aa.has(t.aapos)) {
						gm.aa.set(t.aapos,new Set())
					}
					gm.aa.get(t.aapos).add(sample)
				}
			}
		})
	}
],err=>{
	if(err) {
		console.error(err)
		return
	}
	for(const [name,i] of isoform) {
		if(i.aa) {
			for(const [aa,set] of i.aa) {
				console.log(name+'\t'+aa+'\t'+set.size)
			}
		}
	}
})
