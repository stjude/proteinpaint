import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
import { authApi } from '#src/auth.js'
import { versionInfo } from '#src/health.ts'

export const api: any = {
	endpoint: 'genomes',
	methods: {
		get: {
			init,
			request: {
				typeId: 'any'
			},
			response: {
				typeId: 'any'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async function handle_genomes(req, res) {
		try {
			await fs.promises.stat(serverconfig.tpmasterdir)
		} catch (e: any) {
			/* dir is inaccessible
return error message as the service is out
*/
			// default error message
			let message = 'Error with TP directory (' + e.code + ')'
			const m = serverconfig.maintenance || {}
			// may override with a non-empty maintenance message
			if ('start' in m && 'stop' in m && m.tpMessage) {
				// use unix timestamps to simplify comparison
				const start = +new Date(m.start)
				const stop = +new Date(m.stop)
				const currTime = +new Date()
				if (start <= currTime && currTime <= stop) {
					message = m.tpMessage
				}
			}
			res.send({ error: message })
			return
		}

		const hash = {}
		if (req.query && req.query.genome) {
			hash[req.query.genome] = clientcopy_genome(req.query.genome, genomes)
		} else {
			for (const genomename in genomes) {
				hash[genomename] = clientcopy_genome(genomename, genomes)
			}
		}
		let hasblat = false
		for (const n in genomes) {
			if (genomes[n].blat) hasblat = true
		}
		res.send({
			genomes: hash,
			debugmode: serverconfig.debugmode,
			headermessage: serverconfig.headermessage,
			base_zindex: serverconfig.base_zindex,
			pkgver: versionInfo.pkgver,
			versionInfo,
			codedate: versionInfo.codedate, // still useful to know the package build/publish date in the response payload, even if it's not displayed
			launchdate: versionInfo.launchdate,
			hasblat,
			features: serverconfig.features,
			dsAuth: authApi.getDsAuth(req),
			commonOverrides: serverconfig.commonOverrides,
			targetPortal: serverconfig.targetPortal, //sending target portal to the client
			cardsPath: serverconfig.cards?.path
		})
	}
}

function clientcopy_genome(genomename, genomes) {
	const g = genomes[genomename]
	const g2: any = {
		species: g.species,
		name: genomename,
		hasSNP: g.snp ? true : false,
		hasIdeogram: g.genedb.hasIdeogram,
		fimo_motif: g.fimo_motif ? true : false,
		blat: g.blat ? true : false,
		geneset: g.geneset,
		defaultcoord: g.defaultcoord,
		isdefault: g.isdefault,
		majorchr: g.majorchr,
		majorchrorder: g.majorchrorder,
		minorchr: g.minorchr,
		tracks: g.tracks,
		hicenzymefragment: g.hicenzymefragment,
		datasets: {},
		hideOnClient: g.hideOnClient
	}

	if (g.termdbs) {
		g2.termdbs = {}
		for (const k in g.termdbs) {
			g2.termdbs[k] = {
				label: g.termdbs[k].label,
				analysisGenesetGroups: g.termdbs[k].analysisGenesetGroups,
				geneORAparam: g.termdbs[k].geneORAparam
			}
		}
	}

	for (const dsname in g.datasets) {
		const ds = g.datasets[dsname]

		if (ds.isMds3) {
			// only send most basic info about the dataset, enough for e.g. a button to launch this dataset
			// client will request detailed info when using this dataset
			g2.datasets[ds.label] = {
				isMds3: true,
				noHandleOnClient: ds.noHandleOnClient,
				label: ds.label
			}
			continue
		}

		if (ds.isMds) {
			g2.datasets[ds.label] = {
				isMds: true,
				mdsIsUninitiated: true,
				noHandleOnClient: ds.noHandleOnClient,
				label: ds.label
			}
			continue
			/*
const _ds = mds_clientcopy(ds)
if (_ds) {
        g2.datasets[ds.label] = _ds
}
continue
*/
		}

		// old official ds; to be replaced by mds3
		g2.datasets[ds.label] = {
			isofficial: true,
			legacyDsIsUninitiated: true, // so client only gets copy_legacyDataset once
			noHandleOnClient: ds.noHandleOnClient,
			label: ds.label
		}
	}

	if (g.hicdomain) {
		g2.hicdomain = { groups: {} }
		for (const s1 in g.hicdomain.groups) {
			const tt = g.hicdomain.groups[s1]
			g2.hicdomain.groups[s1] = {
				name: tt.name,
				reference: tt.reference,
				sets: {}
			}
			for (const s2 in tt.sets) {
				g2.hicdomain.groups[s1].sets[s2] = {
					name: tt.sets[s2].name,
					longname: tt.sets[s2].longname
				}
			}
		}
	}
	return g2
}
