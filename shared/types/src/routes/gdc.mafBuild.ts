export type GdcMafBuildRequest = {
	/** List of input file uuids in gdc */
	fileIdLst: string[]
	/** List of columns in output MAF file */
	columns: string[]
}

export type GdcMafBuildResponse = any

// TODO: write payload examples to help with automated testing and documentation, for non-prod use only
