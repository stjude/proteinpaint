import type { DefaultCoord, Track } from '#types'

/** server init validates and processes genome objs derived from the
 * reference file. These types reflects the changes in the genome
 * objs sent and specific to the client.
 */

export type ClientGenome = {
	/** Has a blat server */
	blat: boolean
	chrlookup: ChrLookUp
	datasets: { [index: string]: any }
	defaultcoord: DefaultCoord
	/** true if .fimo_motif={ db: ...} defined in genome */
	fimo_motif?: boolean
	hasClinvarVCF?: boolean
	/** Same as genome.genedb.hasIdeogram */
	hasIdeogram: boolean
	/** true if .snp={ bidbedfile: ... } defined in genome */
	hasSNP: boolean
	hicdomain?: { groups: any }
	hicenzymefragment: { enzyme: string; file: string }[]
	/** if true, do not show genome in the header dropdown */
	hideOnClient?: boolean
	geneset?: GeneSet
	isdefault?: boolean
	/** k: upper isoform
     v: [gene mutation] 
     DO not change to Map type - funcs added later cause type errors
     */
	isoformcache?: any
	/** Searches the isoformcache for a match to n2 using the chr and pos*/
	isoformmatch?: (n2: string, chr: string, pos: string) => string
	/*
    k: junction chr-start-stop
    v: Map
       k: isoform
       v: true/false for in-frame
    DO not change to Map type - funcs added later cause type errors
    */
	junctionframecache?: any
	majorchr: { [index: string]: number }
	majorchrorder: string[]
	minorchr: { [index: string]: number }
	name: string
	/** Common name of the animal (e.g. human, mouse, etc.) */
	species: string
	termdbs?: { [index: string]: { label: string } }
	tkset?: any
	tracks: Track[]
}

export type ChrLookUp = {
	[index: string]: { major?: boolean; len: number; name: string }
}

type GeneSet = {
	[index: string]: { name: string; lst: string[] }
}
