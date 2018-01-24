/*
shared between client and server

exported functions
- bplen()
- mclasstester()
- basecompliment()


*/




exports.defaultcolor='#8AB1D4'

exports.exoncolor='#4F8053'


// something that has something to do with coding gene reading frame
const IN_frame=true
const OUT_frame=false
exports.IN_frame=IN_frame
exports.OUT_frame=OUT_frame


const dtsnvindel=1,
	dtfusionrna=2,
	dtgeneexpression=3,
	dtcnv=4,
	dtsv=5,
	dtitd=6,
	dtdel=7,
	dtnloss=8,
	dtcloss=9,
	dtloh=10 // to be used in svcnv track

const h={}
h[dtsnvindel]='SNV/indel'
h[dtfusionrna]='Fusion RNA'
h[dtcnv]='CNV'
h[dtsv]='SV'
h[dtitd]='ITD'
h[dtdel]='Deletion'
h[dtnloss]='N-loss'
h[dtcloss]='C-loss'
h[dtloh] = 'LOH'
exports.dt2label=h
exports.dtsnvindel=dtsnvindel
exports.dtfusionrna=dtfusionrna
exports.dtsv=dtsv
exports.dtgeneexpression=dtgeneexpression
exports.dtcnv=dtcnv
exports.dtitd=dtitd
exports.dtdel=dtdel
exports.dtnloss=dtnloss
exports.dtcloss=dtcloss
exports.dtloh=dtloh


const mclass={
	M:{label:'MISSENSE',color:'#3987CC',dt:dtsnvindel,
		desc:'A substitution variant in the coding region resulting in altered protein coding.',
		},
	E:{label:'EXON',color:'#bcbd22',dt:dtsnvindel,
		desc:'A variant in the exon of a non-coding RNA.',
		},
	F:{label:'FRAMESHIFT',color:'#db3d3d',dt:dtsnvindel,
		desc:'An insertion or deletion variant that alters the protein coding frame.',
		},
	N:{label:'NONSENSE',color:'#ff7f0e',dt:dtsnvindel,
		desc:'A variant altering protein coding to produce a premature stopgain or stoploss.',
		},
	S:{label:'SILENT',color:'#2ca02c',dt:dtsnvindel,
		desc:'A substitution variant in the coding region that does not alter protein coding.',
		},
	D:{label:'PROTEINDEL',color:'#7f7f7f',dt:dtsnvindel,
		desc:'A deletion resulting in a loss of one or more codons from the product, but not altering the protein coding frame.',
		},
	I:{label:'PROTEININS',color:'#8c564b',dt:dtsnvindel,
		desc:'An insertion introducing one or more codons into the product, but not altering the protein coding frame.',
		},
	P:{label:'SPLICE_REGION',color: '#9467bd', dt:dtsnvindel,
		desc:'A variant in an intron within 10 nt of an exon boundary.',
		},
	L:{label:'SPLICE',color:'#6633FF',dt:dtsnvindel,
		desc:'A variant near an exon edge that may affect splicing functionality.',
		},
	Intron:{label:'INTRON',color:'#bbbbbb',dt:dtsnvindel,
		desc:'An intronic variant.',
		},
}
var mclassitd='ITD'
mclass[mclassitd]={
	label:'ITD',color:'#ff70ff',dt:dtitd,
	desc:'In-frame internal tandem duplication.'
	}
exports.mclassitd=mclassitd
var mclassdel='DEL'
mclass[mclassdel]={
	label:'DELETION, intragenic',color:'#858585',dt:dtdel,
	desc:'Intragenic deletion.'
	}
exports.mclassdel=mclassdel

var mclassnloss='NLOSS'
mclass[mclassnloss]={
	label:'N-terminus loss',
	color:'#545454',
	dt:dtnloss,
	desc:'N-terminus loss due to translocation'
	}
exports.mclassnloss=mclassnloss
var mclasscloss='CLOSS'
mclass[mclasscloss]={
	label:'C-terminus loss',
	color:'#545454',
	dt:dtcloss,
	desc:'C-terminus loss due to translocation'
	}
exports.mclasscloss=mclasscloss

var mclassutr3='Utr3';
mclass[mclassutr3]={
	label:'UTR_3',color:'#998199',dt:dtsnvindel,
	desc:'A variant in the 3\' untranslated region.',
	};
exports.mclassutr3=mclassutr3;
var mclassutr5='Utr5';
mclass[mclassutr5]={
	label:'UTR_5',color:'#819981',dt:dtsnvindel,
	desc:'A variant in the 5\' untranslated region.',
	};
exports.mclassutr5=mclassutr5;
var mclassnonstandard='X';
mclass[mclassnonstandard]={
	label:'NONSTANDARD',color:'black',dt:dtsnvindel,
	desc:'A mutation class that either does not match our notation, or is unspecified.'
	};
exports.mclassnonstandard=mclassnonstandard;
var mclassnoncoding='noncoding'
mclass[mclassnoncoding]={
	label:'NONCODING',
	color:'black',
	dt:dtsnvindel,
	desc:'Noncoding mutation.'
}
exports.mclassnoncoding=mclassnoncoding
// done point mutations

exports.mclasstester=function(s) {
	switch(s.toLowerCase()) {
	case 'missense_mutation': return 'M'
	case 'nonsense_mutation': return 'N'
	case 'splice_site': return 'L'
	case 'rna': return mclassnoncoding
	case 'frame_shift_del': return 'F'
	case 'frame_shift_ins': return 'F'
	case 'in_frame_del': return 'D'
	case 'in_frame_ins': return 'I'
	case 'translation_start_site': return mclassnonstandard
	case 'nonstop_mutation': return 'N'
	case "3'utr": return mclassutr3
	case "3'flank": return mclassnoncoding
	case "5'utr": return mclassutr5
	case "5'flank": return mclassnoncoding
	default: return null
	}
}




var mclassfusionrna='Fuserna'
exports.mclassfusionrna=mclassfusionrna;
mclass[mclassfusionrna]={
	label:'Fusion transcript', color:'#545454', dt:dtfusionrna,
	desc:'Marks the break points leading to fusion transcripts, predicted by "Cicero" from RNA-seq data.<br>'
	+'<span style="font-size:150%">&#9680;</span> - 3\' end of the break point is fused to the 5\' end of another break point in a different gene.<br>'
	+'<span style="font-size:150%">&#9681;</span> - 5\' end of the break point is fused to the 3\' end of another break point in a different gene.'
	}
var mclasssv='SV'
exports.mclasssv=mclasssv
mclass[mclasssv]={
	label:'Structural variation',color:'#858585',dt:dtsv,
	desc:'Structural variation detected in genomic DNA.'
	}

const mclasscnvgain='CNV_amp'
exports.mclasscnvgain=mclasscnvgain
mclass[mclasscnvgain]={label:'Copy number gain',color:'#e9a3c9',dt:dtcnv,desc:'Copy number gain'}
const mclasscnvloss='CNV_loss'
exports.mclasscnvloss=mclasscnvloss
mclass[mclasscnvloss]={label:'Copy number loss',color:'#a1d76a',dt:dtcnv,desc:'Copy number loss'}
const mclasscnvloh='CNV_loh'
exports.mclasscnvloh=mclasscnvloh
mclass[mclasscnvloh]={label:'LOH',color:'#12EDFC',dt:dtcnv,desc:'Loss of heterozygosity'}


// for VCF
const mclasssnv='snv'
exports.mclasssnv=mclasssnv
mclass[mclasssnv]={label:'SNV',color:'#5781FF',dt:dtsnvindel,desc:'Single nucleotide variation'}
const mclassmnv='mnv'
exports.mclassmnv=mclassmnv
mclass[mclassmnv]={label:'MNV',color:'#6378B8',dt:dtsnvindel,desc:'Multiple nucleotide variation'}
const mclassinsertion='insertion'
exports.mclassinsertion=mclassinsertion
mclass[mclassinsertion]={label:'Sequence insertion',color:'#ED5C66',dt:dtsnvindel,desc:'Sequence insertion'}
const mclassdeletion='deletion'
exports.mclassdeletion=mclassdeletion
mclass[mclassdeletion]={label:'Sequence deletion',color:'#F0B11F',dt:dtsnvindel,desc:'Sequence deletion'}
// TODO complex indel


exports.mclass=mclass



var vepinfo=function(s) {
	const l=s.toLowerCase().split(',')
	let rank=1
	if(l.indexOf('transcript_ablation')!=-1) {
		// FIXME no class for whole gene deletion
		return [dtdel,mclassdel,rank]
	}
	rank++
	if(l.indexOf('splice_acceptor_variant')!=-1)	return [dtsnvindel,'L',rank]
	rank++
	if(l.indexOf('splice_donor_variant')!=-1)		return [dtsnvindel,'L',rank]
	rank++
	if(l.indexOf('stop_gained')!=-1)				return [dtsnvindel,'N',rank]
	rank++
	if(l.indexOf('frameshift_variant')!=-1)			return [dtsnvindel,'F',rank]
	rank++
	if(l.indexOf('stop_lost')!=-1)					return [dtsnvindel,'N',rank]
	rank++
	if(l.indexOf('start_lost')!=-1)					return [dtsnvindel,'N',rank]
	rank++
	if(l.indexOf('transcript_amplification')!=-1) {
		// FIXME no class for whole gene amp
													return [dtsnvindel,mclassnonstandard,rank]
	}
	rank++
	if(l.indexOf('inframe_insertion')!=-1 || l.indexOf('conservative_inframe_insertion')!=-1 || l.indexOf('disruptive_inframe_insertion')!=-1 ) return [dtsnvindel,'I',rank]
	rank++
	if(l.indexOf('inframe_deletion')!=-1 || l.indexOf('conservative_inframe_deletion')!=-1 || l.indexOf('disruptive_inframe_deletion')!=-1)	return [dtsnvindel,'D',rank]
	rank++
	if(l.indexOf('missense_variant')!=-1)			return [dtsnvindel,'M',rank]
	rank++
	if(l.indexOf('protein_altering_variant')!=-1)	return [dtsnvindel,'N',rank]
	rank++
	if(l.indexOf('splice_region_variant')!=-1)		return [dtsnvindel,'P',rank]
	rank++
	if(l.indexOf('incomplete_terminal_codon_variant')!=-1) return [dtsnvindel,'N',rank]
	rank++
	if(l.indexOf('stop_retained_variant')!=-1)		return [dtsnvindel,'S',rank]
	rank++
	if(l.indexOf('synonymous_variant')!=-1)			return [dtsnvindel,'S',rank]
	rank++
	if(l.indexOf('coding_sequence_variant')!=-1)	return [dtsnvindel,mclassnonstandard,rank]
	rank++
	if(l.indexOf('mature_mirna_variant')!=-1)		return [dtsnvindel,'E',rank]
	rank++
	if(l.indexOf('5_prime_utr_variant')!=-1)		return [dtsnvindel,mclassutr5,rank]
	rank++
	if(l.indexOf('3_prime_utr_variant')!=-1)		return [dtsnvindel,mclassutr3,rank]
	rank++
	if(l.indexOf('non_coding_transcript_exon_variant')!=-1) return [dtsnvindel,'E',rank]
	rank++
	if(l.indexOf('intron_variant')!=-1)				return [dtsnvindel,'Intron',rank]
	rank++
	if(l.indexOf('nmd_transcript_variant')!=-1)		return [dtsnvindel,'S',rank]
	rank++
	if(l.indexOf('non_coding_transcript_variant')!=-1) return [dtsnvindel,'E',rank]
	rank++
	if(l.indexOf('upstream_gene_variant')!=-1)		return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('downstream_gene_variant')!=-1)	return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('tfbs_ablation')!=-1)				return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('tfbs_amplification')!=-1)			return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('tf_binding_site_variant')!=-1)	return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('regulatory_region_ablation')!=-1) return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('regulatory_region_amplification')!=-1) return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('feature_elongation')!=-1)			return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('regulatory_region_variant')!=-1)	return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('feature_truncation')!=-1)			return [dtsnvindel,mclassnoncoding,rank]
	rank++
	if(l.indexOf('intergenic_variant')!=-1)			return [dtsnvindel,mclassnoncoding,rank]
	rank++
	return [dtsnvindel,mclassnonstandard,rank]
}

exports.vepinfo=vepinfo



// m orgin



const germlinelegend='<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="#858585" stroke="none"></path>'
const morigin={}
const moriginsomatic='S'
morigin[moriginsomatic]={
	label:'Somatic',
	desc:'A variant found only in a tumor sample. The proportion is indicated by lack of any arc.',
	legend:'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle>'
}
const morigingermline='G'
morigin[morigingermline]={
	label:'Germline',
	desc:'A constitutional variant found in a normal sample. The proportion is indicated by the span of the solid arc within the whole circle.',
	legend:germlinelegend
}
const moriginrelapse='R'
morigin[moriginrelapse]={
	label:'Relapse',
	desc:'A somatic variant found only in a relapse sample. The proportion is indicated by the span of the hollow arc within the whole circle.',
	legend:'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="none" stroke="#858585"></path>'
}
const morigingermlinepathogenic='GP'
morigin[morigingermlinepathogenic]={
	label:'Germline pathogenic',
	desc:'A constitutional variant with pathogenic allele.',
	legend:germlinelegend
}
const morigingermlinenonpathogenic='GNP'
morigin[morigingermlinenonpathogenic]={
	label:'Germline non-pathogenic',
	desc:'A constitutional variant with non-pathogenic allele.',
	legend:germlinelegend,
	hidden:true
}
exports.morigingermline=morigingermline
exports.morigingermlinenonpathogenic=morigingermlinenonpathogenic
exports.morigingermlinepathogenic=morigingermlinepathogenic
exports.moriginrelapse=moriginrelapse
exports.moriginsomatic=moriginsomatic
exports.morigin=morigin





const tkt={
	usegm:'usegm',
	ds:'dataset',
	bigwig:'bigwig',
	bigwigstranded:'bigwigstranded',
	junction:'junction',
	mdsjunction:'mdsjunction',
	mdscnv:'mdscnv',
	mdssvcnv:'mdssvcnv',
	mdsexpressionrank:'mdsexpressionrank',
	mdsvcf:'mdsvcf',
	bedj:'bedj',
	pgv:'profilegenevalue',
	bampile:'bampile',
	hicstraw:'hicstraw',
	expressionrank:'expressionrank',
	aicheck:'aicheck'
}
exports.tkt = tkt


exports.validtkt=function(what) {
	for(const k in tkt) {
		if(what==tkt[k]) {
			return true
		}
	}
	return false
}






// codons that are not here are stop codon!!
var codon={
GCT:'A', GCC:'A', GCA:'A', GCG:'A',
CGT:'R', CGC:'R', CGA:'R', CGG:'R', AGA:'R', AGG:'R',
AAT:'N', AAC:'N',
GAT:'D', GAC:'D',
TGT:'C', TGC:'C',
CAA:'Q', CAG:'Q',
GAA:'E', GAG:'E',
GGT:'G', GGC:'G', GGA:'G', GGG:'G',
CAT:'H', CAC:'H',
ATT:'I', ATC:'I', ATA:'I',
TTA:'L', TTG:'L', CTT:'L', CTC:'L', CTA:'L', CTG:'L',
AAA:'K', AAG:'K',
ATG:'M',
TTT:'F', TTC:'F',
CCT:'P', CCC:'P', CCA:'P', CCG:'P',
TCT:'S', TCC:'S', TCA:'S', TCG:'S', AGT:'S', AGC:'S',
ACT:'T', ACC:'T', ACA:'T', ACG:'T',
TGG:'W',
TAT:'Y', TAC:'Y',
GTT:'V', GTC:'V', GTA:'V', GTG:'V',
}
exports.codon=codon
const codon_stop='*'
exports.codon_stop=codon_stop




function nt2aa(gm) {
	// must convert genome seq to upper case!!!
	if(!gm.genomicseq) return undefined
	const enlst=[]
	if(gm.coding) {
		for(const e of gm.coding) {
			let s=gm.genomicseq.substr(e[0]-gm.start,e[1]-e[0])
			if(gm.strand=='-') {
				const s2=[]
				for(let i=s.length-1; i>=0; i--) {
					s2.push(basecompliment(s[i]))
				}
				s=s2.join('')
			}
			enlst.push(s)
		}
	}
	const nt=enlst.join('')
	const pep=[]
	for(let i=0; i<nt.length; i+=3) {
		const a=codon[nt.substr(i,3)]
		pep.push( a ? a : codon_stop)
	}
	gm.cdseq=nt
	return pep.join('')
}
exports.nt2aa=nt2aa



exports.bplen=function(len)
{
if(len>=1000000000) return (len/1000000000).toFixed(1)+' Gb'
if(len>=10000000) return Math.ceil(len/1000000)+' Mb'
if(len>=1000000) return (len/1000000).toFixed(1)+' Mb'
if(len>=10000) return Math.ceil(len/1000)+' Kb'
if(len>=1000) return (len/1000).toFixed(1)+' Kb'
return len+' bp'
}



exports.basecolor={
	A:'#ca0020',
	T:'#f4a582',
	C:'#92c5de',
	G:'#0571b0',
}



function basecompliment(nt) {
	switch(nt){
	case 'A':return 'T'
	case 'T':return 'A'
	case 'C':return 'G'
	case 'G':return 'C'
	case 'a':return 't'
	case 't':return 'a'
	case 'c':return 'g'
	case 'g':return 'c'
	default:return nt
	}
}
exports.basecompliment=basecompliment




exports.spliceeventchangegmexon=function(gm, evt) {
	/*
	alter gm.coding[], by exon-skip/alt events
	for frame checking
	gm must have coding
	*/
	const gm2={
		chr:gm.chr,
		start:gm.start,
		stop:gm.stop,
		strand:gm.strand,
		coding:[]
	}
	if(evt.isskipexon || evt.isaltexon) {

		for(let i=0; i<gm.exon.length; i++) {
			const codingstart = Math.max(gm.codingstart, gm.exon[i][0])
			const codingstop  = Math.min(gm.codingstop, gm.exon[i][1])
			if(codingstart > codingstop) {
				// not coding exon
				continue
			}
			if(evt.skippedexon.indexOf(i)==-1) {
				// not skipped
				gm2.coding.push([codingstart, codingstop])
			} else {
				// skipped
			}
		}

	} else if(evt.a5ss || evt.a3ss) {

		// still equal number of exons
		// adjust the affected exon first, then figure out coding[]
		const exons = gm.exon.map( e=> [e[0],e[1]])
		const forward = gm.strand=='+'
		if(evt.a5ss) {
			if(forward) {
				exons[ evt.exon5idx   ][1] = evt.junctionB.start
			} else {
				exons[ evt.exon5idx+1 ][0] = evt.junctionB.stop
			}
		} else {
			if(forward) {
				exons[ evt.exon5idx+1 ][0] = evt.junctionB.stop
			} else {
				exons[ evt.exon5idx   ][1] = evt.junctionB.start
			}
		}
		// from new exons, figure out coding exons
		for(const e of exons) {
			const codingstart = Math.max(gm.codingstart, e[0])
			const codingstop  = Math.min(gm.codingstop, e[1])
			if(codingstart > codingstop) {
				// not coding exon
				continue
			}
			gm2.coding.push([codingstart, codingstop])
		}
	}
	return gm2
}



exports.fasta2gmframecheck=function(gm, str) {
	/*
	gm{}
		.chr
		.start
		.stop
			start/stop is transcript position
		.strand
		.coding[]
	str
		samtools faidx output
	*/
	const lines=str.split('\n')
	// remove fasta header
	lines.shift()
	gm.genomicseq=lines.join('').toUpperCase()

	const aaseq=nt2aa(gm)

	let thisframe=OUT_frame
	const stopcodonidx=aaseq.indexOf(codon_stop)
	if(stopcodonidx==aaseq.length-1) {
		// the first appearance of stop codon is at the last of translation
		thisframe=IN_frame
	}
	return thisframe
}





exports.validate_vcfinfofilter=function(obj) {
	/*
	validate vcfinfofilter as from embedding api or dataset
	*/

	if(!obj.lst) return '.lst missing'

	if(!Array.isArray(obj.lst)) return 'input is not an array'

	for(const set of obj.lst) {

		if(!set.name) return 'name missing from a set of .vcfinfofilter.lst'

		if(set.categories) {

			// categorical info
			for(const k in set.categories) {
				const v=set.categories[k]
				if(!v.color) return '.color missing for class '+k+' from .categories of set '+set.name
				if(!v.label) {
					v.label=k
				}
			}
			if(set.categoryhidden) {
				for(const k in set.categoryhidden) {
					if(!set.categories[k]) return 'unknown hidden-by-default category '+k+' from set '+set.name
				}
			} else {
				set.categoryhidden = {}
			}

		} else if(set.numericfilter) {
			// otherwise, numerical value, the style of population frequency filter
			const lst=[]
			for(const v of set.numericfilter) {
				if(typeof(v)=='number') {
					/*
					just a number, defaults to 'lower-than'
					*/
					lst.push({side:'<',value:v})
				} else {
					lst.push({
						side: (v.side || '<'),
						value:v.value
					})
				}
			}
			set.numericfilter = lst

			//return 'no .categories or .numericfilter from set '+set.name
		}

		if(set.altalleleinfo) {
			if(!set.altalleleinfo.key) {
				return '.key missing from .altalleleinfo from set '+set.name
			}
		} else if(set.locusinfo) {
			if(!set.locusinfo.key) {
				return '.key missing from .locusinfo from set '+set.name
			}
		} else {
			return 'neither .altalleleinfo or .locusinfo is available from set '+set.name
		}
	}
}




exports.contigNameNoChr=function(genome,chrlst) {
	/*
	FIXME hard-coded for human genome styled chromosome names
	*/
	for(const n in genome.majorchr) {
		if(chrlst.indexOf(n.replace('chr',''))!=-1) {
			return true
		}
	}
	if(genome.minorchr) {
		for(const n in genome.minorchr) {
			if(chrlst.indexOf(n.replace('chr',''))!=-1) {
				return true
			}
		}
	}
	return false
}



exports.getMax_byiqr=function(lst, novaluemax) {
	/*
	lst: array of numbers
	novaluemax: when lst is empty, return this value
	cutoff value based on IQR to exclude outlier values
	*/
	if(lst.length==0) return novaluemax
	lst.sort((i,j)=>i-j)
	const max=lst[lst.length-1]
	if(lst.length<=5) return max
	const q1=lst[Math.floor(lst.length/4)]
	const q2=lst[Math.floor(lst.length*3/4)]
	return Math.min( q2+(q2-q1)*1.5, max)
}




exports.alleleInGenotypeStr = function(genotype, allele) {
	if(!genotype) return false
	if(genotype.indexOf('/')!=-1) {
		return genotype.split('/').indexOf(allele)!=-1
	}
	return genotype.split('|').indexOf(allele)!=-1
}
