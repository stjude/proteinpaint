const abort = m=>{
	console.error('Error:',m)
	process.exit()
}



const vcffile = process.argv[2]
const bamforward = process.argv[3]
const bamreverse = process.argv[4]
//const fafile = process.argv[4]


if(!vcffile || !bamforward || !bamreverse ) abort('<vcf text file of phased variants> <forward strand.bam> <reverse strand.bam> output to stdout')


const fs=require('fs')
const readline=require('readline')
const exec=require('child_process').execSync
const vcf = require('../src/vcf')


const nt = new Set(['A','T','C','G'])








const rl = readline.createInterface({input: fs.createReadStream(vcffile)})

const metalines = []
let first=true
let vcfobj

let count_notsnp=0,
	count_nosampledata=0,
	count_nosample0=0,
	count_nogenotype=0,
	count_snpnotphased=0,
	count_not2alleles=0,
	count_homozygous=0,
	count_used=0,
	pileuperrors = new Map()

rl.on('line',line=>{

	if(line[0]=='#') {
		metalines.push(line)
		return
	}

	if(first) {
		first=false
		const [info,format,samples,err] = vcf.vcfparsemeta( metalines)
		if(err) abort(err.join(' '))
		vcfobj = {
			info: info,
			format: format,
			samples: samples
		}
	}

	analyze(line)
})


rl.on('close',()=>{
	if(count_notsnp) console.log('count_notsnp',count_notsnp)
	if(count_nosampledata) console.log('count_nosampledata',count_nosampledata)
	if(count_nosample0) console.log('count_nosample0',count_nosample0)
	if(count_nogenotype) console.log('count_nogenotype',count_nogenotype)
	if(count_snpnotphased) console.log('count_snpnotphased',count_snpnotphased)
	if(count_not2alleles) console.log('count_not2alleles',count_not2alleles)
	if(count_homozygous) console.log('count_homozygous',count_homozygous)
	if(count_used) console.log('count_used',count_used)
	if(pileuperrors.size) {
		for(const [s,c] of pileuperrors) console.log('mpileup error: '+s+', '+c)
	}
})





/////////////////////////// helpers



const analyze = async (line)=> {

	const [badkeys, mlst, invalidalt] = vcf.vcfparseline( line, vcfobj )
	if(badkeys) abort('badkeys: '+badkeys.join(' '))
	if(invalidalt) abort('invalidalt: '+invalidalt.join(' '))

	for(const m of mlst) {

		/*
		if(!nt.has(m.alt) || nt.has(m.ref)) {
			count_notsnp++
			continue
		}
		*/

		if(!m.sampledata) {
			count_nosampledata++
			continue
		}

		const sample = m.sampledata[0]
		if(!sample) {
			count_nosample0++
			continue
		}

		if(!sample.genotype) {
			count_nogenotype++
			continue
		}

		if(sample.genotype.indexOf('|')==-1) {
			count_snpnotphased++
			continue
		}

		const alleles = sample.genotype.split('|')
		if(alleles.length!=2) {
			count_not2alleles++
			continue
		}

		const [allele1, allele2] = alleles

		if(allele1==allele2) {
			count_homozygous++
			continue
		}

		if(!nt.has(allele1) || !nt.has(allele2)) {
			count_notsnp++
			continue
		}

		count_used++

		//const [err, data] = await checkbam( m, allele1, allele2 )
		const [err,data] = checkbamstranded(m, allele1, allele2)

		if(err) {
			if(!pileuperrors.has(err)) pileuperrors.set(err,0)
			pileuperrors.set( err, pileuperrors.get(err)+1 )
			continue
		}

		const j = {
			allele1: allele1,
			allele2: allele2,
			ps: sample.PS,
			count: data
		}

		console.log( m.chr+'\t'+m.pos+'\t'+JSON.stringify(j) )
	}
}





const checkbam = ( m, allele1, allele2 ) => {
	return new Promise((resolve,reject)=>{

	const ps = spawn('samtools', [ 'mpileup', '-d','999999', '-r', m.chr+':'+(m.pos+1)+'-'+(m.pos+1), bamfile ] )
	const out = []
	ps.stdout.on('data',d=> out.push(d) )
	ps.on('close', code=>{
		const lines = out.join('').trim().split('\n')

		// only look at one line
		if(!lines[0]) reject(['no data line'])
		// 8	128744796	N	33	>>>>>>>>>>>>>>>>>>>>>>><<>><><>>T	HH9GJIHIJHJJB<JDJ>IFJHACFJJFJDDGq
		const l = lines[0].split('\t')
		if(l[0]!=m.chr) reject(['chr doesnot match'])

		const data={
			chr1:{
				forward:0,
				reverse:0
			},
			chr2:{
				forward:0,
				reverse:0
			}
		}

		const upcase1 = allele1.toUpperCase()
		const upcase2 = allele2.toUpperCase()
		const locase1 = allele1.toLowerCase()
		const locase2 = allele2.toLowerCase()

		for(const x of l[4]) {
			const xup = x.toUpperCase()

			if(!nt.has(xup)) {
				// not a nt
				continue
			}

			if(x==upcase1) {
				data.chr1.forward++
			} else if(x==locase1) {
				data.chr1.reverse++
			} else if(x==upcase2) {
				data.chr2.forward++
			} else if(x==locase2) {
				data.chr2.reverse++
			}
		}
		resolve([null, data])
	})
	})
}




const checkbamstranded = ( m, allele1, allele2 ) => {

	const data={
		chr1:{
			forward:0,
			reverse:0
		},
		chr2:{
			forward:0,
			reverse:0
		}
	}

	const upcase1 = allele1.toUpperCase()
	const upcase2 = allele2.toUpperCase()
	const coord = m.chr+':'+(m.pos+1)+'-'+(m.pos+1)

	{
		const line = exec('samtools mpileup -d 999999 -Q 0 -r '+coord+' '+bamforward+' 2>x',{encoding:'utf8'}).trim().split('\n')[0]
		if(line) {

			// 8	128744796	N	33	>>>>>>>>>>>>>>>>>>>>>>><<>><><>>T	HH9GJIHIJHJJB<JDJ>IFJHACFJJFJDDGq
			const l = line.split('\t')
			if(l[0]!=m.chr) reject(['chr does not match in forward bam'])

			for(const x of l[4]) {

				// do not consider case here
				const xup = x.toUpperCase()

				if(!nt.has(xup)) {
					// not a nt
					continue
				}

				if(xup==upcase1) {
					data.chr1.forward++
				} else if(xup==upcase2) {
					data.chr2.forward++
				}
			}
		}
	}

	{
		const line = exec('samtools mpileup -d 999999 -Q 0 -r '+coord+' '+bamreverse+' 2>x',{encoding:'utf8'}).trim().split('\n')[0]
		if(line) {

			const l = line.split('\t')
			if(l[0]!=m.chr) reject(['chr does not match in reverse bam'])

			for(const x of l[4]) {

				// do not consider case here
				const xup = x.toUpperCase()

				if(!nt.has(xup)) {
					// not a nt
					continue
				}

				if(xup==upcase1) {
					data.chr1.reverse++
				} else if(xup==upcase2) {
					data.chr2.reverse++
				}
			}
		}
	}

	return [null,data]
}
