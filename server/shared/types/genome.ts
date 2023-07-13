import { Cohort, ClinvarClinsig } from './dataset'

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

type ClinVarVCF = {
	file: string
	infokey: string
	categories: ClinvarClinsig
}

type TrackCategoryEntry = {
	color: string
	label: string
}

type TrackCategories = {
	[index: string]: TrackCategoryEntry
}

type Track = {
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

type DefaultCoord = {
	chr: string
	start: number
	stop: number
	gene?: string
}

type GeneSetEntry = {
	name: string
}

type GeneSet = {
	name: string
	lst: GeneSetEntry[]
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
	clinvarVCF?: ClinVarVCF
	tracks: Track[]
	geneset?: GeneSet[]
	hicdomain?: HicDomain
	minorchr?: string
}
