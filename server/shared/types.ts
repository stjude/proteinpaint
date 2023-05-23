interface GeneDb {
  dbfile: string
}

interface TermDbs {
  msigdb?: TermdbsEntry
}

interface TermDbsEntry {
  label: string
  
}

//interface Cohort: any

export interface Genome {
  species: string
	genomefile: string
	genedb: GeneDb
	termdbs: TermDbs
}

export class Test {
  constructor() {}

	main() {
		console.log("server test")
	}
}
