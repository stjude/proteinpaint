if (process.argv.length != 3) {
	console.log('<input region file> output list of snps with pvalues to stdout')
	process.exit()
}

const got = require('got')
const fs = require('fs')

const host = 'https://proteinpaint.stjude.org/termdb'

main()

async function main() {
	for (const line of fs
		.readFileSync(process.argv[2], { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		const chr = l[0]
		const start = Number(l[1])
		const stop = Number(l[2])
		if (Number.isNaN(start) || Number.isNaN(stop)) continue
		const w = stop - start
		if (w * 3 > 6000) {
			// one query every 5kb
			let cumlen = 0
			while (cumlen < w * 3) {
				const thisstart = start - w + cumlen
				await runQuery({
					chr,
					start: thisstart,
					stop: Math.min(stop + w, thisstart + 5000)
				})
				cumlen += 5000
			}
		} else {
			await runQuery({
				chr,
				start: start - w,
				stop: stop + w
			})
		}
	}
}

async function runQuery(p) {
	const cacheid = await validateSnps(p)
	const snp2effAle = await sumSamples(cacheid)
	const snps = await doRegression(p, cacheid, snp2effAle)
	for (const s of snps) {
		const [pos, ref, alt] = s[0].split('.')
		console.log(`${p.chr}\t${pos}\t${ref}\t${alt}\t${s[1]}`)
	}
}

async function validateSnps(p) {
	const json = {
		chr: p.chr,
		start: p.start,
		stop: p.stop,
		validateSnps: '1',
		genome: 'hg38',
		dslabel: 'SJLife',
		variant_filter: {
			type: 'tvslst',
			join: 'and',
			in: true,
			lst: [
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [
							{
								label: 'Bad',
								key: 'Bad'
							}
						],
						term: {
							id: 'QC_sjlife',
							name: 'SJLIFE classification',
							parent_id: null,
							isleaf: true,
							type: 'categorical',
							values: {
								SuperGood: {
									label: 'SuperGood',
									key: 'SuperGood'
								},
								Good: {
									label: 'Good',
									key: 'Good'
								},
								Ambiguous: {
									label: 'Ambiguous',
									key: 'Ambiguous'
								},
								Bad: {
									label: 'Bad',
									key: 'Bad'
								}
							}
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [
							{
								label: 'Bad',
								key: 'Bad'
							}
						],
						term: {
							id: 'QC_ccss',
							name: 'CCSS classification',
							parent_id: null,
							isleaf: true,
							type: 'categorical',
							values: {
								SuperGood: {
									label: 'SuperGood',
									key: 'SuperGood'
								},
								Good: {
									label: 'Good',
									key: 'Good'
								},
								Ambiguous: {
									label: 'Ambiguous',
									key: 'Ambiguous'
								},
								Bad: {
									label: 'Bad',
									key: 'Bad'
								}
							}
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 0.95,
								startinclusive: true,
								stopunbounded: true
							}
						],
						term: {
							id: 'SJcontrol_CR',
							name: 'SJLIFE control call rate',
							parent_id: null,
							isleaf: true,
							type: 'float'
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 0.95,
								startinclusive: true,
								stopunbounded: true
							}
						],
						term: {
							id: 'CR',
							name: 'Call rate, SJLIFE+CCSS',
							parent_id: null,
							isleaf: true,
							type: 'float'
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 0.95,
								startinclusive: true,
								stopunbounded: true
							}
						],
						term: {
							id: 'CR_sjlife',
							name: 'SJLIFE call rate',
							parent_id: null,
							isleaf: true,
							type: 'float'
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 0.95,
								startinclusive: true,
								stopunbounded: true
							}
						],
						term: {
							id: 'CR_ccss',
							name: 'CCSS call rate',
							parent_id: null,
							isleaf: true,
							type: 'float'
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						ranges: [
							{
								start: 0.95,
								startinclusive: true,
								stopunbounded: true
							}
						],
						term: {
							id: 'gnomAD_CR',
							name: 'gnmoAD call rate',
							parent_id: null,
							isleaf: true,
							type: 'float'
						}
					}
				},
				/*{
				"type": "tvs",
				"tvs": {
					"ranges": [{
						"start": 0.1,
						"startinclusive": true,
						"stopunbounded": true
					}],
					"term": {
						"id": "gnomAD_AF",
						"name": "gnomAD allele frequency",
						"parent_id": null,
						"isleaf": true,
						"type": "float",
						"min": 0,
						"max": 1,
						"values": {}
					}
				}
			}, */
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [
							{
								label: 'yes',
								key: '1'
							}
						],
						term: {
							id: 'BadBLAT',
							name: 'Paralog',
							parent_id: null,
							isleaf: true,
							type: 'categorical'
						}
					}
				},
				{
					type: 'tvs',
					tvs: {
						isnot: true,
						values: [
							{
								label: 'yes',
								key: '1'
							}
						],
						term: {
							id: 'Polymer_region',
							name: 'Polymer region',
							parent_id: null,
							isleaf: true,
							type: 'categorical'
						}
					}
				}
			]
		}
	}
	const data = await got.post(host, { json })
	if (!data.body) throw 'no response'
	const j = JSON.parse(data.body)
	if (!j.cacheid) throw '.cacheid missing'
	return j.cacheid
}

async function sumSamples(cacheid) {
	const json = {
		cacheid,
		validateSnps: '1',
		sumSamples: '1',
		genome: 'hg38',
		dslabel: 'SJLife',
		filter: {
			type: 'tvslst',
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'genetic_race',
							type: 'categorical',
							name: 'Genetically defined race'
						},
						values: [{ key: 'African Ancestry', label: 'African Ancestry' }]
					}
				},
				{
					tag: 'cohortFilter',
					type: 'tvs',
					tvs: { term: { id: 'subcohort', type: 'categorical' }, values: [{ key: 'SJLIFE', label: 'SJLIFE' }] }
				}
			]
		}
	}
	const data = await got.post(host, { json })
	if (!data.body) throw 'no response'
	const j = JSON.parse(data.body)
	if (!j.snps) throw '.snps[] missing'
	// duplicate of termsetting.snplst.sampleSum.js
	const snp2effAle = {}
	for (const s of j.snps) {
		let a = s.alleles[0]
		for (let i = 1; i < s.alleles.length; i++) {
			const b = s.alleles[i]
			if (b.count < a.count) {
				a = b
			}
		}
		snp2effAle[s.snpid] = a.allele
	}
	return snp2effAle
}

async function doRegression(p, cacheid, snp2effAle) {
	const json = {
		getregression: '1',
		regressionType: 'cox',
		outcome: {
			id: 'Cardiomyopathy',
			q: {
				timeScale: 'age',
				//"hiddenValues": { "-1": 1 },
				mode: 'cox',
				value_by_max_grade: true,
				bar_by_grade: true,
				breaks: [1],
				groupNames: ['No event / not tested', 'Has event']
			}
		},
		independent: [
			{ id: 'sex', q: { mode: 'discrete' }, refGrp: '1' },
			{ id: 'agedx', q: { mode: 'continuous' } },
			{ id: 'agelastvisit', q: { mode: 'continuous' } },
			{
				id: 'anthracyclines_cog_5',
				q: {
					mode: 'discrete',
					type: 'custom-bin',
					lst: [
						{
							startunbounded: true,
							stopinclusive: true,
							stop: 0,
							label: 'Not exposed'
						},
						{
							stopinclusive: true,
							start: 0,
							stop: 250,
							label: '>0 to 250'
						},
						{
							startinclusive: false,
							stopunbounded: true,
							start: 250,
							label: '>250'
						}
					],
					hiddenValues: {
						'-8888': 1,
						'-9999': 1
					}
				},
				type: 'float',
				refGrp: 'Not exposed',
				interactions: [],
				values: {
					'-8888': {
						label: 'exposed, dose unknown',
						uncomputable: true
					},
					'-9999': {
						label: 'unknown exposure',
						uncomputable: true
					}
				}
			},
			{
				id: 'hrtavg',
				q: {
					mode: 'discrete',
					type: 'custom-bin',
					lst: [
						{
							startunbounded: true,
							stopinclusive: true,
							stop: 0,
							label: 'Not exposed'
						},
						{
							stopinclusive: true,
							start: 0,
							stop: 250,
							label: '>0 to 250'
						},
						{
							startinclusive: false,
							stopunbounded: true,
							start: 250,
							label: '>250'
						}
					],
					hiddenValues: {
						'-8888': 1,
						'-9999': 1
					}
				},
				type: 'float',
				refGrp: 'Not exposed',
				interactions: [],
				values: {
					'-8888': {
						label: 'exposed, dose unknown',
						uncomputable: true
					},
					'-9999': {
						label: 'unknown exposure',
						uncomputable: true
					}
				}
			},
			{
				id: cacheid,
				q: {
					chr: p.chr,
					start: p.start,
					stop: p.stop,
					alleleType: 0,
					geneticModel: 0,
					restrictAncestry: {
						name: 'African ancestry',
						tvs: {
							term: {
								id: 'genetic_race',
								type: 'categorical',
								name: 'Genetically defined race'
							},
							values: [
								{
									key: 'African Ancestry',
									label: 'African Ancestry'
								}
							]
						}
					},
					variant_filter: {
						type: 'tvslst',
						join: 'and',
						in: true,
						lst: [
							{
								type: 'tvs',
								tvs: {
									isnot: true,
									values: [
										{
											label: 'Bad',
											key: 'Bad'
										}
									],
									term: {
										id: 'QC_sjlife',
										name: 'SJLIFE classification',
										parent_id: null,
										isleaf: true,
										type: 'categorical',
										values: {
											SuperGood: {
												label: 'SuperGood',
												key: 'SuperGood'
											},
											Good: {
												label: 'Good',
												key: 'Good'
											},
											Ambiguous: {
												label: 'Ambiguous',
												key: 'Ambiguous'
											},
											Bad: {
												label: 'Bad',
												key: 'Bad'
											}
										}
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									isnot: true,
									values: [
										{
											label: 'Bad',
											key: 'Bad'
										}
									],
									term: {
										id: 'QC_ccss',
										name: 'CCSS classification',
										parent_id: null,
										isleaf: true,
										type: 'categorical',
										values: {
											SuperGood: {
												label: 'SuperGood',
												key: 'SuperGood'
											},
											Good: {
												label: 'Good',
												key: 'Good'
											},
											Ambiguous: {
												label: 'Ambiguous',
												key: 'Ambiguous'
											},
											Bad: {
												label: 'Bad',
												key: 'Bad'
											}
										}
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.95,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'SJcontrol_CR',
										name: 'SJLIFE control call rate',
										parent_id: null,
										isleaf: true,
										type: 'float'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.95,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'CR',
										name: 'Call rate, SJLIFE+CCSS',
										parent_id: null,
										isleaf: true,
										type: 'float'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.95,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'CR_sjlife',
										name: 'SJLIFE call rate',
										parent_id: null,
										isleaf: true,
										type: 'float'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.95,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'CR_ccss',
										name: 'CCSS call rate',
										parent_id: null,
										isleaf: true,
										type: 'float'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.95,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'gnomAD_CR',
										name: 'gnmoAD call rate',
										parent_id: null,
										isleaf: true,
										type: 'float'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									ranges: [
										{
											start: 0.1,
											startinclusive: true,
											stopunbounded: true
										}
									],
									term: {
										id: 'gnomAD_AF',
										name: 'gnomAD allele frequency',
										parent_id: null,
										isleaf: true,
										type: 'float',
										min: 0,
										max: 1,
										values: {}
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									isnot: true,
									values: [
										{
											label: 'yes',
											key: '1'
										}
									],
									term: {
										id: 'BadBLAT',
										name: 'Paralog',
										parent_id: null,
										isleaf: true,
										type: 'categorical'
									}
								}
							},
							{
								type: 'tvs',
								tvs: {
									isnot: true,
									values: [
										{
											label: 'yes',
											key: '1'
										}
									],
									term: {
										id: 'Polymer_region',
										name: 'Polymer region',
										parent_id: null,
										isleaf: true,
										type: 'categorical'
									}
								}
							}
						]
					},
					cacheid,
					snp2effAle
				},
				type: 'snplocus',
				interactions: []
			}
		],
		filter: {
			type: 'tvslst',
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: {
							id: 'genetic_race',
							type: 'categorical',
							name: 'Genetically defined race'
						},
						values: [
							{
								key: 'African Ancestry',
								label: 'African Ancestry'
							}
						]
					}
				},
				{
					tag: 'cohortFilter',
					type: 'tvs',
					tvs: {
						term: {
							id: 'subcohort',
							type: 'categorical'
						},
						values: [
							{
								key: 'SJLIFE',
								label: 'SJLIFE'
							}
						]
					}
				}
			]
		},
		genome: 'hg38',
		dslabel: 'SJLife',
		type3columnid: 3
	}

	json.regressionType = 'linear'
	json.outcome = { id: 'LV_Ejection_Fraction_3D', q: { mode: 'continuous' } }
	json.type3columnid = 5

	const data = await got.post(host, { json })
	if (!data.body) throw 'no response'
	const j = JSON.parse(data.body)
	if (!Array.isArray(j)) throw 'response is not array'
	const snps = []
	for (const s of j) {
		const snpid = s.id
		if (!snpid) continue
		if (s.data && s.data.type3 && s.data.type3.terms && s.data.type3.terms[snpid]) {
			const pvalue = Number(s.data.type3.terms[snpid][json.type3columnid])
			if (Number.isNaN(pvalue)) continue
			if (pvalue >= 0.01) continue
			snps.push([snpid, -Math.log10(pvalue)])
		}
	}
	return snps
}
