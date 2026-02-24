import type { LlmConfig } from '#types'
import { ezFetch } from '#shared'
import { getEmbedder } from './embeddingClassifier.ts'

export async function route_to_appropriate_llm_provider(
	template: string,
	llm: LlmConfig,
	modelOverride?: string
): Promise<string> {
	const model = modelOverride ?? llm.modelName
	let response: string
	if (llm.provider == 'SJ') {
		// Local SJ server
		response = await call_sj_llm(template, model, llm.api)
	} else if (llm.provider == 'ollama') {
		// Ollama server
		response = await call_ollama_llm(template, model, llm.api)
	} else {
		// Will later add support for azure server also
		throw 'Unknown LLM provider'
	}
	// Some models (e.g. llama3-8B) wrap JSON in markdown fences and/or
	// append explanations. Extract the first balanced JSON object or array.
	return extractJson(response)
}

export async function route_to_appropriate_embedding_provider(
	templates: string[],
	llm: LlmConfig
): Promise<number[][]> {
	const embedder = await getEmbedder(llm)
	return await embedder.embed(templates)
}

/** Extract the first balanced JSON object or array from a string. */
function extractJson(text: string): string {
	const start = text.search(/[[{]/)
	if (start === -1) return text
	const open = text[start]
	const close = open === '{' ? '}' : ']'
	let depth = 0
	for (let i = start; i < text.length; i++) {
		if (text[i] === open) depth++
		else if (text[i] === close) depth--
		if (depth === 0) return text.slice(start, i + 1)
	}
	return text // unbalanced — return as-is, let JSON.parse give a clear error
}

async function call_sj_llm(prompt: string, model_name: string, apilink: string) {
	const temperature = 0.01
	const top_p = 0.95
	const timeout = 200000
	const max_new_tokens = 512
	const payload = {
		inputs: [
			{
				model_name: model_name,
				inputs: {
					text: prompt,
					max_new_tokens: max_new_tokens,
					temperature: temperature,
					top_p: top_p
				}
			}
		]
	}

	try {
		const response = await ezFetch(apilink, {
			method: 'POST',
			body: payload,
			headers: { 'Content-Type': 'application/json' },
			timeout: { request: timeout }
		})
		if (response.outputs && response.outputs[0] && response.outputs[0].generated_text) {
			const result = response.outputs[0].generated_text
			return result
		} else {
			throw 'Error: Received an unexpected response format:' + response
		}
	} catch (error) {
		throw 'SJ API request failed:' + error
	}
}

export async function callSjEmbedding(texts: string[], modelName: string, api: string): Promise<number[][]> {
	const response = await ezFetch(api, {
		method: 'POST',
		body: {
			inputs: [{ model_name: modelName, inputs: { text: texts } }]
		},
		headers: { 'Content-Type': 'application/json' },
		timeout: { request: 200000 }
	})
	if (response.outputs?.[0]?.embeddings) return response.outputs[0].embeddings
	const apiError = response.outputs?.[0]?.error
	if (apiError) throw new Error(`SJ embedding API error: ${apiError}`)
	throw new Error(`Unexpected response format from SJ embedding API: ${JSON.stringify(response)}`)
}

export async function callOllamaEmbedding(texts: string[], modelName: string, api: string): Promise<number[][]> {
	const result = await ezFetch(api + '/api/embed', {
		method: 'POST',
		body: { model: modelName, input: texts },
		headers: { 'Content-Type': 'application/json' },
		timeout: { request: 200000 }
	})
	if (result?.embeddings?.length > 0) {
		if (result.embeddings.length !== texts.length) throw new Error('Embedding count mismatch')
		return result.embeddings
	}
	throw new Error('Unexpected response format from Ollama embedding API')
}

async function call_ollama_llm(prompt: string, model_name: string, apilink: string) {
	const temperature = 0.01
	const top_p = 0.95
	const timeout = 200000
	const payload = {
		model: model_name,
		messages: [{ role: 'user', content: prompt }],
		raw: false,
		stream: false,
		keep_alive: 15, //Keep the LLM loaded for 15mins
		options: {
			top_p: top_p,
			temperature: temperature,
			num_ctx: 10000
		}
	}

	try {
		const result = await ezFetch(apilink + '/api/chat', {
			method: 'POST',
			body: payload, // ezfetch automatically stringifies objects
			headers: { 'Content-Type': 'application/json' },
			timeout: { request: timeout } // ezfetch accepts milliseconds directly
		})
		if (result && result.message && result.message.content && result.message.content.length > 0)
			return result.message.content
		else {
			throw 'Error: Received an unexpected response format:' + result
		}
	} catch (error) {
		throw 'Ollama API request failed:' + error
	}
}
