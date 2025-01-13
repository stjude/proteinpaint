/******* termdb.matrix.js is ~not~ a route *****
 * getData() is used frequently in other routes or typescript files.
 * Although the original file is 1) not ts and 2) not a route, a type
 * is still needed when func used in other ts files.
 *
 * Use this type for that purpose.
 */

export type GetDataResponse = {
	samples: Record<
		string,
		{
			/** stringified integer sample id  */
			key: number
			/** value: { 
			sample: integerId,
			<termid>: {key, value},
			<more terms...>
			<geneName>:{ 
				key, label, // these two are both gene names. useless?? FIXME
				values:[]
					{gene/isoform/chr/pos/ref/alt/class/mname/dt}
			}
		} */
			value: number
		}
	>
	refs: {
		/** metadata about terms 
         * <tw.$id>:
			bins: CTE.bins
			events: CTE.events
				these info are not available in term object and is computed during run time, and 
        */
		byTermId: Record<string, { bins: any }>
		/** metadata about samples (e.g. print names). avoid duplicating such in sample data elements (e.g. mutations)
		[sample integer id]: {label: [string sample name for display], ...} */
		bySampleId: Record<string, { label: string }>
	}
	sampleType?: any
}
