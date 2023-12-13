import { Term } from './terms/tw'
import { Filter } from './filter'
import { UseCase } from './termsetting'

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
	getViolinPlotData: (f: any, params: any) => void
	uncacheTermQ: (term: Term, q: any) => any
}
