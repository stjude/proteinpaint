/*
if the "effect allele" is already set for a snp (by user), return it
otherwise, compute it based on the alleleType setting (from snplst q{})

snp: { effectAllele, alleles[ {allele, count, isRef} ] }
*/
export function get_effectAllele(alleleType, snp) {
	if (snp.effectAllele) {
		// already selected by user
		return snp.effectAllele
	}
	if (alleleType == 0) {
		// major/minor
		// find the allele with smallest count
		let a = snp.alleles[0]
		for (let i = 1; i < snp.alleles.length; i++) {
			const b = snp.alleles[i]
			if (b.count < a.count) {
				a = b
			}
		}
		return a.allele
	}
	if (alleleType == 1) {
		// non-reference, what if there are multiple??
		return snp.alleles.find(i => !i.isRef).allele
	}
	throw 'unknown alleleType value'
}

export function get_refGenotype(alleleType, geneticModel, snp) {
	if (geneticModel !== 3) return
	if (alleleType == 0) {
		// major/minor
		// find the allele with biggest count
		const major_al = snp.alleles.reduce((a, b) => (a.count > b.count ? a : b)).allele
		const ref_gt = major_al + ',' + major_al
		return ref_gt
	}
	if (alleleType == 1) {
		// ref/alt
		// find the ref allele
		const ref_al = snp.alleles.find(i => i.isRef).allele
		const ref_gt = ref_al + ',' + ref_al
		return ref_gt
	}
}
