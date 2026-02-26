import { getClassifier } from './embeddingClassifier.ts'
import type { ClassificationType, LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'

/**
 * Classify a user query using the hybrid embedding + LLM classifier.
 *
 * @param user_prompt   The raw user query string.
 * @param llm           LLM configuration (provider, model names, API endpoint).
 * @param datasetNoise  Set of uppercase categorical term values from the dataset DB,
 *                      used to avoid false gene-name matches in multi-gene detection.
 * @param dataset_json  The dataset AI configuration (from aifiles JSON), used for
 *                      per-dataset classifier examples and fallback messages.
 * @param datasetLabel  Unique dataset identifier (e.g. "ALL-pharmacotyping").
 * @param aiFilesDir    Directory containing the aifiles JSON (used to resolve
 *                      defaultClassifierExamples.json).
 * @returns             A ClassificationType indicating the query category.
 */
export async function classifyQuery(
	user_prompt: string,
	llm: LlmConfig,
	datasetNoise: Set<string>,
	dataset_json: any,
	datasetLabel: string,
	aiFilesDir: string
): Promise<ClassificationType> {
	const clf = await getClassifier(llm, datasetLabel, dataset_json, aiFilesDir)
	const embeddingResult = await clf.classifyHybrid(user_prompt, llm, datasetNoise)
	mayLog(
		`Embedding classifier: category=${embeddingResult.category}, confidence=${embeddingResult.confidence.toFixed(4)}`
	)

	mayLog('embeddingResult: ', embeddingResult)
	mayLog('embeddingResult.category: ', embeddingResult.category)

	if (embeddingResult.category === 'none') {
		return { type: 'none' }
	}

	if (embeddingResult.category === 'resource') {
		return { type: 'resource' }
	}

	return {
		type: 'plot',
		plot: embeddingResult.category as 'summary' | 'dge' | 'survival' | 'matrix' | 'sampleScatter'
	}
}
