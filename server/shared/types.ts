/********* Genome interfaces *********/

interface GeneDb {
  dbfile: string
}

interface TermDbs {
  msigdb?: TermDbsEntry
}

interface TermDbsEntry {
  label: string,
  cohort: Cohort
}

interface Cohort {
	db: { file: string }
	termdb: object
}

interface DbStatement { 
	dbfile: string, 
	statement: string
}

interface Snp {
	bigbedfile: string
}

interface FimoMotif {
	db: string
	annotationfile: string
}

interface ClinvarCategoriesEntry {
	color: string
	label: string
	desc: string
	textcolor?: string
}

interface ClinvarCategories {
	[index: string]: ClinvarCategoriesEntry
}

interface ClinVarVCF{
	file: string
	infokey: string
	categories: ClinvarCategories
}

interface TrackCategoryEntry { 
	color: string, 
	label: string
}

interface TrackCategories {
	[index: string]: TrackCategoryEntry
}

interface Track {
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

interface DefaultCoord {
	chr: string,
	start: number,
	stop: number,
	gene?: string
}

interface GeneSetEntry { 
	name: string 
}

interface GeneSet {
	name: string
	lst: GeneSetEntry[]
}

interface HicEnzymeFragment { 
	enzyme: string, 
	file: string
}

interface HicDomainSetEntry {
	name: string
	longname: string
	file: string
}

interface HicDomainSet {
	[index: string]: HicDomainSetEntry
}

interface HicDomainGrpEntry{
	name: string
	reference: string
	sets: HicDomainSet
}

interface HicDomainGroups {
	[index: string]: HicDomainGrpEntry
}

interface HicDomain{
	[index: string] : HicDomainGroups
}

//Separated to force g.tracks as required, see hgvirus.ts
export interface MinGenome {
	species: string
	genomefile: string
	genedb: GeneDb
	defaultcoord: DefaultCoord
	hicenzymefragment?: HicEnzymeFragment[],
	majorchr: string
}

export interface Genome extends MinGenome {
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
