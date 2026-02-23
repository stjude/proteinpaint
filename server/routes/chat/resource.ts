import { getEmbedder, cosineSim, argsort } from '../embeddingClassifier.ts'
import { formatTrainingExamples, route_to_appropriate_llm_provider, safeParseLlmJson } from '../termdb.chat2.ts'
import type { LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'
import Database from 'better-sqlite3'
import serverconfig from '../../src/serverconfig.js'

/** In-memory cache of decoded resource embeddings keyed by absolute DB path. */
const resourceDbCache = new Map<string, { texts: string[]; embeddings: number[][] }>()

/**
 * Handle a resource-type query by retrieving relevant context from an optional
 * generalized resource DB and formatting an HTML response via the LLM.
 *
 * Falls back to the Classification SystemPrompt + TrainingData when no
 * resourceDb is configured for the dataset.
 */
export async function extractResourceResponse(
	prompt: string,
	llm: LlmConfig,
	dataset_json: any
): Promise<{ type: 'html'; html: string }> {
	const classification_ds = dataset_json.charts?.find((chart: any) => chart.type == 'Classification')
	if (!classification_ds) {
		return { type: 'html', html: 'No resource information is available for this dataset.' }
	}

	const training_data =
		classification_ds.TrainingData?.length > 0 ? formatTrainingExamples(classification_ds.TrainingData) : ''

	// RAG: retrieve relevant text from the optional generalized resource DB
	let rag_context = ''
	if (dataset_json.resourceDb) {
		try {
			const db_path = serverconfig.tpmasterdir + '/' + dataset_json.resourceDb
			if (!resourceDbCache.has(db_path)) {
				const res_db = new Database(db_path, { readonly: true })
				const rows = res_db.prepare('SELECT text, embedding FROM resources').all() as {
					text: string
					embedding: Buffer
				}[]
				res_db.close()
				resourceDbCache.set(db_path, {
					texts: rows.map(r => r.text),
					embeddings: rows.map(r =>
						Array.from({ length: r.embedding.byteLength / 4 }, (_, i) => r.embedding.readFloatLE(i * 4))
					)
				})
				mayLog(`RAG: loaded ${rows.length} entries from resourceDb into cache`)
			}

			const cached = resourceDbCache.get(db_path)!
			if (cached.embeddings.length > 0) {
				const embedder = await getEmbedder(llm)
				const [query_emb] = await embedder.embed([prompt])
				const storedDim = cached.embeddings[0].length
				const queryDim = query_emb.length
				if (storedDim !== queryDim) {
					mayLog(
						`RAG: resourceDb dimension mismatch — query=${queryDim}d vs stored=${storedDim}d. ` +
							`Rebuild the DB with the currently configured embedding model.`
					)
				} else {
					const sims = cached.embeddings.map(emb => cosineSim(query_emb, emb))
					const top_idx = argsort(sims).slice(-5).reverse()
					rag_context =
						'Relevant resource information:\n' +
						top_idx.map((i, n) => `[${n + 1}] ${cached.texts[i]}`).join('\n\n') +
						'\n'
					mayLog(`RAG: top resource similarity: ${sims[top_idx[0]]?.toFixed(3)}`)
				}
			}
		} catch (e) {
			mayLog('resourceDb RAG error:', e)
		}
	}

	const system_prompt =
		'I am an assistant that provides information and links about this data portal. ' +
		"Answer the user's question using only the provided resource information. " +
		'Format all URLs as clickable HTML links using <a href="url" target="_blank" rel="noopener noreferrer">descriptive text</a>. ' +
		'The final output must be ONLY a JSON object with NO extra comments, in this format: {"type":"html","html":"your html here"}\n' +
		(classification_ds.SystemPrompt ? classification_ds.SystemPrompt + '\n' : '') +
		(rag_context ? rag_context + '\n' : '') +
		(training_data ? 'Training data examples:\n' + training_data + '\n' : '') +
		'Question: {' +
		prompt +
		'} answer:'

	// Use the smaller classifier model for resource responses — it only needs to format
	// retrieved text into HTML, so the full 70B model is unnecessary.
	const response: string = await route_to_appropriate_llm_provider(
		system_prompt,
		llm,
		llm.classifierModelName ?? llm.modelName
	)
	const parsed = safeParseLlmJson(response)

	let html: string
	if (parsed?.type === 'html' && parsed?.html) {
		html = parsed.html
	} else if (typeof parsed === 'string') {
		html = parsed
	} else {
		html = response
	}

	return { type: 'html', html: html }
}
