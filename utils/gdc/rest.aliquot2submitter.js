/*
this script is hosted at https://proteinpaint.stjude.org/GDC/rest.aliquot2submitter.js

examples:

node rest.aliquot2submitter.js # uses 	TCGA-E7-A5KF with AKT1 E17K

// AKT1 E17K with only one case of stomach cancer
node rest.ssm2readdepth.js ssmid=ab96fb54-dfc0-58d9-b727-20a857d58dad filter='{ "op": "and", "content": [ { "op": "in", "content": { "field": "cases.primary_site", "value": [ "stomach" ] } } ] }'

corresponds to variant2samples query in gdc.hg38.js
*/
const got = require('got')
const path = require('path')

// AKT1 E17K
const queryIds = [
	'4c3869ea-2c6f-4439-8b7b-5b33bdbdee57',
	'f1d80d53-6703-442a-a78a-02b7e1400102',
	'c068d628-6d49-485c-9b1a-fba778e27afa',
	'f010c9a7-3514-485d-a100-18d38760b8c8',
	'71c2d95b-0f1d-4c32-ba5b-eb99b89b8b67',
	'fdafddde-aff1-42b4-bf94-a95861eacf53',
	'9d279797-4464-4ef5-8858-640978ccc258',
	'058daa8b-f3ee-4992-b05e-91c13d9945ec',
	'1eb9870a-29fc-4eea-afed-b0b63fac10f1',
	'05618052-7f63-45dc-9a47-df92fce1bad9',
	'9092e087-3e6a-4c5b-a8d7-a7e38a16959e',
	'df82226e-2242-418b-9f5f-0a5e531826a4',
	'de95391f-03e8-4434-919c-d98ec8368f6a',
	'f04e89dc-47cb-4c84-a5f8-9a1856ecc794',
	'78c3c787-5731-4c38-8d7a-e5b503b11c36',
	'e6101e95-5296-4040-af52-0159a21e63b5',
	'928d08f0-043a-4caa-9a0f-af5bb09732c0',
	'f6b8b1a9-370c-4023-b8bd-934e2a3d913a',
	'53d55f5a-df86-44d7-a3a2-2dccc2557b7b',
	'01d3fddf-b447-4925-a5cb-c5fd70c97278',
	'81aed169-683a-4f6c-949b-118e09301707',
	'25b8270f-ef0c-47a6-ac0a-021b886992bf',
	'ab9bf7a6-688e-4388-9682-6b1616723fde',
	'5c2717b7-9d81-448f-9668-f08aad61c20c',
	'06d51140-9d6f-40be-a1b1-adbca81b936b',
	'807791d8-b6c0-4722-bf5c-d5fa30baffc6',
	'6d8f8127-ca6c-4e64-9d5f-a92bc489b9e8',
	'1574457b-fc50-4b43-a182-078e0a2fe9df',
	'f9159100-2b88-4427-a998-18128c25c730',
	'10885a15-ad5c-400b-8d4d-e0ceb8370a18',
	'd2886f0c-7985-4873-b8b4-e2071c98febe',
	'b7ce156e-7ea9-4a0b-ae15-1f310abfc0ee',
	'6c5a83f5-983f-434c-ac29-ddb84a7f1019',
	'bfccfb23-fed5-4a49-b18a-09aa91f2c36a',
	'81e4b7a4-8d94-4d31-9c08-325ee04f5f36',
	'4fe1aac3-4bf0-4ceb-a371-c129d5fac28d',
	'bb2608a3-3637-45ff-ae47-7367090fcdc5',
	'0f2b1ec3-597c-4509-aeae-07e57367fd72',
	'9bec02b4-7cf0-4797-b1ac-253ef78a34af',
	'7bf4a4b3-afb8-4494-b749-7138b223fc6f',
	'74482437-8aa2-4731-88f2-499e2addb5d3',
	'55c547ee-7cc9-4b7a-aaca-22f2a8c8c3a4',
	'1c98371f-c999-4e04-b0a0-cc1de36746e3',
	'6f6202ce-fb91-4f83-9730-d202b75ea0ec',
	'637ce92c-479a-4333-a272-a3bc97468267',
	'58b76940-060d-4220-af98-1c515b4968de',
	'0385961e-ea99-40b2-ad79-6872bc30d8a1',
	'92126163-00c3-41f2-9ce6-7aad5f621407',
	'b5163e0b-8e53-4634-ae31-750c4d6c7962',
	'63ea274b-d42b-4787-9c54-8ee95ea376ec',
	'94011b46-74e3-41c1-a3f6-6db1821d1778',
	'8356de8c-a93f-4dc6-8db0-31fefb435baf',
	'd40c51cc-711e-4b90-8f25-f33a8f53b5e9',
	'42993dbb-b99b-4b48-8038-05cf14fec886',
	'0ebb7058-4311-40a6-ac47-6b5f0c38492f',
	'a50cd2b2-913d-41bf-94ad-45464547b348',
	'3cfe99c1-861f-4719-bbec-7c882b042023',
	'730bae4e-c5ba-436b-9f0c-f81b7efcbd43',
	'5a535c49-d42e-43c6-9d32-dc76f28d4f0f',
	'88104fc0-ddc9-49b6-b136-61dbed5a7f3d',
	'676d4bc5-80c2-4db8-94b1-3dea2aed054a'
]

const p = get_parameter()
const filters = get_filters(p)

;(async () => {
	try {
		const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
		if (p.token) headers['X-Auth-Token'] = p.token

		const response = await got.post('https://api.gdc.cancer.gov/cases', {
			headers,
			body: JSON.stringify({
				size: 10000,
				fields: 'samples.submitter_id,samples.portions.analytes.aliquots.aliquot_id',
				filters
			})
		})

		const aliquotSet = new Set(p.aliquot.split(','))

		const re = JSON.parse(response.body)

		for (const h of re.data.hits) {
			for (const sample of h.samples) {
				const matchingAliquot = getMatchingAliquot(sample, aliquotSet)

				console.log(sample.submitter_id, matchingAliquot || '---')
			}
		}
	} catch (error) {
		console.log(error)
	}
})()

function getMatchingAliquot(sample, aliquotSet) {
	if (!sample.portions) return
	for (const portion of sample.portions) {
		if (!portion.analytes) continue
		for (const analyte of portion.analytes) {
			if (!analyte.aliquots) continue
			for (const aliq of analyte.aliquots) {
				if (aliquotSet.has(aliq.aliquot_id)) return aliq.aliquot_id
			}
		}
	}
}

function get_parameter() {
	const p = {}
	for (let i = 2; i < process.argv.length; i++) {
		const [k, v] = process.argv[i].split('=')
		p[k] = v
	}
	if (!p.aliquot) p.aliquot = queryIds.join(',')
	return p
}
function get_filters(p) {
	const filters = {
		op: 'and',
		content: [
			{
				op: '=',
				content: { field: 'samples.portions.analytes.aliquots.aliquot_id', value: p.aliquot.split(',') }
			}
		]
	}

	return filters
}
