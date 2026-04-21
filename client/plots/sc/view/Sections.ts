import type { Div } from '../../../types/d3'

export type Sections = {
	//Key is either sampleId or plotName depending on the grouping method
	[key: string]: {
		/** Wrapper div for the entire section. Used to destroy the section when needed. */
		sectionWrapper: Div
		/** Title element for the section. */
		title: any
		/** Wrapper for the subplots within the section. */
		subplots: any
		/** Maps the plotId to the corresponding sandbox element. */
		sandboxes: {
			//Key is the plot.id and the value is sandbox.app_div
			[key: string]: any
		}
	}
}
