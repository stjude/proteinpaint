if(process.argv.length!=3) {
	console.log('<rmsk.txt from ucsc> output to stdout')
	process.exit()
}


const infile=process.argv[2]


const fs=require('fs')
const exec=require('child_process').execSync
const readline = require('readline')




const name2category={
	DNA:'DNA',
	'DNA?':'DNA',
	LINE:'LINE',
	'LINE?':'LINE',
	Low_complexity:'low_complexity',
	LTR:'LTR',
	Retroposon:'LTR',
	'LTR?':'LTR',
	Other:'Other',
	RC:'Other',
	'RC?':'Other',
	RNA:'RNA',
	rRNA:'RNA',
	Satellite:'satellite',
	'Satellite?':'satellite',
	scRNA:'RNA',
	Simple_repeat:'simple',
	SINE:'SINE',
	'SINE?':'SINE',
	snRNA:'RNA',
	srpRNA:'RNA',
	tRNA:'RNA',
	Unknown:'unknown',
	'Unknown?':'uknown'
}



const categories={
	SINE:{
		color:'#ED8C8E', // red
		label:'SINE'
	},
	LINE:{
		color:'#EDCB8C', // orange
		label:'LINE'
	},
	LTR:{
		color:'#E38CED', // magenta
		label:'LTR'
	},
	DNA:{
		color:'#8C8EED', // blue
		label:'DNA transposon'
	},
	simple:{
		color:'#8EB88C', // green
		label:'Simple repeats',
	},
	low_complexity:{
		color:'#ACEBA9', // light green
		label:'Low complexity'
	},
	satellite:{
		color:'#B59A84', // brown
		label:'Satellite',
	},
	RNA:{
		color:'#9DE0E0', // cyan
		label:'RNA repeat',
	},
	other:{
		color:'#9BADC2',
		label:'Other',
	},
	unknown:{
		color:'#858585',
		label:'Unknown'
	}
}

console.error(JSON.stringify(categories))


const rl = readline.createInterface({
	input:fs.createReadStream(infile)
})


/*
.on('end',()=>{
	fs.writeFileSync(outfile,out.join('\n'))
	exec('sort -k1,1 -k2,2n '+outfile+' > x')
	exec('mv x '+outfile)
	exec('bgzip '+outfile)
	exec('tabix -p bed '+outfile+'.gz')
})
*/



rl.on('line',line=>{
	const l=line.split('\t')
	const name=l[10]
	const cls=l[11]
	const cate=name2category[cls]
	if(!cate) {
		console.error('unknown class: '+cls)
		//process.exit()
	}
	const family=l[12]
	const j={
		//coding:[[Number.parseInt(l[6]),Number.parseInt(l[7])]],
		category:cate,strand:l[9],
		name:'Repeat '+name+', family '+family
		}
	//out.push(l[5]+'\t'+l[6]+'\t'+l[7]+'\t'+JSON.stringify(j))
	console.log(l[5]+'\t'+l[6]+'\t'+l[7]+'\t'+JSON.stringify(j))
})
