const fs=require('fs')
const readline=require('readline')
const exec=require('child_process').execSync
const vcf = require('../../src/vcf')



const abort = m=>{
	console.error('Error:',m)
	process.exit()
}


const argerror = m=> {
console.log('Error: '+m+`
  --vcf       = VCF text file
                file must have one sample, and FORMAT fields including GT, PS
                for phased heterzygous SNPs from this file, will count their alleles from the BAM files
  --vcfhaschr = 1; set this if VCF has chr names like "chr1"
  --forbam    = a BAM file for reads from forward strand, e.g. stranded RNA-seq
  --revbam    = a BAM file for reads from reverse strand, required when "forbam" is used
  --bam       = a BAM file;
                if this parameter is used, will count alleles irrespective of strands
                and stranded BAMs are ignored
                all BAM files should have the .bai index at the same location
  --bamhaschr = 1; set this if all BAM files have chr names like "chr1"
  --chrsize   = chr size file, two columns: chr1 -tab- size
  --out       = output file basename

For stranded BAM, output these files:
out.chr1forward.bw
out.chr1reverse.bw
out.chr2forward.bw
out.chr2reverse.bw

For single BAM, output these files:
out.chr1.bw
out.chr2.bw

In both cases, the bedj track "out.phaseset.gz" will be produced

All tracks (bw and bedj) uses "chr1" as chromosome name.

Requires samtools and bedGraphToBigWig.
`)
	process.exit()
}






const arg={}
for(let i=2; i<process.argv.length; i++) {
	const [a,b]=process.argv[i].split('=')
	arg[a.substr(2)]=b
}

if(!arg.vcf) argerror('no vcf file')
if(arg.vcf.endsWith('.gz')) argerror('vcf file should not be compressed')
if(!fs.existsSync(arg.vcf)) argerror('vcf file not found')

if(arg.bam) {
	if(!fs.existsSync(arg.bam)) argerror('BAM file not found')
	if(!fs.existsSync(arg.bam+'.bai')) argerror('BAM index file not found')
} else if(arg.forbam) {
	if(!fs.existsSync(arg.forbam)) argerror('forward strand BAM file not found')
	if(!fs.existsSync(arg.forbam+'.bai')) argerror('forward strand BAM index file not found')
	if(!arg.revbam) argerror('revbam missing when forbam is used')
	if(!fs.existsSync(arg.revbam)) argerror('reverse strand BAM file not found')
	if(!fs.existsSync(arg.revbam+'.bai')) argerror('reverse strand BAM index file not found')
} else {
	argerror('no bam file given')
}
if(!arg.chrsize) argerror('chrsize file missing')
if(!fs.existsSync(arg.chrsize)) argerror('chr size file not found')
if(!arg.out) argerror('output file basename missing')











if(arg.bam) {
	arg.chr1file = arg.out+'.chr1'
	arg.chr2file = arg.out+'.chr2'
	arg.chr1write = fs.createWriteStream( arg.chr1file )
	arg.chr2write = fs.createWriteStream( arg.chr2file )
} else {

	arg.chr1forwardfile = arg.out+'.chr1forward'
	arg.chr1reversefile = arg.out+'.chr1reverse'
	arg.chr2forwardfile = arg.out+'.chr2forward'
	arg.chr2reversefile = arg.out+'.chr2reverse'

	arg.chr1forwardwrite = fs.createWriteStream( arg.chr1forwardfile )
	arg.chr1reversewrite = fs.createWriteStream( arg.chr1reversefile )
	arg.chr2forwardwrite = fs.createWriteStream( arg.chr2forwardfile )
	arg.chr2reversewrite = fs.createWriteStream( arg.chr2reversefile )
}

arg.psfile = arg.out+'.phaseset'
arg.pswrite = fs.createWriteStream( arg.psfile )








const nt = new Set(['A','T','C','G'])

const rl = readline.createInterface({input: fs.createReadStream(arg.vcf)})

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
	count_nops=0,
	count_used=0,
	count_dup=0
const pileuperrors = new Map()
const allsnv4 = new Set()




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

	// done reading vcf file

	const tmp = Math.random() // tmp file name

	// last ps
	arg.pswrite.write(pschr+'\t'+psstart+'\t'+psstop+'\t{"name":"phaseset_'+psid+'","color":"'+(psalt ? '#7EA0BD' : '#BD9B7E')+'"}\n')
	arg.pswrite.end()
	exec('sort -k1,1 -k2,2n '+arg.psfile+' > '+tmp)
	exec('mv '+tmp+' '+arg.psfile)
	exec('bgzip -f '+arg.psfile)
	exec('tabix -p bed -f '+arg.psfile+'.gz')

	if(arg.bam) {
		arg.chr1write.end()
		arg.chr2write.end()
		exec('sort -k1,1 -k2,2n '+arg.chr1file+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr1file)
		exec('bedGraphToBigWig '+arg.chr1file+' '+arg.chrsize+' '+arg.chr1file+'.bw')
		exec('sort -k1,1 -k2,2n '+arg.chr2file+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr2file)
		exec('bedGraphToBigWig '+arg.chr2file+' '+arg.chrsize+' '+arg.chr2file+'.bw')
	} else {
		arg.chr1forwardwrite.end()
		arg.chr1reversewrite.end()
		arg.chr2forwardwrite.end()
		arg.chr2reversewrite.end()
		exec('sort -k1,1 -k2,2n '+arg.chr1forwardfile+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr1forwardfile)
		exec('bedGraphToBigWig '+arg.chr1forwardfile+' '+arg.chrsize+' '+arg.chr1forwardfile+'.bw')

		exec('sort -k1,1 -k2,2n '+arg.chr1reversefile+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr1reversefile)
		exec('bedGraphToBigWig '+arg.chr1reversefile+' '+arg.chrsize+' '+arg.chr1reversefile+'.bw')

		exec('sort -k1,1 -k2,2n '+arg.chr2forwardfile+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr2forwardfile)
		exec('bedGraphToBigWig '+arg.chr2forwardfile+' '+arg.chrsize+' '+arg.chr2forwardfile+'.bw')

		exec('sort -k1,1 -k2,2n '+arg.chr2reversefile+' > '+tmp)
		exec('mv '+tmp+' '+arg.chr2reversefile)
		exec('bedGraphToBigWig '+arg.chr2reversefile+' '+arg.chrsize+' '+arg.chr2reversefile+'.bw')
	}





	if(count_notsnp) console.error('count_notsnp',count_notsnp)
	if(count_nosampledata) console.error('count_nosampledata',count_nosampledata)
	if(count_nosample0) console.error('count_nosample0',count_nosample0)
	if(count_nops) console.error('count_nops',count_nops)
	if(count_nogenotype) console.error('count_nogenotype',count_nogenotype)
	if(count_snpnotphased) console.error('count_snpnotphased',count_snpnotphased)
	if(count_not2alleles) console.error('count_not2alleles',count_not2alleles)
	if(count_homozygous) console.error('count_homozygous',count_homozygous)
	if(count_dup) console.error('count_dup',count_dup)
	if(count_used) console.error('count_used',count_used)
	if(pileuperrors.size) {
		for(const [s,c] of pileuperrors) console.error('mpileup error: '+s+', '+c)
	}
})





/////////////////////////// helpers


let psid=null,
	pschr,
	psstart,
	psstop,
	psalt=true


const analyze = (line)=> {

	const [badkeys, mlst, invalidalt] = vcf.vcfparseline( line, vcfobj )
	if(badkeys) abort('badkeys: '+badkeys.join(' '))
	if(invalidalt) abort('invalidalt: '+invalidalt.join(' '))

	for(const m of mlst) {

		const chr = (arg.vcfhaschr ? '' : 'chr') + m.chr

		if(!m.sampledata) {
			count_nosampledata++
			continue
		}

		const sample = m.sampledata[0]
		if(!sample) {
			count_nosample0++
			continue
		}

		if(!sample.PS) {
			count_nops++
			continue
		}

		// PS
		if(sample.PS!=psid) {
			if(!psid) {
				// first
				psid = sample.PS
				pschr = chr
				psstart = psstop = m.pos
			} else {
				// has seen ps
				psalt = !psalt
				arg.pswrite.write(pschr+'\t'+psstart+'\t'+psstop+'\t{"name":"phaseset_'+psid+'","color":"'+(psalt ? '#7EA0BD' : '#BD9B7E')+'"}\n')

				if(chr != pschr) {
					// new chr, log previous ps
					psid = sample.PS
					pschr = chr
					psstart = psstop = m.pos
				} else {
					// same chr
					psid = sample.PS
					psstart = psstop = m.pos
				}
			}
		} else {
			// same ps
			psstop = m.pos
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

		{
			const snv4 = chr+'.'+m.pos+'.'+allele1+'.'+allele2
			if(allsnv4.has(snv4)) {
				count_dup++
				continue
			}
			allsnv4.add(snv4)
		}

		count_used++


		if(arg.bam) {

			const [err,data] = checkbam(m, allele1, allele2)
			if(err) {
				if(!pileuperrors.has(err)) pileuperrors.set(err,0)
				pileuperrors.set( err, pileuperrors.get(err)+1 )
				continue
			}
			arg.chr1write.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr1+'\n')
			arg.chr2write.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr2+'\n')

		} else {

			const [err,data] = checkbamstranded(m, allele1, allele2)
			if(err) {
				if(!pileuperrors.has(err)) pileuperrors.set(err,0)
				pileuperrors.set( err, pileuperrors.get(err)+1 )
				continue
			}
			arg.chr1forwardwrite.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr1.forward+'\n')
			arg.chr1reversewrite.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr1.reverse+'\n')
			arg.chr2forwardwrite.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr2.forward+'\n')
			arg.chr2reversewrite.write(chr+'\t'+m.pos+'\t'+(m.pos+1)+'\t'+data.chr2.reverse+'\n')
		}


		/*
		const j = {
			allele1: allele1,
			allele2: allele2,
			ps: sample.PS,
			count: data
		}
		console.log( chr+'\t'+m.pos+'\t'+JSON.stringify(j) )
		*/

	}
}




const checkbamcoord = m=>{
	let chr
	if(arg.bamhaschr) {
		if(arg.vcfhaschr) {
			chr = m.chr
		} else {
			chr = 'chr'+m.chr
		}
	} else {
		if(arg.vcfhaschr) {
			chr = m.chr.substr(3)
		} else {
			chr = m.chr
		}
	}
	return chr+':'+(m.pos+1)+'-'+(m.pos+1)
}




const checkbam = ( m, allele1, allele2 ) => {

	const upcase1 = allele1.toUpperCase()
	const upcase2 = allele2.toUpperCase()

	const [c1,c2] = dopileup( m, arg.bam, upcase1, upcase2 )
	return [null, { chr1:c1, chr2:c2 } ]
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

	{
		const [c1,c2] = dopileup( m, arg.forbam, upcase1, upcase2 )
		data.chr1.forward += c1
		data.chr2.forward += c2
	}

	{
		const [c1,c2] = dopileup( m, arg.revbam, upcase1, upcase2 )
		data.chr1.reverse += c1
		data.chr2.reverse += c2
	}
	return [null,data]
}








function dopileup(m, bam, upcase1, upcase2) {

	const coord = checkbamcoord(m)
	const line = exec('samtools mpileup -d 999999 -Q 0 -r '+coord+' '+bam+' 2>x',{encoding:'utf8'}).trim().split('\n')[0]

	let c1=0,
		c2=0

	if(line) {
		// 8	128744796	N	33	>>>>>>>>>>>>>>>>>>>>>>><<>><><>>T	HH9GJIHIJHJJB<JDJ>IFJHACFJJFJDDGq
		const l = line.split('\t')
		if(l[4]) {
			for(const x of l[4]) {
				// do not consider case here
				const xup = x.toUpperCase()
				if(!nt.has(xup)) {
					// not a nt
					continue
				}
				if(xup==upcase1) {
					c1++
				} else if(xup==upcase2) {
					c2++
				}
			}
		}
	}
	return [c1,c2]
}
