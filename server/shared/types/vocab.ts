import { Term, Q } from './termdb'
import { Filter } from './filter'
import { UseCase } from './termsetting'

/*
--------EXPORTED--------
VocabApi

*/

//type QLst = [Partial<{ nextReuseId?: string }>, ...Q[]]

export interface VocabApi {
	termdbConfig: any
	//Methods
	cacheTermQ: (term: Term, q: Q) => any
	findTerm: (f: string, activeCohort: number, usecase: UseCase, x: string) => { lst: Term[] }
	getCustomTermQLst: (f: Term) => any
	getPercentile: (term_id: string | number, percentile_lst: number[], filter: Filter) => number[]
	getterm: (f: any) => Term
	getViolinPlotData: (f: any) => void
	uncacheTermQ: (term: Term, q: Q) => any
}
