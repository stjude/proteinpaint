import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
import type { MultiomicRankingsRequest, MultiomicRankingsResponse, RouteApi } from '#types'
import { multiomicRankingsPayload } from '#types/checkers'

export const api: RouteApi = {
	endpoint: 'termdb/multiomicRankings',
	methods: {
		get: { ...multiomicRankingsPayload, init },
		post: { ...multiomicRankingsPayload, init }
	}
}

type ParsedFile = { columns: string[]; rows: (string | number | null)[][] }
type CacheEntry = { parsed: ParsedFile; mtimeMs: number }
const fileCache: Map<string, CacheEntry> = new Map()

function stripQuotes(s: string): string {
	if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1)
	return s
}

async function parseTsv(absPath: string): Promise<ParsedFile> {
	const text = await fs.promises.readFile(absPath, 'utf8')
	const lines = text.split(/\r?\n/).filter(l => l.length > 0)
	if (lines.length === 0) return { columns: [], rows: [] }
	const columns = lines[0].split('\t').map(stripQuotes)
	const rows: (string | number | null)[][] = []
	for (let i = 1; i < lines.length; i++) {
		const fields = lines[i].split('\t').map(stripQuotes)
		const normalizedFields =
			fields.length < columns.length
				? fields.concat(Array(columns.length - fields.length).fill(''))
				: fields.slice(0, columns.length)
		const row: (string | number | null)[] = normalizedFields.map(v => {
			if (v === '' || v === 'NA' || v === 'NaN') return null
			const n = Number(v)
			return Number.isFinite(n) && v.trim() !== '' ? n : v
		})
		rows.push(row)
	}
	return { columns, rows }
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: MultiomicRankingsRequest = (req.method === 'POST' ? req.body : req.query) || {}
			const genome = genomes[q.genome]
			if (!genome) throw 'invalid genome'
			const ds = genome.datasets[q.dslabel]
			if (!ds) throw 'invalid dslabel'
			const cfg = ds.queries?.multiomicRankings as
				| { rankings: Record<string, string>; modalities?: string[]; description?: string }
				| undefined
			if (!cfg || !cfg.rankings) throw 'multiomicRankings not configured for this dataset'

			if (!q.key) {
				res.send({ keys: Object.keys(cfg.rankings) } satisfies MultiomicRankingsResponse)
				return
			}

			const relPath = cfg.rankings[q.key]
			if (!relPath) throw 'invalid key'
			if (path.isAbsolute(relPath) || relPath.split(/[\\/]/).includes('..')) throw 'invalid file path'

			const absPath = path.resolve(serverconfig.tpmasterdir, relPath)
			const tpRoot = path.resolve(serverconfig.tpmasterdir) + path.sep
			if (!absPath.startsWith(tpRoot)) throw 'invalid file path'

			const stat = await fs.promises.stat(absPath)
			const cacheKey = `${q.genome}|${q.dslabel}|${q.key}`
			let entry = fileCache.get(cacheKey)
			if (!entry || entry.mtimeMs !== stat.mtimeMs) {
				entry = { parsed: await parseTsv(absPath), mtimeMs: stat.mtimeMs }
				fileCache.set(cacheKey, entry)
			}
			res.send({ columns: entry.parsed.columns, rows: entry.parsed.rows } satisfies MultiomicRankingsResponse)
		} catch (e: any) {
			if (e instanceof Error && e.stack) console.log(e)
			res.send({ error: e?.message || String(e) } satisfies MultiomicRankingsResponse)
		}
	}
}
