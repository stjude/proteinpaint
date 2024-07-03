import { Selection } from 'd3-selection'
import { Div } from './d3'

/**File intented to collect global proteinpaint data formats. Like the genome
 * chrlookup, dt, mutation classes, etc.
 * Maybe rename to something more appriopriate later?? Make more specific?
 */

export type ChrLookUp = {
	[index: string]: { major?: boolean; len: number; name: string }
}

export type Pane = {
	header: Div
	body: Selection<any, any, any, any>
}

export type Coordinate = { chr: string; start: number; stop: number }

type GeneSet = {
	[index: string]: { name: string; lst: string[] }
}

type ClientCopyDataset = {
	/** See Mds Dataset type for description */
	isMds?: boolean
	/** See Mds3 Dataset type for description */
	isMds3?: boolean
	label: string
	isoffical?: boolean
	legacyDsIsUninitiated?: boolean | number
	mdsIsUninitiated?: boolean | number
	/** Ignored by the client */
	noHandleOnClient?: boolean | number
}
// WIP
export type ClientCopyGenome = {
	/** Has a blat server */
	blat: boolean
	chrlookup: ChrLookUp
	datasets: { [index: string]: ClientCopyDataset }
	defaultcoord: Coordinate
	/** true if .fimo_motif={ db: ...} defined in genome */
	fimo_motif?: boolean
	hasClinvarVCF?: boolean
	/** Same as genome.genedb.hasIdeogram */
	hasIdeogram: boolean
	/** true if .snp={ bidbedfile: ... } defined in genome */
	hasSNP: boolean
	hicdomain?: { groups: any }
	hicenzymefragment: { enzyme: string; file: string }[]
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
	tracks: any[]
}
