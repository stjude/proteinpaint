import { mclassdeletion, mclasssnv, mclassmnv, mclassinsertion, mclassnonstandard } from './common.js'

export function getVariantType(ref, alt) {
	if (ref.length == 1 && alt.length == 1) {
		// both alleles length of 1
		if (alt == '.') {
			// alt is missing
			return mclassdeletion
		}
		// snv
		return mclasssnv
	}
	if (ref.length == alt.length) return mclassmnv
	// FIXME only when empty length of one allele
	if (ref.length < alt.length) return mclassinsertion
	if (ref.length > alt.length) return mclassdeletion
	return mclassnonstandard
}
