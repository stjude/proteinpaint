import { TermWrapper } from '../termdb'
import { CategoricalConditionQ } from '../terms/categorical'

/*
--------EXPORTED--------
CategoricalTW

*/

export type ConditionalTW = TermWrapper & {
	q: CategoricalConditionQ
}
