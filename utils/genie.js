if(process.argv.length!=4) {
	console.log('<annovar snvindel file> <clinical file> output to stdout, sql to stderr')
	process.exit()
}


const snvindelfile=process.argv[2]
const clinicalfile=process.argv[3]


const fs=require('fs')

const sampleinfo=new Map()
let sampleheader

{
	const lines=fs.readFileSync(clinicalfile,'utf8').trim().split('\n')
	sampleheader=lines[0]
	for(let i=1; i<lines.length; i++) {
		const l=lines[i].split('\t')
		const age=l[0]
		if(age=='<18y') {
			continue
		}
		const sample=l[7-1]
		sampleinfo.set(sample, lines[i])
	}
}


const lines=fs.readFileSync(snvindelfile,'utf8').trim().split('\n')

for(let i=1; i<lines.length; i++) {
	const l=lines[i].split('\t')
	const sample=l[16-1]
	if(!sampleinfo.has(sample)) {
		continue

		console.error(sample+' not found in clinical file')
		break
	}
	const tumortotal=l[40-1]
	const tumormut  =l[42-1]
	const normaltotal=l[43-1] == '0.0' ? '' : l[43-1]
	const normalmut =l[45-1]
	const chr=l[125-1]
	const pos=Number.parseInt(l[126-1])
	if(Number.isNaN(pos)) {
		console.error(l[126-1]+': invalid position at line '+i)
		break
	}
	const refallele=l[127-1]
	const mutallele=l[128-1]
	const gene=l[133-1]
	const mclass=l[135-1]
	const aachange=l[136-1]
	const cdna=l[137-1]
	const isoform=l[140-1] || ''

	console.log(`chr${chr}\t${pos-1}\t${refallele}\t${mutallele}\t${normaltotal}\t${normalmut}\t${tumortotal}\t${tumormut}\t${gene}\t${isoform}\t${mclass}\t${aachange}\t${cdna}\t${sampleinfo.get(sample)}`)
}

console.error(`
create table data (
chr varchar(255),
pos integer,
ref text,
alt text,
normaltotal text,
normalmut text,
tumortotal text,
tumormut text,
gene varchar(255),
isoform varchar(255),
mclass varchar(255),
mname varchar(255),
cdna varchar(255),`)

for(const s of sampleheader.split('\t')) {
	console.error(s+' varchar(255),')
}
console.error(')')
