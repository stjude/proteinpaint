/******* server/src/termdb.matrix.ts is ~not~ a route *****
 * getData() is used frequently in other routes or typescript files. It has no useful native
 * return type of its own -- its return shape is assembled dynamically across many branches
 * (dictionary terms, geneVariant, snp, single-cell, ...) that this hand-written type does not
 * attempt to fully capture -- so a type is still needed when the func is used in other ts files.
 *
 * Use this type for that purpose.
 */

type SampleEntry = {
	/** stringified integer sample id  */
	sample: string | number
} & {
	/** key and values for terms, separated by tw.$id */
	[index: string]: {
		key: number
		value: number
	}
}

type CategoryEntry = {
	key: string
	label: string
	samplecount: number
}

// TODO: need to add a discriminant property (e.g. ".kind") to
// distinguish between ValidGetDataResponse and { error: string }
export type ValidGetDataResponse = {
	samples: {
		[index: string | number]: SampleEntry
	}
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
				/** Categories of term. Only computed for categorical terms that
				have an empty term.values{}. */
				categories?: CategoryEntry[]
			}
		>
		/** metadata about samples (e.g. print names). avoid duplicating such in sample data elements (e.g. mutations)
		[sample integer id]: {label: [string sample name for display], ...} 
		May return as an empty object. */
		bySampleId: Record<string, { label: string }> | object
	}
	sampleType?: { name: string; plural_name: string; parent_id?: string | null }
}

export type GetDataResponse = ValidGetDataResponse | { error: string }
