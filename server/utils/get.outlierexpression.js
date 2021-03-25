if(process.argv.length!=3) {
	console.log('<in file (chr,start,stop,{gene,sample,value}> output to stdout')
	process.exit()
}



const iqrfold = 2 // folds over normal iqr 1.5*(q3-q1)

const mincutoff_samplevalue = 10

const infile = process.argv[2]


const fs=require('fs')
const readline=require('readline')

new Promise((resolve,reject)=>{

	// get all genes

	const genename2coord = new Map()

	const fi = fs.createReadStream(infile,{encoding:'utf8'})
	const r = readline.createInterface({input:fi})

	r.on('line',line=>{
		const l = line.split('\t')
		const j=JSON.parse(l[3])
		const gene = j.gene

		if(!genename2coord.has(gene)) {
			genename2coord.set( gene, {
				coord:l[0]+':'+l[1]+'-'+l[2],
			})
		}
	})

	r.on('close',()=>{
		fi.destroy()
		resolve(genename2coord)
	})
})

.then(genename2coord=>{


	const run=()=>{
		for(const [genename,obj] of genename2coord) {
			// for each gene, get all samples
			const fi = fs.createReadStream(infile,{encoding:'utf8'})
			const r = readline.createInterface({input:fi})
			const samples=[]
			r.on('line',line=>{
				const j = JSON.parse(line.split('\t')[3])
				if(j.gene!=genename) return
				samples.push({name:j.sample, value:j.value})
			})
			r.on('close',()=>{
				fi.destroy()

				genename2coord.delete( genename )

				const result = filter_iqr(samples)
				if(result.lst) {
					for(const sample of result.lst) {
						console.log(genename+'\t'+obj.coord+'\t'+sample.name+'\t'+sample.value+'\t'+sample.rank+'\t'+result.cutoff)
					}
				}
				run()
			})
			break
		}
	}


	console.log('gene\tcoord\tsample\tFPKM\trank\tIQR*'+iqrfold)

	run()

})




function get_iqr_up(lst) {
	lst.sort( (i,j)=> i.value-j.value )
	const q1 = lst[ Math.floor(lst.length /4 ) ].value
	const q3 = lst[ Math.floor(lst.length *3/4) ].value
	const iqrmax = q3+ (q3-q1)*1.5 * iqrfold
	return [ q1, q3, iqrmax ]
}




function filter_iqr(lst) {
	const [q1,q3,iqrmax] = get_iqr_up(lst)


	const result = []

	for(let i=0; i<10; i++) {
		const sample = lst[lst.length-1-i]

		if(sample.value <= mincutoff_samplevalue) {
			// below cutoff, do not look
			break
		}

		if(sample.value > iqrmax) {
			result.push({ name:sample.name, value:sample.value, rank:i})
		} else {
			break
		}
	}
	return {cutoff:iqrmax, lst:result}
}
