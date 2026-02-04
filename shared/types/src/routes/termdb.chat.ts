import type { Filter } from '../filter.ts'
import type { RoutePayload } from './routeApi.js'

/** */
export type ChatRequest = {
	genome: string
	dslabel: string
	filter?: Filter
	/** user prompt */
	prompt: string
	__protected__?: any
}

type HtmlResponse = {
	type: 'html'
	/** for display only */
	html: string
}
export type PlotResponse = {
	type: 'plot'
	/** plot state. Currently only supports summary chart, will add other chart types later */
	plot: object
	/** Specifies what action to take e.g. Summary plot or no action. Will add more chart types later */
}

export type ChatResponse = HtmlResponse | PlotResponse

export const ChatPayload: RoutePayload = {
	request: {
		typeId: 'ChatRequest'
	},
	response: {
		typeId: 'ChatResponse'
	}
	//examples: []
}

export type SummaryType = {
	/** Name of 1st term */
	term: string
	/** Name of 2nd term */
	term2?: string
	/** Optional simple filter terms */
	simpleFilter: FilterTerm[]
}

export type FilterTerm =
	| CategoricalFilterTerm
	| NumericFilterTerm /** FilterTerm can either be numeric or categorical  */

export type CategoricalFilterTerm = {
	/** Name of categorical term */
	term: string
	/** The category of the term */
	category: string
	/** join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term */
	join?: 'and' | 'or'
}

export type NumericFilterTerm = {
	/** Name of numeric term */
	term: string
	/** start position (or lower limit) of numeric term */
	start?: number
	/** stop position (or upper limit) of numeric term */
	stop?: number
	/** join term to be used only when there is more than one filter term and should be placed from the 2nd filter term onwards describing how it connects to the previous term */
	join?: 'and' | 'or'
}

export type DbRows = {
	/** Name of the term */
	name: string
	/** Description of the term in plain language */
	description: string
	/** The type of variable stored in the DB (e.g. categorical, float) */
	term_type: string
	/** Array of {key,value} terms storing the possible categories for a categorical variable */
	values: DbValue[]
}

export type DbValue = {
	/** Name of the key */
	key: string
	/** Object of values corresponding to the key */
	value: any
}

export type ClassificationType =
	| html_type
	| plot_type /** Variable containing the type of action the UI needs to take */

export type html_type = {
	/** When type == html, display the string in the html field */
	type: 'html'
	/** The message to be dislayed on the chatbot UI */
	html: string
}

export type plot_type = {
	/** When type == plot, show the corresponding plot in the plot field */
	type: 'plot'
	/** The type of plot to be displayed on the UI. */
	plot: 'summary' | 'dge' | 'none' | 'survival'
}

export type DEType = {
	/** Name of group1 which is an array of filter terms */
	group1: FilterTerm[]
	/** Name of group2 which is an array of filter terms */
	group2: FilterTerm[]
	/** Method used for carrying out differential gene expression analysis */
	method?: 'edgeR' | 'limma' | 'wilcoxon'
}
