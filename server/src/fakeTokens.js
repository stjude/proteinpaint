import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'

const fakeToken = {
	dir: path.join(serverconfig.cachedir, 'fakeTokens'),
	time: Math.floor(Date.now() / 1000),
	expiration: 3600 * 24 * 365 // one year, in seconds
}

export async function generateFakeTokens(dslabel, cred, jsonwebtoken) {
	if (!fs.existsSync(fakeToken.dir)) return

	const outputFile = path.join(fakeToken.dir, dslabel, 'fakeJwt.json')
	// ok to not have a file, will generate fake tokens if an input file is found below
	if (fs.existsSync(outputFile)) return

	const inputFile = path.join(fakeToken.dir, dslabel, 'payload.json')
	// ok to not have a file, will not generate fake tokens;
	if (!fs.existsSync(inputFile)) return
	await fs.access(inputFile)
	const { default: payloadByRole } = await import(inputFile, { with: { type: 'json' } })
	const fakeTokensByRole = {}
	for (const [role, payload] of Object.entries(payloadByRole)) {
		const fullPayload = Object.assign(
			{
				iat: fakeToken.time,
				exp: fakeToken.time + fakeToken.expiration,
				email: 'username@test.tld',
				ip: '127.0.0.1'
			},
			payload
		)

		if (!cred?.processor) {
			fakeTokensByRole[role] = jsonwebtoken.sign(fullPayload, cred.secret)
		} else {
			const _ = await import(cred.processor)
			fakeTokensByRole[role] = _.default.generatePayload(fullPayload, cred)
		}
	}
	if (Object.keys(fakeTokensByRole).length) fs.writeFile(outputFile, JSON.stringify(fakeTokensByRole, null, '  '))
}

export async function setFakeTokens(fakeTokens) {
	if (!fs.existsSync(fakeToken.dir)) return
	const dslabels = fs.readdirSync(fakeToken.dir)
	for (const dslabel of dslabels) {
		if (dslabel[0] === '.') continue
		fakeTokens[dslabel] = (await import(`${fakeToken.dir}/${dslabel}/fakeJwt.json`, { with: { type: 'json' } })).default
	}
}
