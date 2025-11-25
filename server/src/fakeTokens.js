import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'
import jsonwebtoken from 'jsonwebtoken'

/*
	See https://github.com/stjude/proteinpaint/wiki/Dataset-Tokens
	for step-by-step instructions of triggering these code
*/

const fakeToken = {
	dir: path.join(serverconfig.cachedir, 'fakeTokens'),
	time: Math.floor(Date.now() / 1000),
	expiration: 3600 * 24 * 365 // one year, in seconds
}

if (!fs.existsSync(fakeToken.dir)) fs.mkdirSync(fakeToken.dir)

// generateFakeTokens()
// - read example payloads from `${fakeTokens.dir}/${dslabel}/payload.json` to generate `fakeJwt.json` in the same dir
//
// dslabel: dataset name for an entry in serverconfig.genomes[].datasets[]
// cred: a dsCredential entry, at the level of dslabel-route-embedder, as processed by auth.js
//
export async function mayGenerateFakeTokens(dslabel, cred) {
	const outputFile = path.join(fakeToken.dir, dslabel, 'fakeJwt.json')
	// ok to not have an output file, will generate it if an input file is found below
	if (fs.existsSync(outputFile)) return

	const inputFile = path.join(fakeToken.dir, dslabel, 'payload.json')
	if (!fs.existsSync(inputFile)) return // ok to not have an input file, will not generate fake tokens for the dslabel
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
			fakeTokensByRole[role] = cred.processor.generatePayload(fullPayload, cred)
		}
	}
	if (Object.keys(fakeTokensByRole).length) fs.writeFileSync(outputFile, JSON.stringify(fakeTokensByRole, null, '  '))
}

// setFakeTokens()
// - adds an entry to serverconfig.features.fakeTokens{} for each `${fakeTokens.dir}/${dslabel}/fakeJwt.json` that's read by `setFakeTokens()`
export async function maySetFakeTokens(fakeTokens, _dslabel) {
	if (!fakeTokens) return
	const dslabels = _dslabel ? [_dslabel] : fs.readdirSync(fakeToken.dir)

	for (const dslabel of dslabels) {
		if (dslabel[0] === '.') continue // skip hidden files
		const outfile = `${fakeToken.dir}/${dslabel}/fakeJwt.json`
		if (!fs.existsSync(outfile)) continue
		const jwtStr = fs.readFileSync(outfile, { encoding: 'utf8' })
		const jwtByRole = JSON.parse(jwtStr)
		fakeTokens[dslabel] = Object.assign(
			jwtByRole,
			fakeTokens[dslabel] || {} // manual entries in serverconfig.json should not be overriden by auto-generated entries in fakeJwt.json
		)
	}
}
