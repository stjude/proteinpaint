const arg={}
for(let i=2; i<process.argv.length; i++) {
	const [a,b]=process.argv[i].split('=')
	arg[a.substr(2)]=b
}

if(!arg.high20) abort('no high20 file')
if(!arg.genome) abort('no genome sequence file')
if(!arg.out) abort('no vcf file name')

function abort(m) {
console.log(m+`
  --genome = .gz file, samtools-indexed
  --out    = output vcf file basename
  --high20 = high_20 text file, first 15 columns:
	1	Name	chr1.546697
	2	Chr	chr1
	3	Pos	546697
	4	Type	SNP
	5	Size	1
	6	Coverage	23
	7	Percent_alternative_allele	1.000
	8	Chr_Allele	A
	9	Alternative_Allele	G
	10	Score	0.990
	11	Text	TGTGGGGGTGTGGGTGTGAC[A/G]GGGTGTGTTCTGTGTGAGAA
	12	reference_normal_count	0
	13	reference_tumor_count	0
	14	alternative_normal_count	4
	15	alternative_tumor_count	19
`)
	process.exit()
}



const fs=require('fs')
const readline=require('readline')
const exec=require('child_process').execSync


const tempfile=Math.random().toString()
const vcfout=fs.createWriteStream(tempfile)


vcfout.write(`##fileformat=VCFv4.1
##FORMAT=<ID=AD,Number=.,Type=Integer,Description="Allelic depths for the ref and alt alleles in the order listed">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	normal	tumor
`)


vcfout.on('finish',()=>{
	// header has 4 lines, skip for sorting
	exec('(head -n 4 '+tempfile+' && tail -n +5 '+tempfile+' | sort -k1,1 -k2,2n) > '+arg.out)
	fs.unlinkSync(tempfile)
	exec('bgzip '+arg.out)
	exec('tabix -p vcf '+arg.out+'.gz')
})


let firstline=true

new lazy(fs.createReadStream(arg.high20))
.on('end',()=>{
	vcfout.end()
})
.lines
.map(String)
.forEach(line=>{
	if(firstline) {
		firstline=false
		return
	}
	const l=line.split('\t')
	const chr=l[2-1]
	let pos=Number.parseInt(l[3-1])
	if(Number.isNaN(pos)) {
		console.error('invalid position: '+pos)
		return
	}
	let ref=l[8-1]
	let mut=l[9-1]

	if(ref=='') {
		const base=getbase(chr, pos)
		if(!base) {
			return
		}
		ref=base
		mut=base+mut
	} else if(mut=='') {
		pos--
		const base=getbase(chr, pos)
		if(!base) {
			return
		}
		ref=base+ref
		mut=base
	}

	const normal=[]
	{
		const refcount= l[12-1] || '0'
		const mutcount= l[14-1] || '0'
		// genotype
		const genotype=[]
		const readcount=[]
		if(refcount!='0') {
			genotype.push(0)
			readcount.push(refcount)
		}
		if(mutcount!='0') {
			genotype.push(1)
			readcount.push(mutcount)
		}
		// unphased genotype
		normal.push(genotype.join('/'))
		normal.push(readcount.join(','))
	}
	const tumor=[]
	{
		const refcount = l[13-1] || '0'
		const mutcount = l[15-1] || '0'
		// genotype
		const genotype=[]
		const readcount=[]
		if(refcount!='0') {
			genotype.push(0)
			readcount.push(refcount)
		}
		if(mutcount!='0') {
			genotype.push(1)
			readcount.push(mutcount)
		}
		// unphased genotype
		tumor.push(genotype.join('/'))
		tumor.push(readcount.join(','))
	}

	vcfout.write(chr.replace('chr','')+'\t'+pos+'\t.\t'+ref+'\t'+mut+'\t100\t.\t.\tGT:AD\t'+normal.join(':')+'\t'+tumor.join(':')+'\n')
})



function getbase(chr, pos) {
	const l=exec('samtools faidx '+arg.genome+' '+chr+':'+pos+'-'+pos,{encoding:'utf8'}).trim().split('\n')
	if(l.length==2) {
		return l[1].toUpperCase()
	}
	console.log('getbase error: '+chr+':'+pos)
	return null
}
