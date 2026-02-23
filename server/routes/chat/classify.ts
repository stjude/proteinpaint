import { getClassifier } from '../embeddingClassifier.ts'
import type { ClassificationType, LlmConfig } from '#types'
import { mayLog } from '#src/helpers.ts'

/**
 * Classify a user query using the embedding classifier with LLM fallback.
 *
 * @param user_prompt  The raw user query string.
 * @param llm          LLM configuration (provider, model names, API endpoint).
 * @param datasetNoise Set of uppercase categorical term values from the dataset DB,
 *                     used to avoid false gene-name matches in multi-gene detection.
 * @returns            A ClassificationType indicating the query category.
 */
export async function classifyQuery(
	user_prompt: string,
	llm: LlmConfig,
	datasetNoise: Set<string>
): Promise<ClassificationType> {
	// The classifier is a singleton that loads the model once and reuses it.
	const clf = await getClassifier(llm)
	const embeddingResult = await clf.classifyHybrid(user_prompt, llm, datasetNoise)
	mayLog(
		`Embedding classifier: category=${embeddingResult.category}, confidence=${embeddingResult.confidence.toFixed(4)}`
	)

	if (embeddingResult.category === 'none') {
		return {
			type: 'html',
			html: 'Your query does not appear to be related to the available genomic data visualizations. Please try rephrasing your question about gene expression, differential analysis, sample clustering, or clinical data exploration.'
		}
	}

	return {
		type: 'plot',
		plot: embeddingResult.category as 'summary' | 'dge' | 'survival' | 'matrix' | 'sampleScatter' | 'none' | 'resource'
	}
}
