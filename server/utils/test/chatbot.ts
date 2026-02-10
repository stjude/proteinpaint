// Syntax: cd ~/sjpp && npx tsx proteinpaint/server/utils/test/chatbot.ts

import { readJSONFile, run_chat_pipeline } from '../../routes/termdb.chat.ts'
import serverconfig from '../../src/serverconfig.js'
import type { DEType, FilterTerm, CategoricalFilterTerm, NumericFilterTerm } from '#types'

const testing = true // This causes raw LLM output to be sent by the agent
const llm = serverconfig.llm
if (!llm) throw 'serverconfig.llm is not configured'
if (llm.provider !== 'SJ' && llm.provider !== 'ollama') {
	throw "llm.provider must be 'SJ' or 'ollama'"
}

for (const genome of serverconfig.genomes) {
	for (const dataset of genome.datasets) {
		if (dataset.aifiles) {
			// Check to see if the dataset supports the AI chatbot
			//console.log("dataset:", dataset.aifiles)
			const dataset_json = await readJSONFile(dataset.aifiles) // Read AI JSON data file
			//console.log("dataset_json:", dataset_json)
			const ds = null // Not needed for testing
			for (const test_data of dataset_json.TestData) {
				const test_result = await run_chat_pipeline(
					test_data.question,
					llm,
					serverconfig.aiRoute,
					dataset_json,
					testing,
					serverconfig.tpmasterdir + '/' + dataset_json.db,
					serverconfig.tpmasterdir + '/' + dataset_json.genedb,
					ds
				)
				console.log('test_result:', test_result)
				if (test_result.action == 'html') {
					// Resource request
					if (test_result.response != test_data.answer) {
						console.log(
							'html resource request did not match. LLM response :' +
								test_result.response +
								' Actual response: ' +
								test_data.answer
						)
					}
				} else if (test_result.action == 'summary') {
					if (test_result.response != test_data.answer) {
						console.log(
							'Summary request did not match. LLM response :' +
								test_result.response +
								' Actual response: ' +
								test_data.answer
						)
					}
				} else if (test_result.action == 'dge') {
					if (test_result.response != test_data.answer) {
						//console.log("DE request did not match. LLM response :" + JSON.stringify(test_result.response) + " Actual response: " + JSON.stringify(test_data.answer))
						validate_DE_output(test_result.response, test_data.answer)
					}
				}
			}
		}
	}
}

function validate_DE_output(output_DE_object: DEType, expected_DE_output: DEType): boolean {
	let validate_DE_groups = true
	if (output_DE_object.group1 && expected_DE_output.group1) {
		validate_DE_groups = validate_filter(output_DE_object.group1, expected_DE_output.group1)
	} else {
		console.log('group1 is missing')
		return false
	}

	if (!validate_DE_groups) console.log('group1 not validated')

	if (output_DE_object.group2 && expected_DE_output.group2) {
		validate_DE_groups = validate_filter(output_DE_object.group2, expected_DE_output.group2)
	} else {
		console.log('group2 is missing')
		return false
	}
	if (!validate_DE_groups) console.log('group2 not validated')

	return validate_DE_groups
}

function validate_filter(output_filter: FilterTerm[], expected_filter: FilterTerm[]): boolean {
	if (output_filter.length != expected_filter.length) {
		return false
	} else {
		let filter_term_validation = true
		for (let i = 0; i < output_filter.length; i++) {
			filter_term_validation = validate_each_filter_term(output_filter[i], expected_filter[i]) // Validate each filter term sequentially
			if (filter_term_validation == false) {
				break
			}
		}
		return filter_term_validation
	}
}

function validate_each_filter_term(output_filter_term: FilterTerm, expected_filter_term: FilterTerm): boolean {
	if (
		(output_filter_term as CategoricalFilterTerm).category &&
		(expected_filter_term as CategoricalFilterTerm).category
	) {
		// Both are categorical filter terms
		if (
			output_filter_term.term == expected_filter_term.term &&
			(output_filter_term as CategoricalFilterTerm).category == (expected_filter_term as CategoricalFilterTerm).category
		) {
			return compare_join_terms(output_filter_term, expected_filter_term)
		} else {
			// If term or category fields do not match, fail the test
			return false
		}
	} else if (
		output_filter_term.term == expected_filter_term.term &&
		(output_filter_term as NumericFilterTerm).start == (expected_filter_term as NumericFilterTerm).start &&
		!(output_filter_term as NumericFilterTerm).stop == !(expected_filter_term as NumericFilterTerm).stop
	) {
		// Numeric filter term when only start term is present
		return compare_join_terms(output_filter_term, expected_filter_term)
	} else if (
		output_filter_term.term == expected_filter_term.term &&
		(output_filter_term as NumericFilterTerm).stop == (expected_filter_term as NumericFilterTerm).stop &&
		!(output_filter_term as NumericFilterTerm).start == !(expected_filter_term as NumericFilterTerm).start
	) {
		// Numeric filter term when only stop term is present
		return compare_join_terms(output_filter_term, expected_filter_term)
	} else if (
		output_filter_term.term == expected_filter_term.term &&
		(output_filter_term as NumericFilterTerm).start == (expected_filter_term as NumericFilterTerm).start &&
		(output_filter_term as NumericFilterTerm).stop == (expected_filter_term as NumericFilterTerm).stop
	) {
		// Numeric filter term when both start and stop terms are present
		return compare_join_terms(output_filter_term, expected_filter_term)
	} else {
		// Fail in all other conditions such as if one has only a start and the other only a stop
		return false
	}
}

function compare_join_terms(output_filter_term: FilterTerm, expected_filter_term: FilterTerm): boolean {
	if (output_filter_term.join && expected_filter_term.join) {
		if (output_filter_term.join == expected_filter_term.join) {
			return true
		} else {
			return false
		}
	} else if (
		(output_filter_term.join && !expected_filter_term.join) ||
		(!output_filter_term.join && expected_filter_term.join)
	) {
		// If one term has a join term while the other is missing, filter term comparison fails
		return false
	} else {
		// If both are missing join terms buth other terms are equal pass the test
		return true
	}
}
