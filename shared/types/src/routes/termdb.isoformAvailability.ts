export type TermdbIsoformAvailabilityRequest = {
	genome: string
	dslabel: string
	/** candidate ENST IDs to check */
	isoforms: string[]
}

export type TermdbIsoformAvailabilityResponse = {
	/** subset of input isoforms that have data in the HDF5 */
	available: string[]
}

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
