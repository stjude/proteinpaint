

function isPositiveInteger(a) {
	if(!Number.isInteger(a)) return false
	if(a<=0) return false
	return true
}

exports.isPositiveInteger = isPositiveInteger


const tkt = {
	ruler: 'ruler',
}
exports.tkt = tkt


// codons that are not here are stop codon
const codon={
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




function basecompliment( nt ) {
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



exports.bplen=function(len) {
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



exports.isBadArray = function (i) {
	if(!Array.isArray(i)) return true
	if(i.length==0) return true
	return false
}
