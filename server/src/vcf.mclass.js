import { dissect_INFO } from '#shared/vcf.info'
import { parse_CSQ } from '#shared/vcf.csq'
import { getVariantType } from '#shared/vcf.type'
import { vcfcopymclass } from '#shared/common'

/*
do not anticipate to share this function with client

assign mclass/mname to variant, stored at term.snps[] on client
for displaying in mds3 tk
since a variant can have multiple alt alleles, compute csq for each alt allele
and attach variant.mlst[ {class,mname,dt,alt,...},  ... ]
rather than directly attach class/mname/dt to variant{}
client side will later call getCategories() with allele type (major/ref) criteria for deciding effect allele
which is not done here
once effect allele is decided for each variant,
refer to .mlst[] to find the class/mname based on effect allele choice
(if eff ale is reference allele?)

parameters:

tk={}
	.info{}
		each key is an INFO field key
		value is {
			ID:<same key>
			Number: A/R/G/.
				"A" for value per-alt allele
			Type: Integer/Float/Flag/Character/String
			Description
		}
		for CSQ, it has csqheader[]

refAlllele=str
	the reference allele from this vcf line

altAlleles=[]
	array of alt alleles from this vcf line

variant={}
	pos: int
	following are attached by this function
	.info{}
	.mlst[]
		each element is one m with one ALT allele
		m = {pos:int, alt:str, ref:str}

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
	// object of key-value pairs. key is INFO key, value is string

	// refine info values of this variant
	for (const key in tk.info) {
		if (tk.info[key].Number == 'A' && key in info) {
			// convert info[key] to array of values, by the order of altAlleles
			info[key] = info[key].split(',')
		}

		if (tk.info[key].separator && key in info) {
			// this field uses a special separator, e.g. "|" for CLNSIG
			// convert value of info[key] into array
			const lst = info[key].split(tk.info[key].separator)
			if (lst.length > 1) {
				info[key] = lst
			}
		}

		if (tk.info[key].Type == 'Float' || tk.info[key].Type == 'Integer') {
			if (Array.isArray(info[key])) {
				const t = info[key].map(Number)
				info[key] = t
			} else {
				info[key] = Number(info[key])
			}
		}
	}

	variant.mlst = altAlleles.map(i => {
		const [_p, _r, _a] = correctRefAlt(variant.pos, refAllele, i)
		const m = {
			allele_original: i,
			ref: _r,
			alt: _a,
			pos: _p,
			type: getVariantType(_r, _a)
		}
		if (ID && ID != '.') m.vcf_id = ID
		return m
	})

	if (tk.info?.CSQ && info.CSQ) {
		// tk has CSQ control info, and this variant has CSQ annotation, parse to per-alt
		parse_CSQ(info.CSQ, tk.info.CSQ.csqheader, variant)
		// .csq{} is added to each of variant.mlst[]
	}

	const block = {}
	if (isoform) block.usegm = { isoform } // allow to find aachange matching given isform from csq

	for (const [idx, a] of variant.mlst.entries()) {
		vcfcopymclass(a, block)
		delete a.csq

		// gene/isoform/class/dt/mname are assigned on a

		if (!a.mname) {
			// fallback when a.csq{} is missing (vcf is not csq-annotated)
			if (ID != '.') {
				// value should be rsID
				a.mname = ID
			} else {
				a.mname = variant.pos + ':' + refAllele + '>' + a.allele_original
			}
		}

		a.altAlleleIdx = idx + 1 // for matching with GT

		// copy INFO from variant.info{} to a.info{}
		// for info.Number=='A', only copy
		a.info = {}
		for (const key in info) {
			if (tk.info?.[key]?.Number == 'A') {
				a.info[key] = info[key][idx]
			} else {
				a.info[key] = info[key]
			}
		}
	}
}

function correctRefAlt(p, ref, alt) {
	// for oligos, always trim the last identical base
	while (ref.length > 1 && alt.length > 1 && ref[ref.length - 1] == alt[alt.length - 1]) {
		ref = ref.substring(0, ref.length - 1)
		alt = alt.substring(0, alt.length - 1)
	}
	// move position up as long as first positions are equal
	while (ref.length > 1 && alt.length > 1 && ref[0] == alt[0]) {
		ref = ref.substring(1)
		alt = alt.substring(1)
		p++
	}
	return [p, ref, alt]
}
