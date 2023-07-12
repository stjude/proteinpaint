import { TermWrapper } from './termdb'
import { CategoricalConditionQ } from './categorical'

/*
--------EXPORTED--------
CategoricalConditionQ
CategoricalTW

*/

export type ConditionalTW = TermWrapper & {
	q: CategoricalConditionQ
}
