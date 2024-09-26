import { SnpsTW } from '#types'

/*
if the "effect allele" is already set for a snp (by user), return it
otherwise, compute it based on the alleleType setting (from termwrapper.q{})

snp: { effectAllele, alleles[ {allele, count, isRef} ] }
*/
function get_effectAllele(alleleType: any, snp: any) {
	let effectAllele: any
	if (snp.effectAllele) return snp.effectAllele // already selected by user
	if (alleleType == 0) {
		// minor allele(s)
		// if multiple minor alleles, then choose most frequent
		const majorAlleleCount = Math.max(...snp.alleles.map(al => al.count))
		const otherAlleles = snp.alleles.filter(i => i.count != majorAlleleCount)
		if (otherAlleles.length) {
			const maxOtherAlleleCount = Math.max(...otherAlleles.map(al => al.count))
			effectAllele = otherAlleles.find(al => al.count == maxOtherAlleleCount).allele
		} else {
			// variant has no minor alleles
			effectAllele = undefined
		}
	} else if (alleleType == 1) {
		// alternative allele(s)
		// if multiple alternative alleles, then choose most frequent
		const altals = snp.alleles.filter(i => !i.isRef)
		if (altals.length) {
			const maxcnt = Math.max(...altals.map(al => al.count))
			effectAllele = altals.find(al => al.count === maxcnt).allele
		} else {
			// variant has no alternative alleles
			effectAllele = undefined
		}
	} else if (alleleType == 2) {
		// custom
		// let user select effect allele
		effectAllele = undefined
	} else {
		throw 'unknown alleleType value'
	}
	snp.effectAllele = effectAllele
	return effectAllele
}

/*
tw: {term{ snps[] }, q{}}
data: returned by vocab getCategories()
	such data includes sample and allele summaries for snps based on current filter
	copy these info to tw.snps

this function will alter tw,
the changes must be kept in sync between termsetting instance and app state
*/
export function mayRunSnplstTask(tw: SnpsTW, data: any) {
	if (tw.term.type != 'snplst' && tw.term.type != 'snplocus') return // this func may be called on different terms, skip in that case
	if (data.error) throw data.error
	if (!Array.isArray(data.snps)) throw 'data.snps[] not array'
	// note!! tw is modified here and is not written to state, but should be fine

	// delete existing sample summaries from snps, in case when a snp is no longer found in latest cohort due to filtering
	if (!tw.term.snps) throw `Missing tw.term.snps [snplst.sampleSum.ts mayRunSnplstTask()]`
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
