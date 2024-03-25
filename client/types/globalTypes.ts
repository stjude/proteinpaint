/**File intented to collect global proteinpaint data formats. Like the genome
 * chrlookup, dt, mutation classes, etc.
 * Maybe rename to something more appriopriate later?? Make more specific?
 */

export type ChrLookUp = {
	[index: string]: { major?: boolean; len: number; name: string }
}
