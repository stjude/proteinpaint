/*
shared between client and server

exported functions
- bplen()
- mclasstester()
- basecompliment()


*/
import { rgb } from 'd3-color'
import * as d3scale from 'd3-scale'
import * as d3 from 'd3'

// moved from `#shared/terms` to here, so that this can be passed as
// part of 'common' argument to exported dataset js function, at server runtime
export const TermTypeGroups = {
	DICTIONARY_VARIABLES: 'Dictionary Variables',
	MUTATION_CNV_FUSION: 'Mutation/CNV/Fusion',
	VARIANT_GENOTYPE: 'Variant Genotype',
	DNA_METHYLATION: 'DNA Methylation',
	GENE_DEPENDENCY: 'Gene Dependency',
	GENE_EXPRESSION: 'Gene Expression',
	PROTEIN_EXPRESSION: 'Protein Expression',
	SPLICE_JUNCTION: 'Splice Junction',
	METABOLITE_INTENSITY: 'Metabolite Intensity',
	GSEA: 'GSEA',
	MUTATION_SIGNATURE: 'Mutation Signature',
	SNP: 'SNP Genotype',
	SNP_LIST: 'SNP List',
	SNP_LOCUS: 'SNP Locus'
}

export const defaultcolor = rgb('#8AB1D4').darker()
export const default_text_color = rgb('#aaa').darker().darker()

export const exoncolor = '#4F8053'
export const plotColor = '#ce768e'

// something that has something to do with coding gene reading frame
export const IN_frame = true
export const OUT_frame = false

/********************************
*        on dt usage            *
*********************************
- once a dt value is decided and used with actual dataset,
  the value must not be altered, since dataset file may hardcode such value and reassigning to a new integer will break!
- never test dt value by range e.g. if(dt>10), it breaks! only test equality!
- in code import variable from here and DO NOT use literal values, to make code tractable
*/
export const dtsnvindel = 1
export const dtfusionrna = 2
export const dtgeneexpression = 3
export const dtcnv = 4
export const dtsv = 5
export const dtitd = 6
export const dtdel = 7
export const dtnloss = 8
export const dtcloss = 9
export const dtloh = 10
export const dtmetaboliteintensity = 11
// add new dt value here, and DO NOT change value of existing dt!

export const dt2label = {
	[dtsnvindel]: 'SNV/indel',
	[dtfusionrna]: 'Fusion RNA',
	[dtcnv]: 'CNV',
	[dtsv]: 'SV',
	[dtitd]: 'ITD',
	[dtdel]: 'Deletion',
	[dtnloss]: 'N-loss',
	[dtcloss]: 'C-loss',
	[dtloh]: 'LOH',
	[dtgeneexpression]: 'Gene Expression',
	[dtmetaboliteintensity]: 'Metabolite Intensity'
}

export const mclass = {
	M: {
		label: 'MISSENSE',
		color: '#3987CC',
		dt: dtsnvindel,
		desc: 'A sequence variant, that changes one or more bases, resulting in a different amino acid sequence but where the length is preserved',
		key: 'M'
	},
	E: { label: 'EXON', color: '#bcbd22', dt: dtsnvindel, desc: 'A variant in the exon of a non-coding RNA.', key: 'E' },
	F: {
		label: 'FRAMESHIFT',
		color: '#db3d3d',
		dt: dtsnvindel,
		desc: 'A sequence variant which causes a disruption of the translational reading frame, because the number of nucleotides inserted or deleted is not a multiple of three',
		key: 'F'
	},
	N: {
		label: 'NONSENSE',
		color: '#ff7f0e',
		dt: dtsnvindel,
		desc: 'A sequence variant whereby at least one base of a codon is changed, resulting in a premature stop codon, leading to a shortened transcript',
		key: 'N'
	},
	S: {
		label: 'SILENT',
		color: '#2ca02c',
		dt: dtsnvindel,
		desc: 'A sequence variant where there is no resulting change to the encoded amino acid',
		key: 'S'
	},
	D: {
		label: 'PROTEINDEL',
		color: 'rgb(100, 100, 100)',
		dt: dtsnvindel,
		desc: 'An inframe non synonymous variant that deletes bases from the coding sequence',
		key: 'D'
	},
	I: {
		label: 'PROTEININS',
		color: '#8c564b',
		dt: dtsnvindel,
		desc: 'An inframe non synonymous variant that inserts bases into in the coding sequence',
		key: 'I'
	},
	ProteinAltering: {
		label: 'PROTEINALTERING',
		color: '#5a0034',
		dt: dtsnvindel,
		desc: 'An inframe complex change to the coding sequence',
		key: 'ProteinAltering'
	},
	P: {
		label: 'SPLICE_REGION',
		color: '#9467bd',
		dt: dtsnvindel,
		desc: 'A sequence variant in which a change has occurred within the region of the splice site, either within 1-3 bases of the exon or 3-8 bases of the intron',
		key: 'P'
	},
	L: {
		label: 'SPLICE',
		color: '#6633FF',
		dt: dtsnvindel,
		desc: 'A variant near an exon edge that may affect splicing functionality',
		key: 'L'
	},
	Intron: { label: 'INTRON', color: '#656565', dt: dtsnvindel, desc: 'An intronic variant.', key: 'Intron' },

	// quick fix!! for showing genes that are not tested in samples (e.g. gene panels) in the heatmap
	Blank: { label: 'Not tested', color: '#fff', dt: dtsnvindel, desc: 'This gene is not tested.', key: 'Blank' },

	WT: { label: 'Wildtype', color: '#D3D3D3', dt: dtsnvindel, desc: 'Wildtype', key: 'WT' }
}
export const mclassitd = 'ITD'
mclass[mclassitd] = {
	label: 'ITD',
	color: '#ff70ff',
	dt: dtitd,
	desc: 'In-frame internal tandem duplication.',
	key: mclassitd
}

export const mclassdel = 'DEL'
mclass[mclassdel] = {
	label: 'DELETION, intragenic',
	color: '#858585',
	dt: dtdel,
	desc: 'Intragenic deletion.',
	key: mclassdel
}

export const mclassnloss = 'NLOSS'
mclass[mclassnloss] = {
	label: 'N-terminus loss',
	color: '#545454',
	dt: dtnloss,
	desc: 'N-terminus loss due to translocation',
	key: mclassnloss
}

export const mclasscloss = 'CLOSS'
mclass[mclasscloss] = {
	label: 'C-terminus loss',
	color: '#545454',
	dt: dtcloss,
	desc: 'C-terminus loss due to translocation',
	key: mclasscloss
}

export const mclassutr3 = 'Utr3'
mclass[mclassutr3] = {
	label: 'UTR_3',
	color: '#998199',
	dt: dtsnvindel,
	desc: "A variant in the 3' untranslated region.",
	key: mclassutr3
}

export const mclassutr5 = 'Utr5'
mclass[mclassutr5] = {
	label: 'UTR_5',
	color: '#819981',
	dt: dtsnvindel,
	desc: "A variant in the 5' untranslated region.",
	key: mclassutr5
}

export const mclassnonstandard = 'X'
mclass[mclassnonstandard] = {
	label: 'NONSTANDARD',
	color: 'black',
	dt: dtsnvindel,
	desc: 'A mutation class that either does not match our notation, or is unspecified.',
	key: mclassnonstandard
}

export const mclassnoncoding = 'noncoding'
mclass[mclassnoncoding] = {
	label: 'NONCODING',
	color: 'black',
	dt: dtsnvindel,
	desc: 'Noncoding mutation.',
	key: mclassnoncoding
}
// done point mutations

export function mclasstester(s) {
	switch (s.toLowerCase()) {
		case 'missense_mutation':
			return 'M'
		case 'nonsense_mutation':
			return 'N'
		case 'splice_site':
			return 'L'
		case 'rna':
			return mclassnoncoding
		case 'frame_shift_del':
			return 'F'
		case 'frame_shift_ins':
			return 'F'
		case 'in_frame_del':
			return 'D'
		case 'in_frame_ins':
			return 'I'
		case 'protein_altering_variant':
			return 'ProteinAltering'
		case 'translation_start_site':
			return mclassnonstandard
		case 'nonstop_mutation':
			return 'N'
		case "3'utr":
			return mclassutr3
		case "3'flank":
			return mclassnoncoding
		case "5'utr":
			return mclassutr5
		case "5'flank":
			return mclassnoncoding
		case 'blank':
			return 'Blank'
		default:
			return null
	}
}

export const mclassfusionrna = 'Fuserna'
mclass[mclassfusionrna] = {
	label: 'Fusion transcript',
	color: '#545454',
	dt: dtfusionrna,
	desc:
		'Marks the break points leading to fusion transcripts.<br>' +
		'<span style="font-size:150%">&#9680;</span> - 3\' end of the break point is fused to the 5\' end of another break point in a different gene.<br>' +
		'<span style="font-size:150%">&#9681;</span> - 5\' end of the break point is fused to the 3\' end of another break point in a different gene.',
	key: mclassfusionrna
}
export const mclasssv = 'SV'
mclass[mclasssv] = {
	label: 'Structural variation',
	color: '#858585',
	dt: dtsv,
	desc: 'Structural variation detected in genomic DNA.',
	key: mclasssv
}

export const mclasscnvgain = 'CNV_amp'
mclass[mclasscnvgain] = {
	label: 'Copy number gain',
	color: '#e9a3c9',
	dt: dtcnv,
	desc: 'Copy number gain',
	key: mclasscnvgain
}

export const mclasscnvloss = 'CNV_loss'
mclass[mclasscnvloss] = {
	label: 'Copy number loss',
	color: '#a1d76a',
	dt: dtcnv,
	desc: 'Copy number loss',
	key: mclasscnvloss
}

export const mclasscnvloh = 'CNV_loh'
mclass[mclasscnvloh] = { label: 'LOH', color: '#12EDFC', dt: dtcnv, desc: 'Loss of heterozygosity', key: mclasscnvloh }

// for VCF
export const mclasssnv = 'snv'
mclass[mclasssnv] = {
	label: 'SNV',
	color: '#92a2d4',
	dt: dtsnvindel,
	desc: 'Single nucleotide variation',
	key: mclasssnv
}

export const mclassmnv = 'mnv'
mclass[mclassmnv] = {
	label: 'MNV',
	color: '#92a2d4',
	dt: dtsnvindel,
	desc: 'Multiple nucleotide variation',
	key: mclassmnv
}

export const mclassinsertion = 'insertion'
mclass[mclassinsertion] = {
	label: 'Sequence insertion',
	color: '#bd8e91',
	dt: dtsnvindel,
	desc: 'Sequence insertion',
	key: mclassinsertion
}

export const mclassdeletion = 'deletion'
mclass[mclassdeletion] = {
	label: 'Sequence deletion',
	color: '#b5a174',
	dt: dtsnvindel,
	desc: 'Sequence deletion',
	key: mclassdeletion
}
// TODO complex indel

export const dt2color = {
	[dtsnvindel]: mclass.M.color // general color for snvindel irrespective of class (when class is not available)
	// add new dt as needed
}

// option to override mutation class attribute values
export function applyOverrides(overrides = {}) {
	if (overrides.mclass) {
		for (const key in overrides.mclass) {
			// allow to fill-in mutation class that are missing from mclass;
			// may be useful for things like 'Not tested', etc, that may not be in mclass by default
			// but are used by a customer with its own PP server instance
			if (!mclass[key]) mclass[key] = {}
			for (const subkey in overrides.mclass[key]) {
				mclass[key][subkey] = overrides.mclass[key][subkey]
			}
		}
	}
}

export const vepinfo = function (s) {
	const l = s.toLowerCase().split(',')
	let rank = 1
	if (l.indexOf('transcript_ablation') != -1) {
		// FIXME no class for whole gene deletion
		return [dtdel, mclassdel, rank]
	}
	rank++
	if (l.indexOf('splice_acceptor_variant') != -1) return [dtsnvindel, 'L', rank]
	rank++
	if (l.indexOf('splice_donor_variant') != -1) return [dtsnvindel, 'L', rank]
	rank++
	if (l.indexOf('stop_gained') != -1) return [dtsnvindel, 'N', rank]
	rank++
	if (l.indexOf('frameshift_variant') != -1) return [dtsnvindel, 'F', rank]
	rank++
	if (l.indexOf('stop_lost') != -1) return [dtsnvindel, 'N', rank]
	rank++
	if (l.indexOf('start_lost') != -1) return [dtsnvindel, 'N', rank]
	rank++
	if (l.indexOf('transcript_amplification') != -1) {
		// FIXME no class for whole gene amp
		return [dtsnvindel, mclassnonstandard, rank]
	}
	rank++
	if (
		l.indexOf('inframe_insertion') != -1 ||
		l.indexOf('conservative_inframe_insertion') != -1 ||
		l.indexOf('disruptive_inframe_insertion') != -1
	)
		return [dtsnvindel, 'I', rank]
	rank++
	if (
		l.indexOf('inframe_deletion') != -1 ||
		l.indexOf('conservative_inframe_deletion') != -1 ||
		l.indexOf('disruptive_inframe_deletion') != -1
	)
		return [dtsnvindel, 'D', rank]
	rank++
	if (l.indexOf('missense_variant') != -1) return [dtsnvindel, 'M', rank]
	rank++
	if (l.indexOf('protein_altering_variant') != -1) return [dtsnvindel, 'ProteinAltering', rank]
	rank++
	if (l.indexOf('splice_region_variant') != -1) return [dtsnvindel, 'P', rank]
	rank++
	if (l.indexOf('incomplete_terminal_codon_variant') != -1) return [dtsnvindel, 'N', rank]
	rank++
	if (l.indexOf('stop_retained_variant') != -1) return [dtsnvindel, 'S', rank]
	rank++
	if (l.indexOf('synonymous_variant') != -1) return [dtsnvindel, 'S', rank]
	rank++
	if (l.indexOf('coding_sequence_variant') != -1) return [dtsnvindel, mclassnonstandard, rank]
	rank++
	if (l.indexOf('mature_mirna_variant') != -1) return [dtsnvindel, 'E', rank]
	rank++
	if (l.indexOf('5_prime_utr_variant') != -1) return [dtsnvindel, mclassutr5, rank]
	rank++
	if (l.indexOf('3_prime_utr_variant') != -1) return [dtsnvindel, mclassutr3, rank]
	rank++
	if (l.indexOf('non_coding_transcript_exon_variant') != -1) return [dtsnvindel, 'E', rank]
	rank++
	if (l.indexOf('intron_variant') != -1) return [dtsnvindel, 'Intron', rank]
	rank++
	if (l.indexOf('nmd_transcript_variant') != -1) return [dtsnvindel, 'S', rank]
	rank++
	if (l.indexOf('non_coding_transcript_variant') != -1) return [dtsnvindel, 'E', rank]
	rank++
	if (l.indexOf('upstream_gene_variant') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('downstream_gene_variant') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('tfbs_ablation') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('tfbs_amplification') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('tf_binding_site_variant') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('regulatory_region_ablation') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('regulatory_region_amplification') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('feature_elongation') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('regulatory_region_variant') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('feature_truncation') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	if (l.indexOf('intergenic_variant') != -1) return [dtsnvindel, mclassnoncoding, rank]
	rank++
	return [dtsnvindel, mclassnonstandard, rank]
}

// m orgin
export const germlinelegend =
	'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="#858585" stroke="none"></path>'

export const morigin = {}

export const moriginsomatic = 'S'
morigin[moriginsomatic] = {
	label: 'Somatic',
	desc: 'A variant found only in a tumor sample. The proportion is indicated by lack of any arc.',
	legend: '<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle>'
}
export const morigingermline = 'G'
morigin[morigingermline] = {
	label: 'Germline',
	desc: 'A constitutional variant found in a normal sample. The proportion is indicated by the span of the solid arc within the whole circle.',
	legend: germlinelegend
}

morigin.germline = morigin[morigingermline]
morigin.somatic = morigin[moriginsomatic]

export const moriginrelapse = 'R'
morigin[moriginrelapse] = {
	label: 'Relapse',
	desc: 'A somatic variant found only in a relapse sample. The proportion is indicated by the span of the hollow arc within the whole circle.',
	legend:
		'<circle cx="7" cy="12" r="7" fill="#b1b1b1"></circle><path d="M6.735557395310443e-16,-11A11,11 0 0,1 11,0L9,0A9,9 0 0,0 5.51091059616309e-16,-9Z" transform="translate(7,12)" fill="none" stroke="#858585"></path>'
}
export const morigingermlinepathogenic = 'GP'
morigin[morigingermlinepathogenic] = {
	label: 'Germline pathogenic',
	desc: 'A constitutional variant with pathogenic allele.',
	legend: germlinelegend
}
export const morigingermlinenonpathogenic = 'GNP'
morigin[morigingermlinenonpathogenic] = {
	label: 'Germline non-pathogenic',
	desc: 'A constitutional variant with non-pathogenic allele.',
	legend: germlinelegend,
	hidden: true
}

export const tkt = {
	usegm: 'usegm',
	ds: 'dataset',
	bigwig: 'bigwig',
	bigwigstranded: 'bigwigstranded',
	junction: 'junction',
	mdsjunction: 'mdsjunction',
	mdscnv: 'mdscnv',
	mdssvcnv: 'mdssvcnv', // no longer use as driver
	mdsexpressionrank: 'mdsexpressionrank',
	mdsvcf: 'mdsvcf', // for snv/indels, currently vcf, may include MAF
	//mdsgeneral:'mdsgeneral', // replaces mdssvcnv   ****** not ready yet
	bedj: 'bedj',
	pgv: 'profilegenevalue',
	bampile: 'bampile',
	hicstraw: 'hicstraw',
	expressionrank: 'expressionrank',
	aicheck: 'aicheck',
	ase: 'ase',
	mds2: 'mds2', // mds 2nd gen
	mds3: 'mds3', // 3rd gen
	bedgraphdot: 'bedgraphdot',
	bam: 'bam',
	ld: 'ld'
}

export function validtkt(what) {
	for (const k in tkt) {
		if (what == tkt[k]) {
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
export const mdsvcftype = {
	vcf: 'vcf'
}

/*
for custom mdssvcnv track
or general track
to avoid using hard-coded string
*/
export const custommdstktype = {
	vcf: 'vcf',
	svcnvitd: 'svcnvitd',
	geneexpression: 'geneexpression'
}

// codons that are not here are stop codon!!
export const codon = {
	GCT: 'A',
	GCC: 'A',
	GCA: 'A',
	GCG: 'A',
	CGT: 'R',
	CGC: 'R',
	CGA: 'R',
	CGG: 'R',
	AGA: 'R',
	AGG: 'R',
	AAT: 'N',
	AAC: 'N',
	GAT: 'D',
	GAC: 'D',
	TGT: 'C',
	TGC: 'C',
	CAA: 'Q',
	CAG: 'Q',
	GAA: 'E',
	GAG: 'E',
	GGT: 'G',
	GGC: 'G',
	GGA: 'G',
	GGG: 'G',
	CAT: 'H',
	CAC: 'H',
	ATT: 'I',
	ATC: 'I',
	ATA: 'I',
	TTA: 'L',
	TTG: 'L',
	CTT: 'L',
	CTC: 'L',
	CTA: 'L',
	CTG: 'L',
	AAA: 'K',
	AAG: 'K',
	ATG: 'M',
	TTT: 'F',
	TTC: 'F',
	CCT: 'P',
	CCC: 'P',
	CCA: 'P',
	CCG: 'P',
	TCT: 'S',
	TCC: 'S',
	TCA: 'S',
	TCG: 'S',
	AGT: 'S',
	AGC: 'S',
	ACT: 'T',
	ACC: 'T',
	ACA: 'T',
	ACG: 'T',
	TGG: 'W',
	TAT: 'Y',
	TAC: 'Y',
	GTT: 'V',
	GTC: 'V',
	GTA: 'V',
	GTG: 'V'
}

export const codon_stop = '*'

export function nt2aa(gm) {
	// must convert genome seq to upper case!!!
	if (!gm.genomicseq) return undefined
	const enlst = []
	if (gm.coding) {
		for (const [i, e] of gm.coding.entries()) {
			const s = gm.genomicseq.substr(e[0] - gm.start, e[1] - e[0])
			if (gm.strand == '-') {
				enlst.push(reversecompliment(s))
			} else {
				enlst.push(s)
			}
		}
	}
	const nt = enlst.join('')
	const pep = []

	/*
	if startCodonFrame is set, will not begin translation from first nt, but will skip 1 or 2 nt at the beginning
	in case of IGKC, frame=1 means it will borrow 1 nt from the previous IGKJ exons
	so the first two nucleotides from the current exon will have to be skipped when translating IGKC alone
	*/
	const startntidx = gm.startCodonFrame ? 3 - gm.startCodonFrame : 0
	for (let i = startntidx; i < nt.length; i += 3) {
		const a = codon[nt.substr(i, 3)]
		pep.push(a || codon_stop)
	}
	gm.cdseq = nt
	return pep.join('')
}

export function bplen(len, isfile) {
	// if "isfile" is true, to measure file size instead of basepair len
	if (len >= 1000000000) return (len / 1000000000).toFixed(1) + ' Gb'
	if (len >= 10000000) return Math.ceil(len / 1000000) + ' Mb'
	if (len >= 1000000) return (len / 1000000).toFixed(1) + ' Mb'
	if (len >= 10000) return Math.ceil(len / 1000) + ' Kb'
	if (len >= 1000) return (len / 1000).toFixed(1) + ' Kb'
	return len + (isfile ? 'bytes' : ' bp')
}

export const basecolor = {
	A: '#ca0020',
	T: '#f4a582',
	C: '#92c5de',
	G: '#0571b0'
}

export function basecompliment(nt) {
	switch (nt) {
		case 'A':
			return 'T'
		case 'T':
			return 'A'
		case 'C':
			return 'G'
		case 'G':
			return 'C'
		case 'a':
			return 't'
		case 't':
			return 'a'
		case 'c':
			return 'g'
		case 'g':
			return 'c'
		default:
			return nt
	}
}

export function reversecompliment(s) {
	const tmp = []
	for (let i = s.length - 1; i >= 0; i--) {
		tmp.push(basecompliment(s[i]))
	}
	return tmp.join('')
}

export function spliceeventchangegmexon(gm, evt) {
	/*
	alter gm.coding[], by exon-skip/alt events
	for frame checking
	gm must have coding
	*/
	const gm2 = {
		chr: gm.chr,
		start: gm.start,
		stop: gm.stop,
		strand: gm.strand,
		coding: []
	}
	if (evt.isskipexon || evt.isaltexon) {
		for (let i = 0; i < gm.exon.length; i++) {
			const codingstart = Math.max(gm.codingstart, gm.exon[i][0])
			const codingstop = Math.min(gm.codingstop, gm.exon[i][1])
			if (codingstart > codingstop) {
				// not coding exon
				continue
			}
			if (evt.skippedexon.indexOf(i) == -1) {
				// not skipped
				gm2.coding.push([codingstart, codingstop])
			} else {
				// skipped
			}
		}
	} else if (evt.a5ss || evt.a3ss) {
		// still equal number of exons
		// adjust the affected exon first, then figure out coding[]
		const exons = gm.exon.map(e => [e[0], e[1]])
		const forward = gm.strand == '+'
		if (evt.a5ss) {
			if (forward) {
				exons[evt.exon5idx][1] = evt.junctionB.start
			} else {
				exons[evt.exon5idx + 1][0] = evt.junctionB.stop
			}
		} else {
			if (forward) {
				exons[evt.exon5idx + 1][0] = evt.junctionB.stop
			} else {
				exons[evt.exon5idx][1] = evt.junctionB.start
			}
		}
		// from new exons, figure out coding exons
		for (const e of exons) {
			const codingstart = Math.max(gm.codingstart, e[0])
			const codingstop = Math.min(gm.codingstop, e[1])
			if (codingstart > codingstop) {
				// not coding exon
				continue
			}
			gm2.coding.push([codingstart, codingstop])
		}
	}
	return gm2
}

export function fasta2gmframecheck(gm, str) {
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
	const lines = str.split('\n')
	// remove fasta header
	lines.shift()
	gm.genomicseq = lines.join('').toUpperCase()

	const aaseq = nt2aa(gm)

	let thisframe = OUT_frame
	const stopcodonidx = aaseq.indexOf(codon_stop)
	if (stopcodonidx == aaseq.length - 1) {
		// the first appearance of stop codon is at the last of translation
		thisframe = IN_frame
	}
	return thisframe
}

export function validate_vcfinfofilter(obj) {
	/*
	validate vcfinfofilter as from embedding api or dataset
	*/

	if (!obj.lst) return '.lst missing'

	if (!Array.isArray(obj.lst)) return 'input is not an array'

	for (const set of obj.lst) {
		if (!set.name) return 'name missing from a set of .vcfinfofilter.lst'

		if (set.autocategory || set.categories) {
			// categorical info, auto or defined

			if (!set.autocategory) {
				for (const k in set.categories) {
					const v = set.categories[k]
					if (!set.autocolor && !v.color)
						return '.color missing for class ' + k + ' from .categories of set ' + set.name
					if (!v.label) {
						v.label = k
					}
				}
			}

			if (set.categoryhidden) {
				for (const k in set.categoryhidden) {
					if (!set.categories[k]) return 'unknown hidden-by-default category ' + k + ' from set ' + set.name
				}
			} else {
				set.categoryhidden = {}
			}
		} else if (set.numericfilter) {
			// otherwise, numerical value, the style of population frequency filter
			const lst = []
			for (const v of set.numericfilter) {
				if (typeof v == 'number') {
					/*
					just a number, defaults to 'lower-than'
					*/
					lst.push({ side: '<', value: v })
				} else {
					lst.push({
						side: v.side || '<',
						value: v.value
					})
				}
			}
			set.numericfilter = lst

			//return 'no .categories or .numericfilter from set '+set.name
		}

		if (set.altalleleinfo) {
			if (!set.altalleleinfo.key) {
				return '.key missing from .altalleleinfo from set ' + set.name
			}
		} else if (set.locusinfo) {
			if (!set.locusinfo.key) {
				return '.key missing from .locusinfo from set ' + set.name
			}
		} else {
			return 'neither .altalleleinfo or .locusinfo is available from set ' + set.name
		}
	}
}

export function contigNameNoChr(genome, chrlst) {
	/*
	FIXME hard-coded for human genome styled chromosome names
	*/
	for (const n in genome.majorchr) {
		if (chrlst.indexOf(n.replace('chr', '')) != -1) {
			return true
		}
	}
	if (genome.minorchr) {
		for (const n in genome.minorchr) {
			if (chrlst.indexOf(n.replace('chr', '')) != -1) {
				return true
			}
		}
	}
	return false
}
export function contigNameNoChr2(genome, chrlst) {
	// returns number of matching chr names that either includes "chr" or not
	// for detecting if chrlst entirely mismatch with what's in the genome build
	// TODO replace contigNameNoChr
	let nochrcount = 0,
		haschrcount = 0
	for (const n in genome.majorchr) {
		if (chrlst.includes(n)) {
			haschrcount++
		} else if (chrlst.includes(n.replace('chr', ''))) {
			nochrcount++
		}
	}
	if (genome.minorchr) {
		for (const n in genome.minorchr) {
			if (chrlst.includes(n)) {
				haschrcount++
			} else if (chrlst.includes(n.replace('chr', ''))) {
				nochrcount++
			}
		}
	}
	return [nochrcount, haschrcount]
}

export function getMax_byiqr(lst, novaluemax) {
	/*
	lst: array of numbers
	novaluemax: when lst is empty, return this value
	cutoff value based on IQR to exclude outlier values
	*/
	if (lst.length == 0) return novaluemax
	lst.sort((i, j) => i - j)
	const max = lst[lst.length - 1]
	if (lst.length <= 5) return max
	const q1 = lst[Math.floor(lst.length / 4)]
	const q2 = lst[Math.floor((lst.length * 3) / 4)]
	return Math.min(q2 + (q2 - q1) * 1.5, max)
}

export function alleleInGenotypeStr(genotype, allele) {
	if (!genotype) return false
	if (genotype.indexOf('/') != -1) {
		return genotype.split('/').indexOf(allele) != -1
	}
	return genotype.split('|').indexOf(allele) != -1
}

export const gmmode = {
	genomic: 'genomic',
	splicingrna: 'splicing RNA', // if just 1 exon, use "RNA" as label
	exononly: 'exon only',
	protein: 'protein',
	gmsum: 'aggregated exons'
}

/*
input:

m={}
	m.csq=[]
		element: {
			Allele: str,
			Consequence: str,
			CANONICAL: str, // true if _isoform is canonical
			...
			_isoform: str,
			_class: str,
			_csqrank: int
		}
	m.ann=[]
		annovar output. may be derelict
block={}
	block.usegm={ isoform }
	can be a mock object when running this function in node!

does:
	find an annotation from m.csq[] that's fitting the circumstance
	- current gm isoform displayed in block gene mode
	- any canonical isoform from m.csq[] (can be missing if vep is not instructed to do it)
	- one with highest _csqrank
	then, copy its class/mname to m{}
	has many fall-back and always try to assign class/mname

no return
*/
export function vcfcopymclass(m, block) {
	if (m.csq) {
		let useone // point to the element of m.csq[], from this class/mname is copied to m{}

		if (block.usegm) {
			// block is in gm mode, find a csq matching with the genemodel isoform
			useone = m.csq.find(i => i._isoform == block.usegm.isoform)
		}

		if (!useone) {
			// no match to usegm isoform; can be due to in genomic mode and zoomed out, where this variant is from a neighboring gene near block.usegm
			// find one using canonical isoform
			useone = m.csq.find(i => i.CANONICAL)

			if (!useone) {
				// none of the elements in m.csq[] is using a canonical isoform, as that's a vep optional output
				// last method: choose *colorful* annotation based on if is canonical, _csqrank
				useone = m.csq[0]
				for (const q of m.csq) {
					if (q._csqrank < useone._csqrank) {
						useone = q
					}
				}
			}
		}

		if (useone) {
			m.gene = useone._gene
			m.isoform = useone._isoform
			m.class = useone._class
			m.dt = useone._dt
			m.mname = useone._mname

			if (m.class == mclassnoncoding) {
				// noncoding converted from csq is not a meaningful, drab color, has no mname label, delete so later will be converted to non-protein class
				delete m.class
			}
		}
	} else if (m.ann) {
		// there could be many applicable annotations, the first one not always desirable
		// choose *colorful* annotation based on _csqrank
		let useone = null
		if (block.usegm) {
			for (const q of m.ann) {
				if (q._isoform != block.usegm.isoform) continue
				if (useone) {
					if (q._csqrank < useone._csqrank) {
						useone = q
					}
				} else {
					useone = q
				}
			}
			if (!useone && block.gmmode == gmmode.genomic) {
				// no match to this gene, but in genomic mode, maybe from other genes?
				useone = m.ann[0]
			}
		} else {
			useone = m.ann[0]
			for (const q of m.ann) {
				if (q._csqrank < useone._csqrank) {
					useone = q
				}
			}
		}
		if (useone) {
			m.gene = useone._gene
			m.isoform = useone._isoform
			m.class = useone._class
			m.dt = useone._dt
			m.mname = useone._mname

			if (m.class == mclassnoncoding) {
				delete m.class
			}
		}
	}

	if (m.class == undefined) {
		// infer class from m.type, which was assigned by vcf.js
		if (mclass[m.type]) {
			m.class = m.type
			m.dt = mclass[m.type].dt
			m.mname = m.id && m.id != '.' ? m.id : m.ref + '>' + m.alt
			if (m.mname.length > 15) {
				// avoid long indel
				m.mname = m.type
			}
		} else {
			m.class = mclassnonstandard
			m.dt = dtsnvindel
			m.mname = m.type
		}
	}

	delete m.type
}

/*
used in:
	mdssvcnv track, mutation attributes, items that are not annotated by an attribute for showing in legend, and server-side filtering
*/
export const not_annotated = 'Unannotated'

// kernal density estimator as from https://www.d3-graph-gallery.com/graph/density_basic.html

export function kernelDensityEstimator(kernel, X) {
	return function (V) {
		return X.map(x => {
			return [x, V.map(v => kernel(x - v)).reduce((i, j) => i + j, 0) / V.length]
		})
	}
}

export function kernelEpanechnikov(k) {
	return function (v) {
		return Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0
	}
}

export const schemeCategory20 = [
	'#1f77b4',
	'#aec7e8',
	'#ff7f0e',
	'#ffbb78',
	'#2ca02c',
	'#98df8a',
	'#d62728',
	'#ff9896',
	'#9467bd',
	'#c5b0d5',
	'#8c564b',
	'#c49c94',
	'#e377c2',
	'#f7b6d2',
	'#7f7f7f',
	'#c7c7c7',
	'#bcbd22',
	'#dbdb8d',
	'#17becf',
	'#9edae5'
]
export const schemeCategory2 = ['#e75480', 'blue']

export function getColorScheme(number) {
	if (number > 20) {
		const scheme = []
		for (let i = 0; i < number; i++) scheme.push(d3.interpolateRainbow(i / number))
		return scheme
	}
	if (number > 12) return schemeCategory20
	else if (number > 8) return d3.schemePaired
	else if (number > 2) return d3.schemeDark2
	else return schemeCategory2
}
export function getColors(number) {
	const scheme = getColorScheme(number)
	return d3scale.scaleOrdinal(scheme)
}

export const truncatingMutations = ['F', 'N', 'L', 'P']
export const proteinChangingMutations = ['F', 'N', 'L', 'P', 'D', 'I', 'ProteinAltering', 'M']
export const synonymousMutations = ['S', 'Intron', 'Utr3', 'Utr5', 'noncoding', 'E']
export const mutationClasses = Object.values(mclass)
	.filter(m => m.dt == dtsnvindel)
	.map(m => m.key)
export const CNVClasses = Object.values(mclass)
	.filter(m => m.dt == dtcnv)
	.map(m => m.key)

/*
Term groupsetting used for geneVariant term
NOTE: for each groupsetting, groups[] is ordered by priority
for example: in the 'Protein-changing vs. rest' groupsetting, the
'Protein-changing' group is listed first in groups[] so that samples
that have both missense and silent mutations are classified in the
'Protein-changing' group
*/

export const geneVariantTermGroupsetting = {
	disabled: false, // as const, // TODO: may need to add is when converting common.js to .ts
	type: 'custom',
	lst: [
		{
			// SNV/indel groupsetting
			name: 'Mutated vs. wildtype',
			groups: [
				{
					type: 'values', // as const, // TODO: may need to add is when converting common.js to .ts
					name: 'Mutated',
					values: mutationClasses
						.filter(key => key != 'WT' && key != 'Blank')
						.map(key => {
							return { key, label: mclass[key].label }
						})
				},
				{
					type: 'values',
					name: 'Wildtype',
					values: [{ key: 'WT', label: 'Wildtype' }]
				},
				{
					type: 'values',
					name: 'Not tested',
					values: [{ key: 'Blank', label: 'Not tested' }],
					uncomputable: true
				}
			]
		},
		// SNV/indel groupsetting
		{
			name: 'Protein-changing vs. rest',
			groups: [
				{
					type: 'values',
					name: 'Protein-changing',
					values: proteinChangingMutations.map(key => {
						return { key, label: mclass[key].label }
					})
				},
				{
					type: 'values',
					name: 'Rest',
					values: Object.keys(mclass)
						.filter(key => !proteinChangingMutations.includes(key) && key != 'Blank')
						.map(key => {
							return { key, label: mclass[key].label }
						})
				},
				{
					type: 'values',
					name: 'Not tested',
					values: [{ key: 'Blank', label: 'Not tested' }],
					uncomputable: true
				}
			]
		},
		// SNV/indel groupsetting
		{
			name: 'Truncating vs. rest',
			groups: [
				{
					type: 'values',
					name: 'Truncating',
					values: truncatingMutations.map(key => {
						return { key, label: mclass[key].label }
					})
				},
				{
					type: 'values',
					name: 'Rest',
					values: Object.keys(mclass)
						.filter(key => !truncatingMutations.includes(key) && key != 'Blank')
						.map(key => {
							return { key, label: mclass[key].label }
						})
				},
				{
					type: 'values',
					name: 'Not tested',
					values: [{ key: 'Blank', label: 'Not tested' }],
					uncomputable: true
				}
			]
		},
		// CNV groupsetting
		{
			name: 'Gain vs. Loss vs. LOH vs. Wildtype',
			groups: [
				{
					type: 'values',
					name: 'Copy number gain',
					values: [{ key: 'CNV_amp', label: mclass['CNV_amp'].label }]
				},
				{
					type: 'values',
					name: 'Copy number loss',
					values: [{ key: 'CNV_loss', label: mclass['CNV_loss'].label }]
				},
				{
					type: 'values',
					name: 'LOH',
					values: [{ key: 'CNV_loh', label: mclass['CNV_loh'].label }]
				},
				{
					type: 'values',
					name: 'Wildtype',
					values: [{ key: 'WT', label: 'Wildtype' }]
				},
				{
					type: 'values',
					name: 'Not tested',
					values: [{ key: 'Blank', label: 'Not tested' }],
					uncomputable: true
				}
			]
		},
		// SV fusion groupsetting
		{
			name: 'Fusion vs. Wildtype',
			groups: [
				{
					type: 'values',
					name: 'Fusion transcript',
					values: [{ key: 'Fuserna', label: mclass['Fuserna'].label }]
				},
				{
					type: 'values',
					name: 'Wildtype',
					values: [{ key: 'WT', label: 'Wildtype' }]
				},
				{
					type: 'values',
					name: 'Not tested',
					values: [{ key: 'Blank', label: 'Not tested' }],
					uncomputable: true
				}
			]
		}
	]
}

export const colorScaleMap = {
	blueWhiteRed: { domain: [0, 0.5, 1], range: ['blue', 'white', 'red'] },
	greenWhiteRed: { domain: [0, 0.5, 1], range: ['green', 'white', 'red'] },
	blueYellowRed: {
		domain: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
		range: ['#313695', '#649AC7', '#BCE1ED', '#FFFFBF', '#FDBE70', '#EA5839', '#A50026']
	},
	greenBlackRed: {
		domain: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
		range: ['#00FF00', '#14E10C', '#1AAF10', '#000000', '#B01205', '#E20E03', '#FF0000']
	},
	blueBlackYellow: {
		domain: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
		range: ['#0000FF', '#0000CC', '#000099', '#202020', '#999900', '#CCCC00', '#FFFF00']
	}
}
