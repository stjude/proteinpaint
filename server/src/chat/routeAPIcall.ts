import type { LlmConfig, ModelConfig } from '#types'
import { ezFetch } from '#shared'
import { mayLog } from '#src/helpers.ts'
import type { MsgToUser } from './scaffoldTypes.ts'
import { isMsgToUser } from './scaffoldTypes.ts'

/**
 * Approximate the number of tokens in a prompt and report whether it
 * exceeds the maximum allowed prompt length.
 *
 * A character-based heuristic (~4 characters per token) is used to approximate the token count.
 */
async function check_prompt_token_length(
	prompt: string,
	llm: LlmConfig,
	maxTokensOverride?: number
): Promise<{ limitExceeded: boolean; tokenCount: number; maxTokens: number } | MsgToUser> {
	const maxTokens = maxTokensOverride ?? llm.model?.maxTokens
	if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens) || maxTokens <= 0) {
		return {
			type: 'text',
			text: 'LLM model configuration is missing a valid maxTokens value in serverconfig.'
		} as MsgToUser
	}
	const tokenCount: number = Math.ceil(prompt.length / 4) // Will later work on a more accurate tokenization method, but this is a reasonable approximation for now.
	return { limitExceeded: tokenCount > maxTokens, tokenCount, maxTokens }
}

export async function route_to_appropriate_llm_provider(
	prompt: string,
	llm: LlmConfig,
	modelOverride?: ModelConfig
): Promise<string | MsgToUser> {
	const modelCfg = modelOverride ?? llm.model
	const model = modelCfg?.modelName
	if (!model) {
		return {
			type: 'text',
			text: 'LLM model configuration is missing a valid modelName value in serverconfig.'
		} as MsgToUser
	}
	if (!modelCfg.maxTokens) {
		return {
			type: 'text',
			text: 'The model is missing a maxTokens value in serverconfig.'
		} as MsgToUser
	}
	const tokenLengthResult = await check_prompt_token_length(prompt, llm, modelCfg?.maxTokens)
	if (isMsgToUser(tokenLengthResult)) return tokenLengthResult
	if (tokenLengthResult.limitExceeded) {
		return {
			type: 'text',
			text: `Prompt exceeds maximum token length for the selected model. Token count for the prompt: ${tokenLengthResult.tokenCount}. Max token limit for ${model} is ${tokenLengthResult.maxTokens}.`
		} as MsgToUser
	}
	let response: string | MsgToUser
	if (llm.provider === 'SJ') {
		// Local SJ server
		response = await call_sj_llm(prompt, model, llm.api)
	} else if (llm.provider === 'ollama') {
		// Ollama server
		response = await call_ollama_llm(prompt, model, llm.api)
	} else if ((llm.provider as string) === 'azure') {
		// Azure server
		if (!llm.apiToken) throw 'Azure provider requires apiToken'
		response = await call_azure_llm(prompt, model, llm.api, llm.apiToken)
	} else {
		throw 'Unknown LLM provider'
	}
	return response
}

export async function route_to_appropriate_embedding_provider(
	templates: string[],
	llm: LlmConfig
): Promise<number[][]> {
	try {
		let response: any
		if (llm.EmbeddingProvider == 'SJ') {
			// Local SJ server
			response = await callSjEmbedding(templates, llm.embeddingModelName, llm.EmbeddingProviderApi)
		} else if (llm.EmbeddingProvider == 'ollama') {
			// Ollama server
			response = await callOllamaEmbedding(templates, llm.embeddingModelName, llm.EmbeddingProviderApi)
		} else if (llm.EmbeddingProvider == 'huggingface') {
			// HuggingFace Inference API
			if (!llm.EmbeddingProviderApiToken) throw 'HuggingFace provider requires apiToken in LlmConfig'
			response = await callHuggingFaceEmbedding(
				templates,
				llm.embeddingModelName,
				llm.EmbeddingProviderApi,
				llm.EmbeddingProviderApiToken
			)
		} else {
			throw `Unknown embedding LLM provider: "${llm.EmbeddingProvider}"`
		}
		return response
	} catch (error) {
		throw 'Error in route_to_appropriate_embedding_provider: ' + error
	}
}

async function call_sj_llm(prompt: string, model_name: string, apilink: string): Promise<string | MsgToUser> {
	const temperature = 0.01
	const top_p = 0.95
	const timeout = 200000
	const max_new_tokens = 512
	// const TOP_LOGPROBS = 2
	const payload = {
		inputs: [
			{
				model_name: model_name,
				inputs: {
					text: prompt,
					max_new_tokens: max_new_tokens,
					temperature: temperature,
					top_p: top_p
					// logprobs: TOP_LOGPROBS
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
			return {
				type: 'text',
				text: 'Error: Received an unexpected response format:' + JSON.stringify(response)
			}
		}
	} catch (error: unknown) {
		console.error('SJ API request failed. Underlying error:', error)
		if (error && typeof error == 'object' && 'cause' in error)
			console.error('Cause:', (error as { cause?: unknown }).cause)
		// Return a user-facing message instead of throwing, so the UI can surface the failure.
		return {
			type: 'text',
			text: 'SJ API request failed: ' + ((error as { message?: string })?.message ?? error)
		}
		// throw 'SJ API request failed:' + error
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
	api: string,
	apiToken: string
): Promise<number[][]> {
	const url = api.replace('modelName', modelName) // Replace "modelName" in the URL with the actual model name
	const result = await ezFetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body: { inputs: texts },
		timeout: { request: 200000 }
	})

	if (result?.error && modelName !== HF_FALLBACK_MODEL) {
		mayLog(`Model ${modelName} returned error — falling back to ${HF_FALLBACK_MODEL}`)
		return callHuggingFaceEmbedding(texts, HF_FALLBACK_MODEL, api, apiToken)
	}

	if (result?.error) {
		throw new Error(`HuggingFace API error: ${JSON.stringify(result.error)}`)
	}

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

async function call_azure_llm(
	prompt: string,
	modelName: string,
	apilink: string,
	apiToken: string
): Promise<string | MsgToUser> {
	const timeout = 200000
	const max_completion_tokens = 5000
	const temperature = 0.01
	const payload = {
		model: modelName,
		temperature: temperature,
		messages: [
			{ role: 'system', content: 'You are a helpful assistant' },
			{ role: 'user', content: prompt }
		],
		max_completion_tokens
	}
	try {
		const response = await ezFetch(apilink, {
			method: 'POST',
			body: payload,
			headers: {
				'Content-Type': 'application/json',
				'api-key': apiToken
			},
			timeout: { request: timeout }
		})
		const content = response?.choices?.[0]?.message?.content
		if (content && content.length > 0) return content
		return {
			type: 'text',
			text: 'Error: Received an unexpected response format:' + JSON.stringify(response)
		} as MsgToUser
	} catch (error) {
		console.log(error)
		return {
			type: 'text',
			text: 'Azure API request failed:' + (error instanceof Error ? error.message : String(error))
		} as MsgToUser
	}
}

async function call_ollama_llm(prompt: string, model_name: string, apilink: string): Promise<string | MsgToUser> {
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
		return {
			type: 'text',
			text: 'Ollama API request failed:' + (error instanceof Error ? error.message : String(error))
		}
	}
}
