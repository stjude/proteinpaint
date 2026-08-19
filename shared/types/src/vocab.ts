import type { TermWrapper } from './terms/tw.ts'
import type { Term } from './terms/term.ts'
import type { Filter } from './filter.ts'
import type { UseCase } from './termsetting.ts'

/*
--------EXPORTED--------
VocabApi

*/

export type VocabApi = {
	termdbConfig: any
	state?: any
	//Methods
	findTerm: (f: string, activeCohort: number, usecase: UseCase, x: string) => { lst: Term[] }
	getCategories: (term: Term, filter?: Filter, body?: any) => any
	/** settings remembered for the gene(s) of a geneVariant term, most recent first */
	getGvQLst: (term: Term) => { label: string; q: any }[]
	/** remember a geneVariant setting the user built; a no-op outside a mass app */
	rememberGvQ?: (term: Term, q: any) => void
	getPercentile: (term: Term, percentile_lst: number[], termfilter?) => any
	getterm: (f: any) => Term
	getTerms: (f: any) => any
	getTermdbConfig: () => any
	getAnnotatedSampleData: (args: any) => any
	getDefaultBins: (args: any) => any
	setTermBins(tw: TermWrapper): any
	getTwMinCopy(tw: TermWrapper): any
	hasVerifiedToken: () => boolean
	tokenVerificationMessage: string
	tokenVerificationPayload?: {
		error?: string
		linkKey?: string
	}
}
