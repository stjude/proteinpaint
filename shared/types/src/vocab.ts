import type { TermWrapper } from './terms/tw.ts'
import type { Term } from './terms/term.ts'
import type { Filter } from './filter.ts'
import type { UseCase } from './termsetting.ts'

/*
--------EXPORTED--------
VocabApi

*/

//type QLst = [Partial<{ nextReuseId?: string }>, ...Q[]]

export type VocabApi = {
	termdbConfig: any
	state?: any
	//Methods
	cacheTermQ: (term: Term, q: any) => any
	findTerm: (f: string, activeCohort: number, usecase: UseCase, x: string) => { lst: Term[] }
	getCategories: (term: Term, filter?: Filter, body?: any) => any
	getCustomTermQLst: (f: Term) => any
	getPercentile: (term: Term, percentile_lst: number[], termfilter?) => any
	getterm: (f: any) => Term
	getTerms: (f: any) => any
	getTermdbConfig: () => any
	getViolinPlotData: (args: any, _body?: any) => any
	getAnnotatedSampleData: (args: any) => any
	getDefaultBins: (args: any) => any
	setTermBins(tw: TermWrapper): any
	getTwMinCopy(tw: TermWrapper): any
	uncacheTermQ: (term: Term, q: any) => any
	hasVerifiedToken: () => boolean
	tokenVerificationMessage: string
	tokenVerificationPayload?: {
		error?: string
		linkKey?: string
	}
}
