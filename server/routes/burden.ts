import { BurdenRequest, BurdenResponse } from '#shared/types/routes/burden.ts'
import lines2R from '#src/lines2R.js'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { write_file } from '#src/utils.js'

export const api = {
	endpoint: 'burden',
	methods: {
		get: {
			init() {
				return async (req: undefined, res: any): Promise<void> => {
					try {
						const estimates = await getBurdenEstimates(req)
						const { keys, rows } = formatPayload(estimates)
						res.send({ status: 'ok', keys, rows })
					} catch (e: any) {
						res.send({ status: 'error', error: e.message || e })
					}
				}
			},
			request: {
				typeId: 'BurdenRequest'
			},
			response: {
				typeId: 'BurdenResponse'
			},
			examples: [
				{
					request: {
						body: {}
					}
				}
			]
		}
	}
}

async function getBurdenEstimates(q) {
	const infile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	const data = Object.assign({}, defaults, q.query)
	console.log(40, data)
	await write_file(infile, JSON.stringify(data))
	// TODO: use the dataset location
	const dsDataDir = `${serverconfig.tpmasterdir}/files/hg38/sjlife/burden`
	const args = [
		infile,
		`${dsDataDir}/cphfits2.RData`,
		`${dsDataDir}/surv.RData`,
		`${dsDataDir}/nchcsampledsex0age0steroid0bleo0vcr0etop0itmt0.RData`
	]
	console.log(48, args)
	const Routput = await lines2R(path.join(serverconfig.binpath, 'utils/burden.R'), [], args)
	const estimates = JSON.parse(Routput[0])
	return estimates
}

function formatPayload(estimates) {
	const rawKeys = Object.keys(estimates[0])
	const outKeys = []
	const keys = []
	for (const k of rawKeys) {
		if (k == 'chc') {
			keys.push(k)
			outKeys.push(k)
		} else {
			const age = Number(k.slice(1).split(',')[0])
			if (age <= 60 && age % 2 == 0) {
				keys.push(k)
				outKeys.push(`burden${age}`)
			}
		}
	}
	const rows = []
	// v = an array of objects with age as keys as cumulative burden as value for a given CHC
	for (const v of estimates) {
		rows.push(keys.map(k => v[k]))
	}
	return { keys: outKeys, rows }
}

const defaults = Object.freeze({
	diaggrp: 5,
	sex: 0,
	white: 1,
	agedx: 1,
	// chemotherapy
	steriod: 0,
	bleo: 0,
	vcr: 12, // Vincristine
	etop: 2500, // Etoposide
	itmt: 0, // Intrathecal methothrexate_grp: 0,
	ced: 1.6, // Cyclophosphamide, 0.7692 mean 7692.
	cisp: 300, // Cisplatin
	dox: 0, // Anthracycline, 3 mean 300 ml/m2
	carbo: 0, //  Carboplatin
	hdmtx: 0, // High-Dose Methotrexate
	// radiation
	brain: 5.4,
	chest: 2.4,
	heart: 0,
	pelvis: 0,
	abd: 2.4
})

// # # Input person's values, 18 input X's , plus the input primary DX
// # 	sexval=1  #sex, take value 1 for male and 0 for female
// # 	whiteval=1	# Race white or not, 1 for white, 0 for non-white
// # 	agedxval=6  # age at primary cancer DX

// # #### Chemotherapy
// # 	steroidval=0  #Steroids 1 for yes 0 for no
// # 	bleoval=0; ##Bleomycin
// # 	vcrval=12; 	#Vincristine
// # 	etopval=2500; #Etoposide
// # 	itmtval=0; 		#Intrathecal Methotrexate
// # 	cedval=1.6		# Cyclophosphamide, 0.7692 mean 7692.
// # 	cispval=300		#Cisplatin
// # 	doxval=0		#Anthracycline, 3 mean 300 ml/m2
// # 	carboval=0  ## Carboplatin
// # 	hdmtxval=0	## High-Dose Methotrexate

// # # Radiation
// # 	brainval=5.4 #Brain, 5.4 means 54Gy, 5400 cGy. #####Same for all RT doses.#####
// # 	chestval=2.4 # chest/neck RT, 2.4 for 24 Gy
// # 	heartval=0	# Heart RT
// # 	pelvisval=0	#pelvis RT
// # 	abdval=2.4  # Abdominal RT
