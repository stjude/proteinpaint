import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

// Types
interface DescriptionEntry {
	label: string
	value: string
}

interface JsonHtml {
	description: DescriptionEntry[]
}

interface TermRow {
	id: string
	name: string
	type: string
	jsonhtml: string
}

interface TermEmbedding {
	id: string
	name: string
	type: string
	sentences: string[]
	embeddings: number[][]
}

// Config
//const HF_API_TOKEN  = process.env.HF_API_TOKEN ?? "";
const HF_API_TOKEN = '' // Use personal token
const MODEL = 'pritamdeka/S-PubMedBert-MS-MARCO'
const FALLBACK = 'sentence-transformers/all-MiniLM-L6-v2'
const CACHE_FILE = './term-embeddings.json'

// Embedding API
async function getEmbeddings(texts: string[], modelUrl: string = MODEL): Promise<number[][]> {
	const url = `https://router.huggingface.co/hf-inference/models/${modelUrl}/pipeline/feature-extraction`

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${HF_API_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ inputs: texts })
	})

	if (response.status === 404 && modelUrl !== FALLBACK) {
		console.warn(`Model ${modelUrl} returned 404 — falling back to ${FALLBACK}`)
		return getEmbeddings(texts, FALLBACK)
	}

	if (!response.ok) {
		throw new Error(`HF API ${response.status}: ${await response.text()}`)
	}

	const result = (await response.json()) as number[][] | number[][][]

	return (result as any[]).map(item => {
		if (Array.isArray(item[0])) {
			const matrix = item as number[][]
			const vec = new Array<number>(matrix[0].length).fill(0)
			for (const row of matrix) row.forEach((v, i) => (vec[i] += v))
			return vec.map(v => v / matrix.length)
		}
		return item as number[]
	})
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0,
		normA = 0,
		normB = 0
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// read tables from the DB
function readTable(dbPath: string): TermRow[] {
	const db = new Database(dbPath, { readonly: true })
	try {
		const rows = db
			.prepare(
				`
      SELECT t.id, t.name, t.type, h.jsonhtml
      FROM terms t
      INNER JOIN termhtmldef h ON t.id = h.id
    `
			)
			.all() as TermRow[]
		console.log(`Read ${rows.length} rows from DB`)
		return rows
	} finally {
		db.close()
	}
}

// Extract sentences from the descriptions of the DB
function extractSentences(row: TermRow): string[] {
	try {
		const parsed: JsonHtml = JSON.parse(row.jsonhtml)
		return parsed.description
			.filter(d => d.label === 'Details')
			.map(d => d.value)
			.filter(v => v && v.trim().length > 0)
	} catch (e) {
		console.warn(`Failed to parse jsonhtml for id="${row.id}":`, e)
		return []
	}
}

// Write the embeddings to disk
function saveEmbeddings(store: TermEmbedding[]): void {
	fs.mkdirSync(path.dirname(path.resolve(CACHE_FILE)), { recursive: true })
	fs.writeFileSync(CACHE_FILE, JSON.stringify(store))
	console.log(`Saved ${store.length} DB term embeddings → ${CACHE_FILE}`)
}

function loadEmbeddings(): TermEmbedding[] | null {
	if (!fs.existsSync(CACHE_FILE)) return null
	const store = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as TermEmbedding[]
	console.log(`Loaded ${store.length} DB term embeddings from cache`)
	return store
}

// Build embeddings of the DB
async function buildEmbeddingStore(dbPath: string): Promise<TermEmbedding[]> {
	const rows = readTable(dbPath)

	// Flatten all sentences into one array, tracking which row each belongs to
	const allSentences: string[] = []
	const sentenceMap: { rowIndex: number; sentenceIndex: number }[] = []

	rows.forEach((row, rowIndex) => {
		extractSentences(row).forEach((_, sentenceIndex) => {
			allSentences.push(extractSentences(row)[sentenceIndex])
			sentenceMap.push({ rowIndex, sentenceIndex })
		})
	})

	console.log(`Embedding ${allSentences.length} sentences across ${rows.length} rows...`)

	// Single batched API call
	const allEmbeddings = await getEmbeddings(allSentences)

	// Assemble back into per-row structure
	const result: TermEmbedding[] = rows.map(row => ({
		id: row.id,
		name: row.name,
		type: row.type,
		sentences: extractSentences(row),
		embeddings: []
	}))

	sentenceMap.forEach(({ rowIndex, sentenceIndex }, i) => {
		result[rowIndex].embeddings[sentenceIndex] = allEmbeddings[i]
	})

	return result
}

// Load or build the embeddings
async function loadOrBuildEmbeddings(dbPath: string): Promise<TermEmbedding[]> {
	const cached = loadEmbeddings()
	if (cached) return cached

	console.log('No cache found — building from DB...')
	const store = await buildEmbeddingStore(dbPath)
	saveEmbeddings(store)
	return store
}

// Matches query against the DB embeddings
async function querySimilar(
	query: string,
	store: TermEmbedding[],
	topK = 5
): Promise<{ id: string; name: string; sentence: string; score: number }[]> {
	const [queryEmb] = await getEmbeddings([query])

	const scored: { id: string; name: string; sentence: string; score: number }[] = []

	for (const term of store) {
		for (let i = 0; i < term.embeddings.length; i++) {
			scored.push({
				id: term.id,
				name: term.name,
				sentence: term.sentences[i],
				score: cosineSimilarity(queryEmb, term.embeddings[i])
			})
		}
	}

	return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

async function findBestMatch(
	query: string,
	store: TermEmbedding[]
): Promise<{ id: string; name: string; score: number }> {
	const results = await querySimilar(query, store, 1)
	if (results.length === 0) throw new Error('No matches found')
	return { id: results[0].id, name: results[0].name, score: results[0].score }
}

// For Test Purposes
const DB_PATH = '/Users/pshakya/dev/sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest/db'
// Loads from cache if it exists, otherwise builds from DB and saves to cache
const store = await loadOrBuildEmbeddings(DB_PATH)
const match = await findBestMatch('heart rhythm problems', store)
console.log(`Best match → id: "${match.id}"  name: "${match.name}"  score: ${(match.score * 100).toFixed(1)}%`)
