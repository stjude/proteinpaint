import { TermWrapper } from './termdb'
import { CategoricalConditionQ } from './categorical'

/*
--------EXPORTED--------
CategoricalTW

*/

export type ConditionalTW = TermWrapper & {
	q: CategoricalConditionQ
}
