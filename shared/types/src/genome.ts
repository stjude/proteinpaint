import type { Cohort } from './dataset.ts'

/********* server/genome ********
 
--------EXPORTED--------
MinGenome
Genome

*/

type GeneDb = {
	dbfile: string
}

type TermDbs = {
	[key: string]: TermDbsEntry
}

type TermDbsEntry = {
	label: string
	cohort: Cohort
	/** list of geneset groups in db; required for geneORA and gsea
	later allow ds override so ds can enable/disable some genesets..
	*/
	analysisGenesetGroups: { label: string; value: string }[]
	/** required for gsea */
	geneORAparam: { minCutoff: number; maxCutoff: number }
}

type DbStatement = {
	dbfile: string
	statement: string
}

type Snp = {
	bigbedfile: string
}

type FimoMotif = {
	db: string
	annotationfile: string
}

type TrackCategoryEntry = {
	color: string
	label: string
}

type TrackCategories = {
	[index: string]: TrackCategoryEntry | undefined
}

export type Track = {
	__isgene?: boolean
	translatecoding?: boolean
	file: string
	type: string
	name: string
	categories?: TrackCategories
	stackheight?: number
	stackspace?: number
	vpad?: number
	color?: string
	onerow?: boolean
}

export type DefaultCoord = {
	chr: string
	start: number
	stop: number
	gene?: string
}

type GeneSet = {
	name: string
	lst: string[]
}

type HicEnzymeFragment = {
	enzyme: string
	file: string
}

type HicDomainSetEntry = {
	name: string
	longname: string
	file: string
}

type HicDomainSet = {
	[index: string]: HicDomainSetEntry
}

type HicDomainGrpEntry = {
	name: string
	reference: string
	sets: HicDomainSet
}

type HicDomainGroups = {
	[index: string]: HicDomainGrpEntry
}

type HicDomain = {
	[index: string]: HicDomainGroups
}

//Separated to force g.tracks as required, see hgvirus.ts
export type MinGenome = {
	isMinGenome?: boolean
	species: string
	genomefile: string
	genedb: GeneDb
	defaultcoord: DefaultCoord
	hicenzymefragment?: HicEnzymeFragment[]
	majorchr: string
}

export type Genome = MinGenome & {
	termdbs?: TermDbs
	proteindomain?: DbStatement
	repeatmasker?: DbStatement
	snp?: Snp
	fimo_motif?: FimoMotif
	tracks?: Track[]
	geneset?: GeneSet[]
	hicdomain?: HicDomain
	minorchr?: string
}
