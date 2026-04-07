import type { LlmConfig } from '#types'
import { ezFetch } from '#shared'

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
	return response
}

// Commented out for now. May uncomment later if we use any of the logic from embeddingClassifier.ts for downstream individual plot agents for the bottom-k approach
export async function route_to_appropriate_embedding_provider(
	templates: string[],
	llm: LlmConfig
): Promise<number[][]> {
	if (llm.provider == 'SJ') {
		// Local SJ server
		return await callSjEmbedding(templates, llm.embeddingModelName, llm.api)
	} else if (llm.provider == 'ollama') {
		// Ollama server
		return await callOllamaEmbedding(templates, llm.embeddingModelName, llm.api)
	} else if (llm.provider == 'huggingface') {
		// HuggingFace Inference API
		return await callHuggingFaceEmbedding(templates, llm.embeddingModelName, llm.api)
	} else {
		throw 'Unknown LLM provider'
	}
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

// Commented out for now. May uncomment later if we use any of the logic from embeddingClassifier.ts for downstream individual plot agents for the bottom-k approach
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

const HF_FALLBACK_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'

export async function callHuggingFaceEmbedding(
	texts: string[],
	modelName: string,
	apiToken: string
): Promise<number[][]> {
	const url = `https://router.huggingface.co/hf-inference/models/${modelName}/pipeline/feature-extraction`
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ inputs: texts })
	})

	if (response.status === 404 && modelName !== HF_FALLBACK_MODEL) {
		console.warn(`Model ${modelName} returned 404 — falling back to ${HF_FALLBACK_MODEL}`)
		return callHuggingFaceEmbedding(texts, HF_FALLBACK_MODEL, apiToken)
	}

	if (!response.ok) {
		throw new Error(`HuggingFace API ${response.status}: ${await response.text()}`)
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
			body: payload,
			headers: { 'Content-Type': 'application/json' },
			timeout: { request: timeout }
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
