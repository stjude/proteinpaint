/** Settings persisted on `state.config.settings` for the GRIN2 plot.
 *  All data-type sub-options are optional: they are absent before the first Run
 *  and populated from the form by handleRun on each subsequent dispatch. */
export interface GRIN2Settings {
	/** Persisted SNV/indel options. Populated after the first Run from the form. */
	snvindelOptions?: {
		/** Consequence class keys (e.g. 'missense_variant') currently checked in the form. */
		consequences?: string[]
		/** Active MAF filter, if the dataset config provides a `queries.snvindel.mafFilter`. */
		mafFilter?: any
	}

	/** Persisted CNV options. Populated after the first Run from the form. */
	cnvOptions?: {
		lossThreshold?: number
		gainThreshold?: number
		maxSegLength: number
		/** id of the selected cnv file type, for datasets exposing queries.singleSampleMutation.cnvTypes */
		cnvType?: string
	}

	/** Persisted fusion options (currently no user-configurable fields). */
	fusionOptions?: Record<string, any>

	/** Persisted SV options (currently no user-configurable fields). */
	svOptions?: Record<string, any>

	/** Persisted ITD options (currently no user-configurable fields). */
	itdOptions?: Record<string, any>
}
