/******* server/src/termdb.matrix.js is ~not~ a route *****
 * getData() is used frequently in other routes or typescript files.
 * Although the original file is 1) not ts and 2) not a route, a type
 * is still needed when func used in other ts files.
 *
 * Use this type for that purpose.
 */

export type ValidGetDataResponse = {
	samples: Record<
		string,
		{
			/** stringified integer sample id  */
			key: number
			/** value: { 
			sample: integerId,
			<tw.$id>: {key, value},
			<more terms...>
		} */
			value: number
		}
	>
	/** Metadata */
	refs: {
		/** metadata about terms
		 * Index is <tw.$id> */
		byTermId: Record<
			string,
			{
				keyOrder?: any
				/** CTE.bins */
				bins?: any
				/** CTE.events. These info are not available in term object and is computed during run time. */
				events?: any
			}
		>
		/** metadata about samples (e.g. print names). avoid duplicating such in sample data elements (e.g. mutations)
		[sample integer id]: {label: [string sample name for display], ...} 
		May return as an empty object. */
		bySampleId: Record<string, { label: string }> | object
	}
	sampleType?: any
}

export type GetDataResponse = ValidGetDataResponse | { error: string }
