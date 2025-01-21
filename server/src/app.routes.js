// esbuild is currently not able to use filter dynamically imported variable file paths),
// cannot use fs.readdirSync() or await import('../routes/${filename}') in app.ts),
// see https://github.com/evanw/esbuild/issues/700
// export const routeFiles = fs.readdirSync(path.join(serverconfig.binpath), '/routes')), {encoding: 'utf8'), recursive: false})

// must add route file paths below so that esbuild knows exactly what to bundle),
// since dynamic import plugin is not yet supported
export const routeFiles = [
	import('../routes/brainImaging.ts'),
	import('../routes/brainImagingSamples.ts'),
	import('../routes/burden.ts'),
	import('../routes/correlationVolcano.ts'),
	import('../routes/dataset.ts'),
	import('../routes/dsdata.ts'),
	import('../routes/dzimages.ts'),
	import('../routes/gdc.maf.ts'),
	import('../routes/gdc.mafBuild.ts'),
	import('../routes/gdc.topMutatedGenes.ts'),
	import('../routes/gene2canonicalisoform.ts'),
	import('../routes/genelookup.ts'),
	import('../routes/genesetEnrichment.ts'),
	import('../routes/genesetOverrepresentation.ts'),
	import('../routes/genomes.ts'),
	import('../routes/healthcheck.ts'),
	import('../routes/hicdata.ts'),
	import('../routes/hicgenome.ts'),
	import('../routes/hicstat.ts'),
	import('../routes/isoformlst.ts'),
	import('../routes/ntseq.ts'),
	import('../routes/pdomain.ts'),
	import('../routes/sampledzimages.ts'),
	import('../routes/samplewsimages.ts'),
	import('../routes/snp.ts'),
	import('../routes/termdb.DE.ts'),
	import('../routes/termdb.boxplot.ts'),
	import('../routes/termdb.categories.ts'),
	import('../routes/termdb.cluster.ts'),
	import('../routes/termdb.cohort.summary.ts'),
	import('../routes/termdb.cohorts.ts'),
	import('../routes/termdb.config.ts'),
	import('../routes/termdb.descrstats.ts'),
	import('../routes/termdb.numericcategories.ts'),
	import('../routes/termdb.percentile.ts'),
	import('../routes/termdb.rootterm.ts'),
	import('../routes/termdb.sampleImages.ts'),
	import('../routes/termdb.singleSampleMutation.ts'),
	import('../routes/termdb.singlecellDEgenes.ts'),
	import('../routes/termdb.singlecellData.ts'),
	import('../routes/termdb.singlecellSamples.ts'),
	import('../routes/termdb.termchildren.ts'),
	import('../routes/termdb.termsbyids.ts'),
	import('../routes/termdb.topTermsByType.ts'),
	import('../routes/termdb.topVariablyExpressedGenes.ts'),
	import('../routes/termdb.violin.ts'),
	import('../routes/tileserver.ts'),
	import('../routes/wsimages.ts')
]
