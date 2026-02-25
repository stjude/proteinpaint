import { getClassifier } from './embeddingClassifier.ts'
import type { ClassificationType, LlmConfig } from '#types'
import { chatLog } from './chatLog.ts'

/** Map dataset JSON chart types to user-friendly descriptions for the fallback message. */
const CHART_TYPE_DESCRIPTIONS: Record<string, string> = {
	Classification: 'resource links and publications',
	Summary: 'summary plots',
	DE: 'differential expression',
	Matrix: 'gene expression matrices',
	sampleScatter: 'sample scatter plots (t-SNE, UMAP)',
	survival: 'survival analysis'
}

/** Build a fallback message from the dataset's configured chart types. */
function buildUnrecognizedMessage(dataset_json: any): string {
	const charts: { type: string }[] = dataset_json?.charts ?? []
	const descriptions = charts.map(c => CHART_TYPE_DESCRIPTIONS[c.type]).filter((d): d is string => !!d)

	if (descriptions.length === 0) {
		return 'Your query does not appear to be related to the available data visualizations. Please try rephrasing your question.'
	}

	const list =
		descriptions.length === 1
			? descriptions[0]
			: descriptions.slice(0, -1).join(', ') + ', or ' + descriptions[descriptions.length - 1]

	return `Your query does not appear to be related to the available data visualizations. Please try rephrasing your question about ${list}.`
}

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
	chatLog(
		`Embedding classifier: category=${embeddingResult.category}, confidence=${embeddingResult.confidence.toFixed(4)}`
	)

	if (embeddingResult.category === 'none') {
		return {
			type: 'html',
			html: buildUnrecognizedMessage(dataset_json)
		}
	}

	return {
		type: 'plot',
		plot: embeddingResult.category
	}
}
