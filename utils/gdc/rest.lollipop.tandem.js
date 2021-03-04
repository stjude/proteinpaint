const got = require('got')

const p = {}
for (let i = 2; i < process.argv.length; i++) {
	const [k, v] = process.argv[i].split('=')
	p[k] = v
}
if (!p.isoform) p.isoform = 'ENST00000407796' // AKT1

const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
if (p.token) headers['X-Auth-Token'] = p.token
;(async () => {
	try {
		const id2ssm = new Map()
		const caseidset = new Set()
		const [tmp1, tmp2] = await Promise.all([query_ssms(), query_cases()])
		const re1 = JSON.parse(tmp1.body)
		for (const h of re1.data.hits) {
			if (!h.ssm_id) throw 'ssm_id missing on a ssm'
			h.cases = []
			id2ssm.set(h.ssm_id, h)
		}
		const re2 = JSON.parse(tmp2.body)
		for (const h of re2.data.hits) {
			if (!h.ssm.ssm_id) throw '.ssm.ssm_id missing on a case'
			if (!h.case.case_id) throw '.case.case_id missing on a case'
			const ssm = id2ssm.get(h.ssm.ssm_id)
			if (!ssm) throw 'unknown ssm_id'
			ssm.cases.push(h.case)
			caseidset.add(h.case.case_id)
		}

		console.log(id2ssm.size, ' variants')
		console.log(caseidset.size, ' cases')
	} catch (error) {
		console.log(error)
	}
})()

function get_data() {
	return Promise.all([])
}
function query_ssms() {
	const fields = [
		'ssm_id',
		'chromosome',
		'start_position',
		'reference_allele',
		'tumor_allele',
		'consequence.transcript.transcript_id',
		'consequence.transcript.aa_change',
		'consequence.transcript.consequence_type'
	]
	const filters = {
		op: 'and',
		content: [{ op: '=', content: { field: 'consequence.transcript.transcript_id', value: [p.isoform] } }]
	}
	if (p.set_id) {
		filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
	}
	return got(
		'https://api.gdc.cancer.gov/ssms?size=1000000&fields=' +
			fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(filters)),
		{ method: 'GET', headers }
	)
}
function query_cases() {
	const fields = ['ssm.ssm_id', 'case.project.project_id', 'case.case_id', 'case.primary_site', 'case.disease_type']
	const filters = {
		op: 'and',
		content: [{ op: '=', content: { field: 'ssms.consequence.transcript.transcript_id', value: [p.isoform] } }]
	}
	if (p.set_id) {
		filters.content.push({ op: 'in', content: { field: 'cases.case_id', value: [p.set_id] } })
	}
	return got(
		'https://api.gdc.cancer.gov/ssm_occurrences?size=1000000&fields=' +
			fields.join(',') +
			'&filters=' +
			encodeURIComponent(JSON.stringify(filters)),
		{ method: 'GET', headers }
	)
}
