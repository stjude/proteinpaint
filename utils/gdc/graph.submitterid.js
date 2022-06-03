// https://github.com/NCI-GDC/portal-ui/blob/92f0dfa17838746093c3c011141d08391016da91/data/schema.graphql

const got = require('got')
const path = require('path')
const arg = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	arg[k] = v
}
const query = `
query barcode($filters: FiltersArgument) {
  repository {
    cases {
      hits(first: 100, filters: $filters) { edges { node {
        samples {
          hits (first: 100, filters: $filters) { edges { node {
            submitter_id
            portions {
              hits { edges { node {
			    analytes {
				  hits { edges { node { 
				    aliquots {
					  hits { edges { node { submitter_id }}}
					}
				  }}}
				}
              } } }
            }
          } } }
        }
      } } }
    }
  }
}`

// 60 cases of AKT1 E17K
const queryIds = arg.id
	? [arg.id]
	: [
			'TCGA-D5-5537-01A-21D-1924-10',
			'TCGA-E7-A5KF-01A-11D-A289-08',
			'CPT008926-0002',
			'TCGA-AD-6889-01A-11D-1924-10',
			'TCGA-CV-5443-01A-01D-1512-08',
			'TCGA-OL-A5RU-01A-11D-A28B-09',
			'TCGA-EJ-5530-01A-01D-1576-08',
			'TCGA-EX-A449-01A-11D-A243-09',
			'TCGA-BH-A0W4-01A-11D-A10G-09',
			'TCGA-GM-A2DL-01A-11D-A18P-09',
			'HTMCP-03-06-02369-01A-01D-10409',
			'TCGA-BG-A0VT-01A-11D-A10M-09',
			'TCGA-BH-A0BR-01A-21W-A12T-09',
			'TCGA-GM-A2DN-01A-11D-A17W-09',
			'433c2eb6-560f-4387-93af-6c2e1a_D6_1',
			'TCGA-D8-A1X8-01A-11D-A14K-09',
			'TCGA-EW-A1IY-01A-11D-A188-09',
			'TCGA-A5-AB3J-01A-11D-A403-09',
			'TCGA-BG-A0YU-01A-21D-A10M-09',
			'TCGA-B6-A0WZ-01A-11D-A10G-09',
			'HTMCP-03-06-02061-01A-01D-4427',
			'TCGA-A8-A094-01A-11W-A019-09',
			'TCGA-AR-A24X-01A-11D-A167-09',
			'd01714eb-22bf-4ad7-95d9-f95bdf_D6',
			'TCGA-BH-A6R8-01A-21D-A33E-09',
			'TCGA-A5-A1OK-01A-11D-A14K-09',
			'TCGA-D8-A141-01A-11D-A10Y-09',
			'TCGA-AC-A6IX-01A-12D-A32I-09',
			'TCGA-LL-A6FQ-01A-11D-A31U-09',
			'TCGA-DJ-A3VJ-01A-11D-A23M-08',
			'CPT0063430009',
			'TCGA-A6-5661-01A-01D-1650-10',
			'TCGA-C8-A26V-01A-11D-A16D-09',
			'TCGA-SL-A6JA-01A-11D-A31U-09',
			'TCGA-BH-A0BS-01A-11D-A12Q-09',
			'TCGA-E2-A15I-01A-21D-A135-09',
			'TCGA-55-6968-01A-11D-1945-08',
			'TCGA-55-7724-01A-11D-2167-08',
			'TCGA-NH-A8F8-01A-72D-A40P-10',
			'TCGA-WT-AB44-01A-11D-A41F-09',
			'fc0aa1e4-c1d8-43ed-a5cd-038f61_D6_1',
			'TCGA-BR-6852-01A-11D-1882-08',
			'TCGA-D8-A1XU-01A-11D-A14K-09',
			'TCGA-V1-A8WW-01A-11D-A377-08',
			'TCGA-AP-A0LL-01A-12D-A127-09',
			'TCGA-AX-A1CI-01A-11D-A135-09',
			'TCGA-BG-A220-01A-11D-A159-09',
			'MBCProject_6246_T1_WES_1',
			'TCGA-E8-A418-01A-11D-A23M-08',
			'TCGA-FY-A4B4-01A-11D-A23U-08',
			'TCGA-D8-A27P-01A-11D-A16D-09',
			'HTMCP-03-06-02410-01A-01D-10409',
			'TCGA-E2-A1L9-01A-11D-A13L-09',
			'TCGA-E2-A570-01A-11D-A29N-09',
			'TCGA-E9-A22H-01A-11D-A159-09',
			'TCGA-JW-AAVH-01A-11D-A387-09',
			'TCGA-W3-A828-06A-11D-A34U-08',
			'TCGA-AO-A12H-01A-11D-A10Y-09',
			'TCGA-EA-A6QX-01A-12D-A33O-09',
			'TCGA-ER-A198-06A-11D-A196-08'
	  ]

const variables = {
	filters: {
		op: '=',
		content: {
			// one aliquot id will match with one sample id
			field: 'samples.portions.analytes.aliquots.submitter_id',
			value: queryIds
			/*
			// one case id can match with multiple samples
			field: 'cases.case_id',
			value: arg.id || 'e76258b7-e13a-4b05-855b-d792701ffba1'
			*/
		}
	}
}
;(async () => {
	try {
		const response = await got.post('https://api.gdc.cancer.gov/v0/graphql', {
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		})
		const json = JSON.parse(response.body)
		for (const c of json.data.repository.cases.hits.edges) {
			for (const s of c.node.samples.hits.edges) {
				const submitter_id = s.node.submitter_id
				for (const p of s.node.portions.hits.edges) {
					for (const a of p.node.analytes.hits.edges) {
						for (const al of a.node.aliquots.hits.edges) {
							const al_id = al.node.submitter_id
							if (queryIds.includes(al_id)) {
								// a match!
								console.log(al_id, submitter_id)
							}
						}
					}
				}
			}
		}
	} catch (error) {
		console.log(error)
	}
})()
