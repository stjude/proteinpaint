interface GeneDb {
  dbfile: string
}

interface TermDbs {
  msigdb?: TermDbsEntry
}

interface TermDbsEntry {
  label: string
  
}

//interface Cohort: any

export interface Genome {
  species: string
	genomefile: string
	genedb: GeneDb
	termdbs?: TermDbs
	tracks: any
	defaultcoord: any
	majorchr: string
	minorchr: string
}

export class Test {
  constructor() {}

	main() {
		console.log("server test")
	}
}
