import { vepinfo } from './common.js'
/*
parse csq field from a variant line, not header
CSQ header must have already been parsed

str: the csq value for a vcf line
header: [ // something like this
  { name: 'Allele' },
  { name: 'Consequence' },
  { name: 'IMPACT' },
  { name: 'SYMBOL' },
  { name: 'Gene' },
  { name: 'Feature_type' },
  { name: 'Feature' },
  { name: 'BIOTYPE' },
  { name: 'EXON' },
  { name: 'INTRON' },
  { name: 'HGVSc' },
  { name: 'HGVSp' },
  { name: 'cDNA_position' },
  { name: 'CDS_position' },
  { name: 'Protein_position' },
  { name: 'Amino_acids' },
  { name: 'Codons' },
  { name: 'Existing_variation' },
  { name: 'DISTANCE' },
  { name: 'STRAND' },
  { name: 'FLAGS' },
  { name: 'SYMBOL_SOURCE' },
  { name: 'HGNC_ID' },
  { name: 'CANONICAL' },
  { name: 'REFSEQ_MATCH' },
  { name: 'GIVEN_REF' },
  { name: 'USED_REF' },
  { name: 'BAM_EDIT' },
  { name: 'HGVS_OFFSET' },
  { name: 'CLIN_SIG' },
  { name: 'SOMATIC' },
  { name: 'PHENO' }
]

m: {
	mlst[ {} ]
		.allele_original
		.csq[ {} ] // parse_CSQ will add this array to this allele
			._class
			._csqrank
			._dt
			._gene
			._isoform
			._mname
}

*/

export function parse_CSQ(str, header, m) {
	if (!header) {
		return null
	}
	for (const thisannotation of str.split(',')) {
		const lst = thisannotation.replace(/&/g, ',').split('|')

		const o = {}

		for (let i = 0; i < header.length; i++) {
			if (lst[i]) {
				o[header[i].name] = lst[i]
			}
		}
		if (!o.Allele) {
			continue
		}
		let allele = null

		//////////////////////////////////////
		// NOTE
		// mds2delete
		// m.alleles[] is based on old vcf parsing and may delete?
		// latest spec is m.mlst[]
		//////////////////////////////////////

		for (const a of m.mlst || m.alleles) {
			if (a.allele_original == o.Allele) {
				allele = a
				break
			}
		}
		if (!allele) {
			if (o.Allele == '-') {
				// deletion
				if (m.mlst) {
					if (m.mlst.length == 1) {
						allele = m.mlst[0]
					}
				} else if (m.alleles) {
					if (m.alleles.length == 1) {
						allele = m.alleles[0]
					}
				}
			} else {
				for (const a of m.mlst || m.alleles) {
					if (a.allele_original.substr(1) == o.Allele) {
						// insertion, without first padding base
						allele = a
						break
					}
				}
			}
			if (!allele) {
				// cannot match to allele!!!
				continue
			}
		}
		if (!allele.csq) {
			allele.csq = []
		}
		allele.csq.push(o)

		// gene
		o._gene = o.SYMBOL || o.Gene

		// isoform
		if (o.Feature_type && o.Feature_type == 'Transcript') {
			o._isoform = o.Feature.split('.')[0] // remove version
		} else {
			o._isoform = o._gene
		}

		// class
		if (o.Consequence) {
			const [dt, cls, rank] = vepinfo(o.Consequence)
			o._dt = dt
			o._class = cls
			o._csqrank = rank
		} else {
			// FIXME
			o._dt = dtsnvindel
			o._class = mclassnonstandard
		}
		// mname
		if (o.HGVSp) {
			o._mname = decodeURIComponent(o.HGVSp.substr(o.HGVSp.indexOf(':') + 1))
		} else if (o.Protein_position && o.Amino_acids) {
			o._mname = decodeURIComponent(o.Protein_position + o.Amino_acids)
		} else if (o.HGVSc) {
			o._mname = o.HGVSc.substr(o.HGVSc.indexOf(':') + 1)
		} else if (o.Existing_variation) {
			o._name = o.Existing_variation
		} else {
		}
	}
	return true
}
