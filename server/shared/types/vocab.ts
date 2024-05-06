import { Term, TermWrapper } from './terms/tw.ts'
import { Filter } from './filter.ts'
import { UseCase } from './termsetting.ts'

/*
--------EXPORTED--------
VocabApi

*/

//type QLst = [Partial<{ nextReuseId?: string }>, ...Q[]]

export type VocabApi = {
	termdbConfig: any
	//Methods
	cacheTermQ: (term: Term, q: any) => any
	findTerm: (f: string, activeCohort: number, usecase: UseCase, x: string) => { lst: Term[] }
	getCategories: (term: Term, filer: Filter, body?: any) => any
	getCustomTermQLst: (f: Term) => any
	getPercentile: (term_id: string | number, percentile_lst: number[], filter?: Filter) => any
	getterm: (f: any) => Term
	getTerms: (f: any) => any
	getTermdbConfig: () => any
	getViolinPlotData: (args: any, _body?: any) => any
	getAnnotatedSampleData: (args: any) => any
	getDefaultGeneExpBins: (args: any) => any
	getTwMinCopy(tw: TermWrapper): any
	uncacheTermQ: (term: Term, q: any) => any
	hasVerifiedToken: () => boolean
	tokenVerificationMessage: string
	tokenVerificationPayload?: {
		error?: string
		linkKey?: string
	}
}
