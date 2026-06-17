import { appInit } from '#plots/plot.app.js'
import { select } from 'd3-selection'
import { vocabInit } from '#termdb/vocabulary'
import { copyMerge } from '#rx'

/*
GDC entry point that mounts the shared GRIN2 plot (client/plots/grin2) in the GDC portal. This is just a
thin bootstrap — the shared route (/grin2) and UI (client/plots/grin2) hold the logic; here we only spin
up the GDC vocab + mass app and open the grin2 plot, the same way the GDC OncoMatrix (oncomatrix.js) and
other GDC tools launch. Passes the GDC cohort via termfilter.filter0.

Part of unifying onto one GRIN2 route + UI: this replaces the custom GDC GRIN2 UI (client/gdc/grin2.ts);
once that file is removed, this launcher can take its place as client/gdc/grin2.ts.

Cohort-driven: there is no per-file selection table — the unified /grin2 route discovers each case's
MAF/CNV files server-side from filter0 (server/src/mds3.gdc.js discoverGdcGrin2CaseFiles), and the shared
GRIN2 plot's handleRun already forwards filter0 in its request.

runpp() arg:
  .filter0{}   optional GDC cohort filter
  .holder      DOM node to render into (a .sja_root_holder is created inside it by the pp app wrapper)
*/

const gdcGenome = 'hg38'
const gdcDslabel = 'GDC'

export async function init(arg: any, _holder: any, genomes: any) {
	const toolGenome = arg.genome || gdcGenome
	const toolDslabel = arg.dslabel || gdcDslabel
	const genome = genomes[toolGenome]
	if (!genome) throw toolGenome + ' missing'
	if (arg.filter0 && typeof arg.filter0 != 'object') throw 'arg.filter0 not object'

	const vocabApi = await vocabInit({
		state: { vocab: { genome: toolGenome, dslabel: toolDslabel } }
	})
	vocabApi.getTermdbConfig()

	const plotAppApi = await appInit({
		holder: select(arg.holder).select('.sja_root_holder'),
		genome,
		state: copyMerge(
			{
				genome: toolGenome,
				dslabel: toolDslabel,
				termfilter: { filter0: arg.filter0 },
				plots: [{ chartType: 'grin2' }]
			},
			arg.state || {}
		),
		app: arg.opts?.app || {}
	})

	return plotAppApi
}
