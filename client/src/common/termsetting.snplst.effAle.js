export function get_effectAllele(alleleType, snp) {
	/*
	code is duplicated between 
	q is self.q
	snp: { effectAllele, alleles[ {allele, count, isRef} ] }
	*/
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
