const app = require('./app')

/* characters that are not supposed to be found in names of gene/isoform/chr/snp etc
when these are found, will avoid querying against db or bb file using these strings
as a way to deflect attacks

when names from a genome do contain such characters:
option 1: delete it from this array to disable checking it on all genomes
option 2: set a flag in the genomeobj to disable the check on that character,
          while still allowing to check on other genomes
          see genomicName() for implementation

allowed characters: : . - _
*/
const illegalNameChar = [
	' ',
	',',
	';',
	'~',
	'`',
	'!',
	'@',
	'#',
	'$',
	'%',
	'^',
	'&',
	'*',
	'(',
	')',
	'=',
	'+',
	'{',
	'}',
	'[',
	']',
	'|',
	'\\',
	'/',
	'<',
	'>',
	"'",
	'"',
	'?'
]

const byIpAddr = {}

app.catch = function(req, res, error) {
	const time = +new Date()
	if (!(req.ip in byIpAddr)) {
		byIpAddr[req.ip] = { time, count: 0 }
	}
	if (time - byIpAddr[req.ip].time > 30000) {
		// purge this remote IP address from the tracker
		delete byIpAddr[req.ip]
	} else if (byIpAddr[req.ip].count > 10) {
		res.send({ error: 'busy' })
		// no need to throw and clutter the err log
		return
	} else {
		byIpAddr[req.ip].count++
	}

	res.send({ error })
	throw new Date() + ' ' + error
}

export function middleware(req, res, next) {
	try {
		const q = typeof req.body === 'string' ? JSON.parse(req.body) : req.body // || req.params
		for (const key in q) {
			if (key in byReqKey) q[key] = byReqKey[key](q[key])
		}
		// TODO log() doesn't quite work and should be moved into validate.js
		app.log(req)
		next()
	} catch (e) {
		app.catch(req, res, e.message || e)
	}
}

// consolidate validation functions here
// for server request parameters that are
// shared across different route handlers

export const byReqKey = {
	genome(value) {
		if (typeof value != 'string') throw 'genome should be a non-empty string'
		if (/\s+/.test(value)) throw 'invalid genome character'
		return value
	},
	chr(value) {
		if (typeof value != 'string') throw 'chr should be a string'
		if (/\s+/.test(value)) throw 'invalid chr character'
		return value
	},
	start(value) {
		// do some test on value
		const v = Number(value)
		// more tests?
		return v
	},
	term(value) {
		const termWrapper = JSON.parse(value)
		if (!('id' in termWrapper)) throw 'missing termWrapper.id'
		if (!('q' in termWrapper)) throw 'missing termWrapper.q'
		return termWrapper
	}
}

export const byExpectedVal = {
	alphaNumeric(key, value, res) {
		try {
			if (!value) throw `empty ${key} value`
			if (typeof value != 'string') throw `${key} should be a non-empty alphanumeric string`
			if (/\s+/.test(value)) throw `invalid ${key} character`
			return value
		} catch (error) {
			res.send({ error })
			throw error
		}
	}
}

export function genomicNameLst(lst, genome) {
	// lst is array of gene/isoform/chr/snp names from request parameter
	// skip empty string, non-string, those with illegal characters
	// deduplicate
	if (!Array.isArray(lst)) throw 'input is not array'
	const set = new Set()
	for (const i of lst) {
		if (genomicName(i, genome)) set.add(i)
	}
	return set
}

export function genomicName(str, genome) {
	// if anything invalid, return undefined
	// else, return true
	if (str == '') return // skip empty string
	if (typeof str != 'string') return
	// genome may define if certain characters are allowed for isoform names of a genome
	for (const c of illegalNameChar) {
		/*
		example implementation of allowing certain char for a genome
		if(genome.allowInName_semicolon && c==';') continue
		*/
		if (str.includes(c)) return
	}
	return true
}
