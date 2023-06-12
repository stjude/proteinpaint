import { Term } from './termdb'

export interface VocabApi {
    getterm: (f: any) => Term
}