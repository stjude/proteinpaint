/*
if the "effect allele" is already set for a snp (by user), return it
otherwise, compute it based on the alleleType setting (from termwrapper.q{})

snp: { effectAllele, alleles[ {allele, count, isRef} ] }
*/
function get_effectAllele(alleleType, snp) {
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

/*
tw: {term{ snps[] }, q{}}
data: returned by vocab getCategories()
	such data includes sample and allele summaries for snps based on current filter
	copy these info to tw.snps

this function will alter tw,
the changes must be kept in sync between termsetting instance and app state
*/
export function mayRunSnplstTask(tw, data) {
	if (tw.term.type != 'snplst' && tw.term.type != 'snplocus') return
	if (!Array.isArray(data.snps)) throw 'data.snps[] not array'
	// note!! tw is modified here and is not written to state, but should be fine

	// delete existing sample summaries from snps, in case when a snp is no longer found in latest cohort due to filtering
	for (const s of tw.term.snps) {
		delete s.alleles
		delete s.gt2count
	}

	// clear old settings
	tw.q.snp2effAle = {}

	// copy latest sample summaries to tw.term.snps[]
	for (const s of data.snps) {
		// { snpid, alleles, gt2count }
		// if this snp does not have valid content for alleles and gt2count, then it will not be computable
		const snp = tw.term.snps.find(i => i.snpid == s.snpid)
		if (!snp) throw 'snp not found by id'
		snp.alleles = s.alleles
		snp.gt2count = s.gt2count
		tw.q.snp2effAle[snp.snpid] = get_effectAllele(tw.q.alleleType, snp)
	}

	tw.q.numOfSampleWithAnyValidGT = data.numOfSampleWithAnyValidGT

	// if genetic model choice is "by genotype", need to assign refGrp to each snp
	// create q.snp2refGrp{}
	if (tw.q.geneticModel == 3) {
		tw.q.snp2refGrp = {}
		for (const s of tw.term.snps) {
			if (s.invalid || !s.gt2count) continue
			// FIXME "invalid" flag is missing for things supposed to be invalid

			const effectAllele = tw.q.snp2effAle[s.snpid]
			// from gt2count, find the gt that does not contain effect allele as ref group
			let refGT
			for (const gt in s.gt2count) {
				if (!gt.includes(effectAllele)) {
					refGT = gt
					break
				}
			}
			if (!refGT) {
				// no gt that doesn't contain effect allele
				// FIXME quick fix to use a RANDOM gt so it won't break
				refGT = Object.keys(s.gt2count)[0]
			}
			tw.q.snp2refGrp[s.snpid] = refGT
		}
	} else {
		delete tw.q.snp2refGrp
	}
}
