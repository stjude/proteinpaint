/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 1);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

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
	mdssvcnv:'mdssvcnv', // no longer use as driver
	mdsexpressionrank:'mdsexpressionrank',
	mdsvcf:'mdsvcf', // for snv/indels, currently vcf, may include MAF
	//mdsgeneral:'mdsgeneral', // replaces mdssvcnv   ****** not ready yet
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






/*
member track types from mdsvcf
to get rid of hardcoded strings
in future may include MAF format files
*/
exports.mdsvcftype = {
	vcf:'vcf',
}



/*
for custom mdssvcnv track
or general track
to avoid using hard-coded string
*/
exports.custommdstktype = {
	vcf:'vcf',
	svcnvitd:'svcnvitd',
	geneexpression:'geneexpression'
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




const gmmode={
	genomic:'genomic',
	splicingrna:'splicing RNA', // if just 1 exon, use "RNA" as label
	exononly:'exon only',
	protein:'protein',
	gmsum:'aggregated exons'
}
exports.gmmode=gmmode



exports.vcfcopymclass = function (m, block) {

	if(m.csq) {

		// there could be many annotations, the first one not always desirable
		// choose *colorful* annotation based on _csqrank
		let useone=null
		if(block.usegm) {
			for(const q of m.csq) {
				if(q._isoform!=block.usegm.isoform) continue
				if(useone) {
					if(q._csqrank<useone._csqrank) {
						useone=q
					}
				} else {
					useone=q
				}
			}
			if(!useone && block.gmmode==gmmode.genomic) {
				// no match to this gene, but in genomic mode, maybe from other genes?
				useone=m.csq[0]
			}
		} else {
			useone=m.csq[0]
			for(const q of m.csq) {
				if(q._csqrank<useone._csqrank) {
					useone=q
				}
			}
		}
		if(useone) {
			m.gene = useone._gene
			m.isoform = useone._isoform
			m.class=useone._class
			m.dt=useone._dt
			m.mname=useone._mname

			if(m.class == mclassnoncoding) {
				// noncoding converted from csq is not a meaningful, drab color, has no mname label, delete so later will be converted to non-protein class
				delete m.class
			}
		}

	} else if(m.ann) {

		// there could be many applicable annotations, the first one not always desirable
		// choose *colorful* annotation based on _csqrank
		let useone=null
		if(block.usegm) {
			for(const q of m.ann) {
				if(q._isoform!=block.usegm.isoform) continue
				if(useone) {
					if(q._csqrank<useone._csqrank) {
						useone=q
					}
				} else {
					useone=q
				}
			}
			if(!useone && block.gmmode==gmmode.genomic) {
				// no match to this gene, but in genomic mode, maybe from other genes?
				useone=m.ann[0]
			}
		} else {
			useone=m.ann[0]
			for(const q of m.ann) {
				if(q._csqrank<useone._csqrank) {
					useone=q
				}
			}
		}
		if(useone) {
			m.gene=useone._gene
			m.isoform=useone._isoform
			m.class=useone._class
			m.dt=useone._dt
			m.mname=useone._mname

			if(m.class==mclassnoncoding) {
				delete m.class
			}
		}
	}

	if(m.class==undefined) {
		// infer class from m.type, which was assigned by vcf.js
		if(mclass[m.type]) {
			m.class=m.type
			m.dt=mclass[m.type].dt
			m.mname=m.ref+'>'+m.alt
			if(m.mname.length>15) {
				// avoid long indel
				m.mname=m.type
			}
		} else {
			m.class=mclassnonstandard
			m.dt=dtsnvindel
			m.mname=m.type
		}
	}

	delete m.type
}



/*
used in:
	mdssvcnv track, mutation attributes, items that are not annotated by an attribute for showing in legend, and server-side filtering
*/
exports.not_annotated = 'Unannotated'


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

const fs = __webpack_require__(2)
const zlib = __webpack_require__(3)
const path = __webpack_require__(4)
const readline = __webpack_require__(5)
const vcf = __webpack_require__(6)
const common = __webpack_require__(0)

/*
may allow sample-less vcf
may allow multiple files for input 
*/

const arg = checkArg( )

/*
arg:
	.genome
	.genefile
	.excludeclass
	.vcf[ {} ]
		.gzpath
		.indexpath   actually it's not using the index path
*/





//// data structures for samplematrix

const gene2mutationcount = new Map()
/*
k: gene name
v: {
	chrs: map
		chr : {
			start
			stop
			mutationcount
		}
}
*/

const sample2geneset = new Map()
// k: sample
// v: Set of gene



const vcftasks = []

for(const thisvcf of arg.vcf) {

	const task = new Promise((resolve, reject)=>{


		const reader = readline.createInterface({
			input: fs.createReadStream( thisvcf.gzpath ).pipe( zlib.createGunzip() )
		})

		const metalines = []
		const vcfobj = {}

		reader.on('line', line=>{

			if(line[0]=='#') {
				if(line[1]=='C') {
					// sample line
					metalines.push(line)
					const [info, format, samples, err] = vcf.vcfparsemeta( metalines )
					if(err) {
						throw('header error: '+err.join('; '))
					}
					vcfobj.info = info
					vcfobj.format = format
					vcfobj.samples = samples
					return
				}
				metalines.push( line )
				return
			}

			const [badinfo, mlst, altinvald] = vcf.vcfparseline( line, vcfobj )

			if(!mlst || mlst.length==0) return

			for(const m of mlst) {

				// copy over gene annotation from csq or ann
				common.vcfcopymclass( m, {} )
				
				if(!m.gene) {
					// no gene, do not include
					continue
				}

				if(!m.sampledata || m.sampledata.length==0) {
					// no sample
					// may allow sample-less vcf
					continue
				}

				if(arg.excludeclass && arg.excludeclass.has( m.class.toLowerCase() )) {
					continue
				}

				count4gene(m)
				count4sample(m)
			}
		})

		reader.on('close',()=>{
			resolve()
		})
	})

	vcftasks.push( task )
}


Promise.all( vcftasks )
.then( ()=>{

	return adjustGenePosition()

})
.then( ()=>{

	const features = topGenes2features()
	const samples = rankSamplesByFeatures( features )
	//matrix_outputHtml( features, samples )
	make_output( features, samples )
})
.catch(err=>{
	console.log( typeof(err)=='string' ? 'Error: '+err : err.message )
})









function make_output( features, samples ) {

	const featurejson = JSON.stringify(features)

	console.log(`<!DOCTYPE html>

<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sample-by-attribute matrix using ProteinPaint</title>
	<script src='https://platform.dnanexus.com/javascript/file-viewer-1.1.min.js'></script>
	<script src='https://proteinpaint.stjude.org/bin/proteinpaint.js'></script>
    <style type="text/css">
  
	body {
		margin: 0;
		padding: 0;
	}
	
	.omnibar {
		  width: 100%;
		  background: #1381B3;
		  min-height: 64px;
		  font-family: 'Open Sans', "Helvetica Neue", Helvetica, Arial, sans-serif
	}
  

	.logo {
		display: block;
		float: left;
		margin: 0 auto;
		width: 50px;
		height: 50px;
		color: #fff;
		text-decoration: none;
		padding: 8px 10px;
	}
	
	.logo img {
		border: none;
		margin: 0;
		padding: 0;
		width: 100%;
	}
	
	.site-title {
		font-weight: 300;
		font-size: 22px;
		padding: 0;
		margin: 0;
		color: #A1CDE1;
		padding: 14px;
	}
	
	.site-title a {
		color: #fff;
		text-decoration: none;
		font-weight: 600;
	}
	
	
	.nav {
		float: right;
		margin: 0;
		padding: 20px 30px 20px 0;
	}
	
	.nav li {
		display: inline;
		margin: 0;
		padding: 0;
		margin-left: 40px;
		font-weight: 600;
		font-size: 14px;
	}
	
	.nav li a {
		text-decoration: none;
		color: #fff;
		text-transform: uppercase;
	}
	
  
  </style>


  </head>





  <body>


    <div class="omnibar">
        <ul class="nav">
			<li><a href="https://platform.stjude.cloud/requests/data_by_disease">Data</a></li>
			<li><a href="https://platform.stjude.cloud/tools">Tools</a></li>
			<li><a href="https://platform.stjude.cloud/visualizations/cohort">Visualizations</a></li>
        </ul>
        <a href="index.html" class="logo"><img src="https://pecan.stjude.org/static/stjude-logo-child.png" alt="St. Jude Cloud" title="St. Jude Cloud" /></a>
        <h1 class="site-title"><a href="index.html">St. Jude Cloud</a> ProteinPaint</h1>   
    </div>



    <div class="container-fluid" id="proteinpaintdiv"></div>

    <script type="text/javascript">
      getOptions(function(options) {

        function getPath(file) {
          return file.folder + "/" + file.name;
        }

        var pathToURL = {};
        for (var i = 0; i < options.files.length; ++i) {
          pathToURL[getPath(options.files[i])] = options.files[i].url;
        }

		let vcftrack

		for(var path in pathToURL) {
			var filename = path.split('/').pop();
			if(path.endsWith('.vcf.gz')) {
				var indexfile = pathToURL[path+'.csi'] || pathToURL[path+'.tbi']
				if(indexfile) {
					vcftrack = {
						url: pathToURL[path],
						indexURL: indexfile,
					}
				} else {
					window.alert("You chose a VCF.GZ file (" + filename + ") but no associated index file (.tbi or .csi)");
				}
			}
		}

		if(!vcftrack) window.alert('No VCF track provided')

		var proteinpaintConfig={
			//host:'https://proteinpaint.stjude.org',
			host:'http://localhost:3000',
			holder:document.getElementById('proteinpaintdiv'),
			noheader:true,
			samplematrix:{
				genome: "${arg.genome}",
				querykey2tracks: {
					vcf: vcftrack
				},
				features: ${featurejson}
			}
		}

		runproteinpaint(proteinpaintConfig)
	});
    </script>
  </body>
</html>
`)
}




function rankSamplesByFeatures( features ) {

	const featuregenes = new Set()
	for(const f of features) {
		featuregenes.add( f.genename )
	}

	const s2genecount= new Map()
	for(const [sample, thissamplegenes] of sample2geneset) {
		let count=0
		for(const n of thissamplegenes) {
			if(thissamplegenes.has(n)) count++
		}
		if(count) {
			s2genecount.set( sample, count )
		}
	}
	const lst = [ ...s2genecount ]
	lst.sort( (i,j)=> j[1]-i[1] )
	const samples = []
	for(const [sample,count] of lst) {
		samples.push({
			name:sample
		})
	}
	return samples
}



function adjustGenePosition() {
	/*
	adjust start/stop for genes in gene2mutationcount

	read through the entire flat file:
		inefficient
		will not handle alias
	may change to querying pp server?
	*/
	return new Promise((resolve,reject)=>{

		const rl = readline.createInterface({input: fs.createReadStream( arg.genefile, {encoding:'utf8'} )})
		rl.on('line',line=>{
			const l = line.split('\t')
			const j = JSON.parse(l[3])
			if( !gene2mutationcount.has( j.gene ) ) return
			const chr = l[0]

			const o = gene2mutationcount.get(j.gene).chrs.get( chr )
			if(!o) return

			o.start = Math.min( o.start, Number.parseInt(l[1]) )
			o.stop  = Math.max( o.stop,  Number.parseInt(l[2]) )
		})
		rl.on('close',line=>{
			resolve()
		})
	})
}



function topGenes2features() {
	const lst = []
	for(const [genename, o] of gene2mutationcount) {
		for(const [chr, o2] of o.chrs) {
			lst.push({
				isvcf:1,
				querykey:'vcf',
				label: genename + (o.chrs.size>1 ? ' ('+chr+')' : ''),
				genename: genename,
				chr: chr,
				start: o2.start,
				stop: o2.stop,
				_count: o2.mutationcount
			})
		}
	}
	lst.sort( (i,j) => j._count - i._count )

	const features = []
	for(let i=0; i<Math.min( 20, lst.length); i++) {
		const f = lst[i]
		//delete f._count
		features.push( f )
	}
	return features
}



function count4gene( m ) {
	if(!gene2mutationcount.has( m.gene )) {
		gene2mutationcount.set( m.gene, {
			chrs: new Map()
		})
	}

	let o = gene2mutationcount.get(m.gene).chrs.get( m.chr )
	if(!o) {
		o = {
			start: m.pos-1,
			stop: m.pos,
			mutationcount: 0
		}
		gene2mutationcount.get(m.gene).chrs.set( m.chr, o )
	}
	o.start = Math.min(o.start, m.pos)
	o.stop = Math.max(o.stop, m.pos+1)
	o.mutationcount++
}


function count4sample( m ) {
	for(const sm of m.sampledata) {
		if(!sm.sampleobj || !sm.sampleobj.name) {
			// invalid data structure
			continue
		}

		const sample = sm.sampleobj.name

		if(!sample2geneset.has( sample )) {
			sample2geneset.set( sample, new Set() )
		}
		sample2geneset.get( sample ).add( m.gene )
	}
}








function checkArg() {

	if(process.argv.length < 5) abort('insufficient number of output')

	const arg={}

	// parse -- parameters
	let i=2

	for(; i<process.argv.length; i++) {

		const str = process.argv[i]
		if(!str.startsWith('--')) {
			// a file
			break
		}

		const [a,b]=process.argv[i].split('=')

		if(!b) continue

		const key=a.substr(2)

		if(key=='excludeclass') {

			arg.excludeclass = new Set( [...(b.toLowerCase().trim().split(','))] )

		} else {

			arg[key]=b.trim()
		}
	}

	// input files
	arg.vcf = []
	const trackfilename2path = new Map()
	const indexfilename2path = new Map()
	for(; i<process.argv.length; i++) {

		const file = process.argv[i]

		if(file.endsWith('.gz')) {

			trackfilename2path.set( path.basename(file), file  )

		} else if(file.endsWith('.tbi')) {

			indexfilename2path.set( path.basename(file).replace(/\.tbi$/,''), file )

		} else if(file.endsWith('.csi')) {

			indexfilename2path.set( path.basename(file).replace(/\.csi$/,''), file )

		} else {

			// do not process text file
		}
	}

	for(const [name, gzpath] of trackfilename2path) {

		const indexpath = indexfilename2path.get( name )

		if(!indexpath) abort('index file missing for .gz file '+name)

		arg.vcf.push( {
			name: name,
			gzpath: gzpath,
			indexpath: indexpath
		})
	}

	if(arg.vcf.length==0) abort('no VCF file')

	if(!arg.genome) abort('missing genome')

	const genefiles = {
		hg19: '/usr/bin/refGene.hg19',
	}

	arg.genefile = genefiles[ arg.genome ]
	if(!arg.genefile) abort('unknown genome: '+arg.genome)

	// hardcoded for heatmap, may add matrix later

	arg.toheatmap = 1


	function abort( msg ) {
		console.log('Error: '+msg+`
	
$ node getgene.js --genome=<genome> --excludeclass=<class> <input.vcf.gz> <input.vcf.gz.tbi>

Output a JSON obj to stdout, with:
	.filename
	.genes
	.samples

One or multiple VCF files can be selected for input.
A VCF file can be either .vcf.gz (bgzip-compressed) or .vcf (uncompressed).
If compresed, should provide .tbi or .csi index file.
Output is a html file.

--genome=       reference genome name (hg19/hg38)
--excludeclass= Comma separated list of codes, case-insensitive,
                for excluding mutations by class.
                See below for list of class codes and names.
		M            MISSENSE
		E            Exon of noncoding gene
		F            FRAMESHIFT
		N            NONSENSE
		S            SILENT
		D            PROTEINDEL
		I            PROTEININS
		P            SPLICE_REGION
		L            SPLICE
		Intron       INTRON
		Utr3         3' UTR
		Utr5         5' UTR
		noncoding    Noncoding
		snv          SNV, intergenic
		insertion    Insertion, intergenic
		deletion     Deletion, intergenic
		X            Nonstandard
`)
		process.exit()
	}

	return arg
}


/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("zlib");

/***/ }),
/* 4 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("readline");

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

const common=__webpack_require__(0)


/*
Only for parsing vcf files
is not involved in creating vcf tracks

shared between client-server
*/





// for telling symbolic alleles e.g. <*:DEL>
const getallelename=new RegExp(/<(.+)>/)





const mclasslabel2key={}
for(const k in common.mclass) {
	mclasslabel2key[common.mclass[k].label.toUpperCase()]=k
}




exports.vcfparsemeta=function(lines) {
	/*
	input: array of string, as lines separated by linebreak

	##INFO for meta lines
	#CHROM for header, to get samples

	*/

	let sample=[],
		errlst=[],
		info={},
		hasinfo=false,
		format={},
		hasformat=false

	for(const line of lines) {

		if(!line.startsWith('#')) {
			continue
		}

		if(line.startsWith('#C')) {
			// header, get samples
			sample=line.split('\t').slice(9)
			continue
		}

		if(line.startsWith('##INFO')) {
			const e=tohash( line.substring(8,line.length-1), info )
			if(e) {
				errlst.push('INFO error: '+e)
			} else {
				hasinfo=true
			}
			continue
		}

		if(line.startsWith('##FORMAT')) {
			const e=tohash( line.substring(10, line.length-1), format)
			if(e) {
				errlst.push('FORMAT error: '+e)
			} else {
				hasformat=true
			}
		}

	}

	const sampleobjlst = []
	for(const samplename of sample) {

		const a={ name: samplename }

		// this enables adding key4annotation to match with .ds.cohort.annotation

		sampleobjlst.push(a)
	}


	// reserved INFO fields
	if(info.CSQ) {
		const lst=info.CSQ.Description.split(' Format: ')
		if(lst[1]) {
			const lst2=lst[1].split('|')
			if(lst2.length>1) {

				// fix csq headers so to allow configuring show/hide of csq fields
				info.CSQ.csqheader=[]
				for(const str of lst2) {
					const attr = {name:str}
					info.CSQ.csqheader.push(attr)
				}

			} else {
				errlst.push('unknown format for CSQ header: '+info.CSQ.Description)
			}
		} else {
			errlst.push('unknown format for CSQ header: '+info.CSQ.Description)
		}
	}

	if(info.ANN) {
		const lst=info.ANN.Description.split("'")
		if(lst[1]) {
			const lst2=lst[1].split(' | ')
			if(lst2.length) {
				info.ANN.annheader = []
				for(const s of lst2) {
					const attr={name:s}
					info.ANN.annheader.push(attr)
				}
			} else {
				errlst.push('no " | " joined annotation fields for ANN (snpEff annotation): '+info.ANN.Description)
			}
		} else {
			errlst.push('no single-quote enclosed annotation fields for ANN (snpEff annotation): '+info.ANN.Description)
		}
	}

	return [
		hasinfo ? info : null,
		hasformat ? format : null,
		sampleobjlst,
		errlst.length ? errlst : null
	]
}






exports.vcfparseline=function(line,vcf) {
	/*
	vcf, samples/info is generated by vcfparsemeta()
		.nochr BOOL
		.samples [ {} ]
			.name
		.info {}
		.format {}

	return:
		error message STR
		altinvalid []
		mlst [ m ]   one m per alt allele
			chr
			pos
			name
			type
			ref
			alt
			altstr
			sampledata []
			altinfo
	*/

	const lst=line.split('\t')
	if(lst.length<8) {
		// no good
		return ['line has less than 8 fields',null,null]
	}

	const rawpos=Number.parseInt(lst[2-1])
	if(!Number.isInteger(rawpos)) {
		return ['invalid value for genomic position', null, null]
	}

	const refallele=lst[4-1]


	const m={
		vcf_ID: lst[3-1],
		chr:(vcf.nochr ? 'chr':'')+lst[1-1],
		pos:rawpos-1,
		ref:refallele,
		//refstr:refallele, // e.g. GA>GCC, ref:A, refstr:GA, "refstr" is required for matching in FORMAT
		altstr:lst[5-1],
		alleles:[
			{
				// ref allele only a placeholder, to be removed, this array only contains alt alleles
				allele:refallele,
				sampledata:[]
			}
			],

		info:{}, // locus info, do not contain allele info

		name: (lst[3-1]=='.' ? null : lst[3-1])
	}

	// parse alt
	const altinvalid=[]
	for(const alt of lst[5-1].split(',')) {
		const a={
			ref: m.ref, // may be corrected just below!
			allele:alt,
			sampledata:[],
			_m:m,
			info:{} // allele info, do not contain locus info
		}
		m.alleles.push(a)
		if(alt[0]=='<') {
			/*
			symbolic allele, show text within <> as name
			FIXME match INFO
			*/
			const tmp=alt.match(getallelename)
			if(!tmp) {
				altinvalid.push(alt)
				continue
			}
			a.type=tmp[1]

			a.allele = tmp[1]
			a.issymbolicallele=true
		} else {

			// normal nucleotide
			const [p,ref,alt] = correctRefAlt( m.pos, m.ref, a.allele )
			a.pos=p
			a.ref=ref
			a.allele=alt
		}
	}

	if(lst[9-1] && lst[10-1]) {
		parse_FORMAT2( lst, m, vcf )
	}


	/*
	remove ref allele so it only contain alternative alleles
	so that parse_INFO can safely apply Number=A fields to m.alleles
	*/
	m.alleles.shift()

	// info
	const tmp= lst[8-1]=='.' ? [] : dissect_INFO(lst[8-1])
	let badinfokeys=[]

	if(vcf.info) {
		badinfokeys = parse_INFO(tmp, m, vcf)
	} else {
		// vcf meta lines told nothing about INFO, do not parse
		m.info = tmp
	}

	const mlst=[]
	for(const a of m.alleles) {
		const m2={}
		for(const k in m) {
			if(k!='alleles') {
				m2[k]=m[k]
			}
		}
		for(const k in a) {
			if(k=='allele') {
				m2.alt=a[k]
			} else if(k=='info') {
				m2.altinfo=a[k]
			} else {
				m2[k]=a[k]
			}
		}
		if(!m2.issymbolicallele && m2.alt!='NON_REF') {
			/*
			// valid alt allele, apply Dr. J's cool method
			const [p,ref,alt]=correctRefAlt(m2.pos, m2.ref, m2.alt)
			m2.pos=p
			m2.ref=ref
			m2.alt=alt
			*/

			// assign type
			if( m2.ref.length==1 && m2.alt.length==1 ) {
				// both alleles length of 1
				if(m2.alt=='.') {
					// alt is missing
					m2.type=common.mclassdeletion
				} else {
					// snv
					m2.type=common.mclasssnv
				}
			} else if( m2.ref.length==m2.alt.length) {
				m2.type=common.mclassmnv
			} else if( m2.ref.length<m2.alt.length) {
				// FIXME only when empty length of one allele
				m2.type=common.mclassinsertion
			} else if(m2.ref.length>m2.alt.length) {
				m2.type=common.mclassdeletion
			} else {
				m2.type=common.mclassnonstandard
			}
		}
		mlst.push(m2)
	}
	return [
		badinfokeys.length ? 'unknown info keys: '+badinfokeys.join(',') : null,
		mlst,
		altinvalid.length>0 ? altinvalid : null
	]
}





function correctRefAlt(p, ref, alt) {
	// for oligos, always trim the last identical base
	while(ref.length>1 && alt.length>1 && ref[ref.length-1]==alt[alt.length-1]) {
		ref=ref.substr(0,ref.length-1)
		alt=alt.substr(0,alt.length-1)
	}
	// move position up as long as first positions are equal
	while(ref.length>1 && alt.length>1 && ref[0]==alt[0]) {
		ref=ref.substr(1)
		alt=alt.substr(1)
		p++
	}
	return [p,ref,alt]
}







function parse_FORMAT2( lst, m, vcf ) {
	/*
	m.alleles[0] is ref allele
	*/
	const formatfields = lst[9-1].split(':')

	for(let _sampleidx=9; _sampleidx<lst.length; _sampleidx++) {

		// for each sample
		const valuelst = lst[_sampleidx].split(':')
		{
			// tell if this sample have any data in this line (variant), if .:., then skip
			let none=true
			for(const v of valuelst) {
				if(v!='.') {
					none=false
					break
				}
			}
			if(none) {
				// this sample has no format value
				continue
			}
		}


		const sampleidx = _sampleidx-9
		for(let i=1; i<m.alleles.length; i++) {
			const sobj = {}
			if(vcf.samples && vcf.samples[sampleidx]) {
				for(const k in vcf.samples[sampleidx]) {
					sobj[k] = vcf.samples[sampleidx][k]
				}
			} else {
				sobj.name = 'missing_samplename_from_vcf_header'
			}
			m.alleles[i].sampledata.push({
				sampleobj: sobj
			})
		}

		for(let fi=0; fi<formatfields.length; fi++) {

			// for each field of this sample

			const field = formatfields[fi]
			const value = valuelst[fi]
			if(value=='.') {
				// no value for this field
				continue
			}

			if(field == 'GT') {
				const splitter = value.indexOf('/')!=-1 ? '/' : '|'
				let gtsum = 0 // for calculating gtallref=true, old
				let unknowngt=false // if any is '.', then won't calculate gtallref
				const gtalleles = []
				for(const i of value.split(splitter)) {
					if( i == '.' ) {
						unknowngt=true
						continue
					}
					const j = Number.parseInt(i)
					if(Number.isNaN(j)) {
						unknowngt=true
						continue
					}
					gtsum += j
					const ale = m.alleles[ j ]
					if(ale) {
						gtalleles.push( ale.allele )
					}
				}
				let gtallref = false
				if(!unknowngt) {
					gtallref = gtsum == 0
				}
				const genotype = gtalleles.join( splitter )
				for(let i=1; i<m.alleles.length; i++) {
					const ms = m.alleles[i].sampledata[ m.alleles[i].sampledata.length-1 ]
					ms.GT = value
					ms.genotype = genotype
					if(gtallref) {
						ms.gtallref = true
					}
				}
				continue
			}

			// other data fields
			const formatdesc = vcf.format ? vcf.format[ field ] : null
			if(!formatdesc) {
				// unspecified field, put to all alt alleles
				for(let i=1; i<m.alleles.length; i++) {
					m.alleles[i].sampledata[ m.alleles[i].sampledata.length-1 ][ field ] = value
				}
				continue
			}

			const isinteger = formatdesc.Type=='Integer'
			const isfloat = formatdesc.Type=='Float'

			if( (formatdesc.Number && formatdesc.Number=='R') || field=='AD' ) {
				/*
				per-allele value, including ref
				v4.1 has AD not with "R", must process as R
				*/
				const fvlst = value.split(',').map( i=> {
					if(isinteger) return Number.parseInt(i)
					if(isfloat) return Number.parseFloat(i)
					return i
				})
				for(let i=1; i<m.alleles.length; i++) {
					if( fvlst[ i ] !=undefined) {
						// this allele has value
						const m2 = m.alleles[ i ]
						const m2s = m2.sampledata[ m2.sampledata.length-1 ]
						// use this allele's ref/alt (after nt trimming)
						m2s[ field ] = {}
						m2s[ field ][ m2.ref ] = fvlst[0]
						m2s[ field ][ m2.allele ] = fvlst[i]
					}
				}
				continue
			}
			if(formatdesc.Number && formatdesc.Number=='A') {
				// per alt-allele value
				const fvlst = value.split(',').map( i=> {
					if(isinteger) return Number.parseInt(i)
					if(isfloat) return Number.parseFloat(i)
					return i
				})
				for(let i=1; i<m.alleles.length; i++) {
					if( fvlst[ i-1 ] !=undefined) {
						// this allele has value
						const m2 = m.alleles[ i ]
						const m2s = m2.sampledata[ m2.sampledata.length-1 ]
						// use this allele's ref/alt (after nt trimming)
						m2s[ field ] = {}
						m2s[ field ][ m2.allele ] = fvlst[i-1]
					}
				}
				continue
			}
			// otherwise, append this field to all alt
			for(let i=1; i<m.alleles.length; i++) {
				m.alleles[i].sampledata[ m.alleles[i].sampledata.length-1 ][ field ] = value
			}
		}
	}
	// compatible with old ds: make allele2readcount from AD
	for(const a of m.alleles) {
		for(const s of a.sampledata) {
			if(s.AD) {
				s.allele2readcount={}
				for(const k in s.AD) {
					s.allele2readcount[k] = s.AD[k]
				}
			}
		}
	}
}









function tohash(s,hash) {
	/*
	parse INFO
	*/
	const h={},
		err=[]
	let prev=0,
		prevdoublequote=false,
		k=null
	for(let i=0; i<s.length; i++) {
		if(s[i]=='"') {
			i++
			const thisstart=i
			while(s[i]!='"') {
				i++
			}
			if(k) {
				h[k]=s.substring(thisstart,i)
				k=null
			} else {
				err.push('k undefined before double quotes')
			}
			prevdoublequote=true
			continue
		}
		if(s[i]=='=') {
			k=s.substring(prev,i)
			prev=i+1
			continue
		}
		if(s[i]==',') {
			if(prevdoublequote) {
				prevdoublequote=false
			} else {
				if(k) {
					h[k]=s.substring(prev,i)
					k=null
				} else {
					err.push('k undefined')
				}
			}
			prev=i+1
			continue
		}
	}
	if(k) {
		h[k]=s.substring(prev,i)
	}
	if(h.ID) {
		hash[h.ID]=h
	} else {
		return 'no ID'
	}
	if(err.length) return err.join('\n')
}





function parse_INFO(tmp, m, vcf) {

	/*
	this function fills in both m.info{} and m.alleles[].info{}

	the m.alleles[] will later be converted to [m], each carrying one alt allele
	each m will have .info{} for locus info, and .altinfo{} for alt allele info

	*/

	const badinfokeys = []

	for(const key in tmp) {

		if(vcf.info[key]==undefined) {
			badinfokeys.push(key)
			continue
		}

		const value = tmp[key]

		////////////////// hard-coded fields

		if(key=='CSQ') {
			const okay=parse_CSQ( value, vcf.info.CSQ.csqheader, m )
			if(!okay) {
				m.info[key] = value
			}
			continue
		}
		if(key=='ANN') {
			const okay=parse_ANN( value, vcf.info.ANN.annheader, m)
			if(!okay) {
				m.info[key] = value
			}
			continue
		}

		////////////////// end of hardcoded fields

		const __number = vcf.info[key].Number
		const isinteger = vcf.info[key].Type=='Integer'
		const isfloat   = vcf.info[key].Type=='Float'

		if(__number=='0') {
			/*
			no value, should be a flag
			*/
			m.info[key]=key
			continue
		}

		if(__number=='A') {
			/*
			per alt allele
			*/
			const tt = value.split(',')
			for(let j=0; j<tt.length; j++) {
				if(m.alleles[j]) {
					m.alleles[j].info[key]= isinteger ? Number.parseInt(tt[j]) : ( isfloat ? Number.parseFloat(tt[j]) : tt[j] )
				}
			}
			continue
		}

		if(__number=='R') {
			/*
			FIXME "R" is not considered, m.alleles only contain alt, which .info{} for each
			the current datastructure does not support info for ref allele!
			*/
		}



		if(__number=='1') {
			/*
			single value
			*/
			m.info[key] = isinteger ? Number.parseInt(value) : ( isfloat ? Number.parseFloat(value) : value )
			continue
		}

		// number of values unknown, "commas are permitted only as delimiters for lists of values"

		const lst = value.split(',') // value is always array!!
		if(isinteger) {
			m.info[key] = lst.map(Number.parseInt)
		} else if(isfloat) {
			m.info[key] = lst.map(Number.parseFloat)
		} else {
			m.info[key] = lst
		}

	}
	return badinfokeys
}





function parse_CSQ(str,header,m) {
	if(!header) {
		return null
	}
	for(const thisannotation of str.split(',')) {

		const lst = thisannotation.replace(/&/g,',').split('|')

		const o={}

		for(let i=0; i<header.length; i++) {
			if(lst[i]) {
				o[header[i].name]=lst[i]
			}
		}
		if(!o.Allele) {
			continue
		}
		let allele=null
		for(const a of m.alleles) {
			if(a.allele==o.Allele) {
				allele=a
				break
			}
		}
		if(!allele) {
			if(o.Allele=='-') {
				// deletion
				if(m.alleles.length==1) {
					allele=m.alleles[0]
				}
			} else {
				for(const a of m.alleles) {
					if(a.allele.substr(1)==o.Allele) {
						// insertion, without first padding base
						allele=a
						break
					}
				}
			}
			if(!allele) {
				// cannot match to allele!!!
				continue
			}
		}
		if(!allele.csq) {
			allele.csq=[]
		}
		allele.csq.push(o)

		// gene
		o._gene = o.SYMBOL || o.Gene

		// isoform
		if(o.Feature_type && o.Feature_type=='Transcript') {
			o._isoform=o.Feature.split('.')[0] // remove version
		} else {
			o._isoform=o._gene
		}

		// class
		if(o.Consequence) {
			const [dt,cls,rank]=common.vepinfo(o.Consequence)
			o._dt=dt
			o._class=cls
			o._csqrank=rank
		} else {
			// FIXME
			o._dt=common.dtsnvindel
			o._class=common.mclassnonstandard
		}
		// mname
		if(o.HGVSp) {
			o._mname=decodeURIComponent(o.HGVSp.substr(o.HGVSp.indexOf(':')+1))
		} else if(o.Protein_position && o.Amino_acids) {
			o._mname=decodeURIComponent(o.Protein_position+o.Amino_acids)
		} else if(o.HGVSc) {
			o._mname=o.HGVSc.substr(o.HGVSc.indexOf(':')+1)
		} else if(o.Existing_variation) {
			o._name=o.Existing_variation
		} else {
		}
	}
	return true
}





function parse_ANN(str,header,m) {
	// snpEff
	if(!header) {
		return null
	}
	for(const thisannotation of str.split(',')) {

		const lst = thisannotation.replace(/&/g,',').split('|')

		const o={}

		for(let i=0; i<header.length; i++) {
			if(lst[i]) {
				o[header[i].name]=lst[i]
			}
		}
		if(!o.Allele) {
			continue
		}
		let allele=null
		for(const a of m.alleles) {
			if(a.allele==o.Allele) {
				allele=a
				break
			}
		}
		if(!allele) {
			// cannot match to allele!!!
			continue
		}
		if(!allele.ann) {
			allele.ann=[]
		}
		allele.ann.push(o)
		o._gene = o.Gene_Name
		// isoform
		if(o.Feature_Type && o.Feature_Type=='transcript' && o.Feature_ID) {
			o._isoform=o.Feature_ID.split('.')[0]
		}
		// class
		if(o.Annotation) {
			const [dt,cls,rank]=common.vepinfo(o.Annotation)
			o._dt=dt
			o._class=cls
			o._csqrank=rank
		} else {
			// FIXME
			o._dt=common.dtsnvindel
			o._class=common.mclassnonstandard
		}
		// mname
		if(o['HGVS.p']) {
			//o._mname=decodeURIComponent(o.HGVSp.substr(o.HGVSp.indexOf(':')+1))
			o._mname=o['HGVS.p']
		} else if(o['HGVS.c']) {
			o._mname=o['HGVS.c']
		} else {
		}
	}
	return true
}



function dissect_INFO( str ) {
	// cannot simply slice by /[;=]/, but read char by char
	// case  CLNVI=Breast_Cancer_Information_Core__(BRCA2):745-4&base_change=C_to_G;
	// case  k1=v1;DB;k2=v2;

	//let findequal=true
	let findsemicolon=false
	let findequalorsemicolon=true

	let i=0
	let idx=0

	const k2v = {}
	let lastkey

	while(i<str.length) {
		const c = str[i]
		if(findequalorsemicolon) {
			if(c=='=') {
				findsemicolon=true
				findequalorsemicolon=false
				lastkey = str.substring(idx, i)
				idx = i+1
			} else if(c==';') {
				// should be a flag
				k2v[ str.substring(idx, i) ] = 1
				idx = i+1
			}
		} else if(findsemicolon && c==';') {
			findequalorsemicolon=true
			findsemicolon=false
			k2v[ lastkey ] =  str.substring(idx, i)
			lastkey = null
			idx = i+1
		}
		i++
	}

	const remainstr = str.substr(idx, i)
	if(lastkey) {
		k2v[lastkey] = remainstr
	} else {
		k2v[remainstr] = 1
	}

	return k2v
}


/***/ })
/******/ ]);
