/*

export type GdcMafBuildResponse = {
	FIXME response is a binary stream. don't know a way to type it
}
*/

export type GdcMafBuildRequest = {
	/** List of input file uuids in gdc */
	fileIdLst: string[]
	/** List of columns in output MAF file */
	columns: string[]
}
