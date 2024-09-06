// Declare argument type(s) that are specific to a method for a particulat plot, app, or component
export type PlotTwRenderOpts = {
	data: {
		[sampleId: string]: {
			[termId: string]: number | string
		}
	}
}

export interface FakeTw {
	render: (arg: PlotTwRenderOpts) => string
}
