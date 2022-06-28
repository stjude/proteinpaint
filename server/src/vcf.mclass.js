const { dissect_INFO } = require('../shared/vcf.info')
const { parse_CSQ } = require('../shared/vcf.csq')
const { getVariantType } = require('../shared/vcf.type')
const { vcfcopymclass } = require('../shared/common')

/*
do not anticipate to share this function with client

assign mclass/mname to variant, stored at term.snps[] on client
for displaying in mds3 tk
since a variant can have multiple alt alleles, compute csq for each alt allele
and attach variant.alt2csq{ altAllele : {class,mname,dt} }
rather than directly attach class/mname/dt to variant{}
client side will later call getCategories() with allele type (major/ref) criteria for deciding effect allele
which is not done here
once effect allele is decided for each variant,
refer to .alt2csq{} to find the class/mname based on effect allele choice
(if eff ale is reference allele?)

parameters:
tk={}
	supply info.CSQ.csqheader
refAlllele=str
	the reference allele from this vcf line
altAlleles=[]
	array of alt alleles from this vcf line
variant={}
	object to push to snps[] array and return to client
	variant.csq{} will be created
info_str=str
	info field from this vcf line
ID=str
	ID field of this vcf line
isoform=str
	optional, the isoform currently viewed on client gmmode,
	if provided, will retrieve corresponding aachange from csq
	if not, will return aachange for a random isoform
*/
export function compute_mclass(tk, refAllele, altAlleles, variant, info_str, ID, isoform) {
	const info = dissect_INFO(info_str)
	if (!info.CSQ) {
		// missing csq
		return
	}

	const m = {
		alleles: altAlleles.map(i => {
			return {
				allele_original: i,
				ref: refAllele,
				alt: i,
				id: ID,
				type: getVariantType(refAllele, i)
			}
		})
	}

	parse_CSQ(info.CSQ, tk.info.CSQ.csqheader, m)
	// .csq{} is added to each of m.alleles[]

	variant.alt2csq = {}

	const block = {}
	if (isoform) block.usegm = { isoform } // allow to find aachange matching given isform from csq

	for (const a of m.alleles) {
		vcfcopymclass(a, block)
		// gene/isoform/class/dt/mname are assigned on a
		if (!a.mname) {
			if (ID != '.') {
				// value should be rsID
				a.mname = ID
			} else {
				a.mname = variant.pos + ':' + refAllele + '>' + a.allele_original
			}
		}
		delete a.csq
		variant.alt2csq[a.allele_original] = a
	}
}
