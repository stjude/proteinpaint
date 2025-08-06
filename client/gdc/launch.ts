/* launch from runpp() call. GDC react wrappers in the GFF repo use this method, to launch apps in gdc portal
on matching with a flag, imports corresponding plot script, and returns api object to runpp()
when no flags are matched, returns undefined
*/
export async function mayLaunchGdcPlotFromRunpp(arg, app) {
	if (arg.geneSearch4GDCmds3) {
		/* can generalize by changing to geneSearch4tk:{tkobj}
		so it's no longer hardcoded for one dataset of one track type
		*/
		const _ = await import('./lollipop.js')
		return await _.init(arg, app.holder0, app.genomes)
	}
	if (arg.launchGdcMatrix) {
		const _ = await import('./oncomatrix.js')
		return await _.init(arg, app.holder0, app.genomes)
	}
	if (arg.launchGdcHierCluster) {
		const _ = await import('./geneExpClustering.js')
		return await _.init(arg, app.holder0, app.genomes)
	}
	if (arg.launchGdcMaf) {
		const _ = await import('./maf.js')
		return await _.gdcMAFui(arg, app.holder0)
	}
	if (arg.launchGdcGrin2) {
		const _ = await import('./grin2.ts')
		return await _.gdcGRIN2ui(arg, app.holder0)
	}
	if (arg.launchGdcScRNAseq) {
		const _ = await import('./singlecell.ts')
		return await _.init(arg, app.holder0, app.genomes)
	}
	if (arg.launchGdcCorrelation) {
		const _ = await import('./correlation.ts')
		return await _.init(arg, app.holder0, app.genomes)
	}
	if (arg.gdcbamslice) {
		const _ = await import('./bam.js')
		arg.gdcbamslice.filter0 = arg.filter0
		return await _.bamsliceui(arg.gdcbamslice, app.holder0, app.genomes)
	}
}

/* launch from url param; this is for local testing and not used in gdc portal
returns true for a match
*/
export async function mayLaunchGdcPlotFromUrlparam(urlp, arg) {
	if (urlp.has('gdcbamslice')) {
		// for local testing, not used in gdc portal
		const _ = await import('./bam.js')
		_.bamsliceui(
			{
				debugmode: arg.debugmode,
				stream2download: urlp.has('stream2download') // for testing only, launch the app in "download mode", will not visualize
			} as any,
			arg.holder,
			arg.genomes
		)
		return true
	}
	if (urlp.has('gdcmaf')) {
		// for local testing, not used in gdc portal
		const _ = await import('./maf.js')
		const p: any = {
			debugmode: arg.debugmode
		}
		if (urlp.has('filter0')) p.filter0 = urlp.get('filter0')
		_.gdcMAFui(p, arg.holder)
		return true
	}
	if (urlp.has('gdcgrin2')) {
		// for local testing, not used in gdc portal
		const _ = await import('./grin2.ts')
		const p: any = {
			debugmode: arg.debugmode
		}
		if (urlp.has('filter0')) p.filter0 = urlp.get('filter0')
		_.gdcGRIN2ui(p, arg.holder)
		return true
	}
	if (urlp.has('gdccorrelation')) {
		// for local testing, not used in gdc portal
		const _ = await import('./correlation.ts')
		const p: any = {
			debugmode: arg.debugmode
		}
		if (urlp.has('filter0')) p.filter0 = urlp.get('filter0')
		_.init(p, arg.holder, arg.genomes)
		return true
	}
}
