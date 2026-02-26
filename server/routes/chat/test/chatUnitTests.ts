// Syntax: cd ~/sjpp && npx tsx proteinpaint/server/routes/chat/test/chatUnitTests.ts
import path from 'path'
import { readJSONFile } from '../utils.ts'
import { run_chat_pipeline } from '../../termdb.chat2.ts'
import serverconfig from '../../../src/serverconfig.js'
import type {
    DEType,
    SummaryType,
    MatrixType,
    SampleScatterType,
    FilterTerm,
    CategoricalFilterTerm,
    NumericFilterTerm
} from '#types'

const testing = true // This causes raw LLM output to be sent by the agent
const llm = serverconfig.llm
if (!llm) throw 'serverconfig.llm is not configured'
if (llm.provider !== 'SJ' && llm.provider !== 'ollama') {
    throw "llm.provider must be 'SJ' or 'ollama'"
}

export async function test_chatbot_by_dataset(ds: any) {
    // Check to see if the dataset supports the AI chatbot
    //console.log("dataset:", dataset.aifiles)
    if (!(ds as any)?.queries?.chat.aifiles) throw 'AI dataset JSON file is missing for dataset:' + ds.label
    const aifiles = (ds as any)?.queries?.chat.aifiles
    const dataset_json = await readJSONFile(aifiles) // Read AI JSON data file
    //console.log("dataset_json:", dataset_json)
    const aiFilesDir = path.dirname(aifiles)
    for (const test_data of dataset_json.TestData) {
        const test_result = await run_chat_pipeline(
            test_data.question,
            llm,
            serverconfig.aiRoute,
            dataset_json,
            testing, // This is not needed anymore, need to be deprecated
            serverconfig.tpmasterdir + '/' + dataset_json.db,
            serverconfig.tpmasterdir + '/' + dataset_json.genedb,
            ds
        )
        console.log('test_result:', test_result)
        if (test_result.action == 'html') {
            // Resource request
            if (test_result.response != test_data.answer) {
                console.log(
                    'html resource request did not match for prompt' +
                    test_data.question +
                    '. LLM response :' +
                    test_result.response +
                    ' Actual response: ' +
                    test_data.answer
                )
            }
        } else if (test_result.action == 'summary') {
            const validated_llm_summary_output = validate_summary_output(test_result.response, test_data.answer)
            if (!validated_llm_summary_output)
                console.log(
                    'Summary output did not match for prompt' +
                    test_data.question +
                    '. LLM response :' +
                    test_result.response +
                    ' Actual response: ' +
                    test_data.answer
                )
        } else if (test_result.action == 'dge') {
            if (test_result.response != test_data.answer) {
                const validated_llm_DE_output = validate_DE_output(test_result.response, test_data.answer)
                if (!validated_llm_DE_output)
                    console.log(
                        'DE output did not match for prompt' +
                        test_data.question +
                        '. LLM response :' +
                        test_result.response +
                        ' Actual response: ' +
                        test_data.answer
                    )
            }
        } else if (test_result.action == 'matrix') {
            const validated_llm_matrix_output = validate_matrix_output(test_result.response, test_data.answer)
            if (!validated_llm_matrix_output)
                console.log(
                    'Matrix output did not match for prompt' +
                    test_data.question +
                    '. LLM response :' +
                    test_result.response +
                    ' Actual response: ' +
                    test_data.answer
                )
        } else if (test_result.action == 'sampleScatter') {
            const validated_llm_scatter_output = validate_scatter_output(test_result.response, test_data.answer)
            if (!validated_llm_scatter_output)
                console.log(
                    'SampleScatter output did not match for prompt' +
                    test_data.question +
                    '. LLM response :' +
                    test_result.response +
                    ' Actual response: ' +
                    test_data.answer
                )
        }
    }
}

function validate_summary_output(output: SummaryType, expected: SummaryType): boolean {
    if (output.term != expected.term) {
        console.log('Summary term did not match. LLM response: ' + output.term + ' Expected: ' + expected.term)
        return false
    }

    if (output.term2 != expected.term2) {
        console.log('Summary term2 did not match. LLM response: ' + output.term2 + ' Expected: ' + expected.term2)
        return false
    }

    if (!output.simpleFilter && !expected.simpleFilter) {
        return true
    }
    if (!output.simpleFilter || !expected.simpleFilter) {
        console.log(
            'Summary simpleFilter mismatch. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
        return false
    }

    const filter_valid = validate_filter(output.simpleFilter, expected.simpleFilter)
    if (!filter_valid) {
        console.log(
            'Summary simpleFilter did not match. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
    }
    return filter_valid
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

function validate_matrix_output(output: MatrixType, expected: MatrixType): boolean {
    const outputTerms = output.terms || []
    const expectedTerms = expected.terms || []
    if (outputTerms.length != expectedTerms.length || !outputTerms.every((t, i) => t == expectedTerms[i])) {
        console.log(
            'Matrix terms did not match. LLM response: ' +
            JSON.stringify(outputTerms) +
            ' Expected: ' +
            JSON.stringify(expectedTerms)
        )
        return false
    }

    const outputGenes = output.geneNames || []
    const expectedGenes = expected.geneNames || []
    if (outputGenes.length != expectedGenes.length || !outputGenes.every((g, i) => g == expectedGenes[i])) {
        console.log(
            'Matrix geneNames did not match. LLM response: ' +
            JSON.stringify(outputGenes) +
            ' Expected: ' +
            JSON.stringify(expectedGenes)
        )
        return false
    }

    if (!output.simpleFilter && !expected.simpleFilter) {
        return true
    }
    if (!output.simpleFilter || !expected.simpleFilter) {
        console.log(
            'Matrix simpleFilter mismatch. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
        return false
    }

    const filter_valid = validate_filter(output.simpleFilter, expected.simpleFilter)
    if (!filter_valid) {
        console.log(
            'Matrix simpleFilter did not match. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
    }
    return filter_valid
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

function validate_scatter_output(output: SampleScatterType, expected: SampleScatterType): boolean {
    if (output.plotName != expected.plotName) {
        console.log(
            'SampleScatter plotName did not match. LLM response: ' + output.plotName + ' Expected: ' + expected.plotName
        )
        return false
    }

    if (output.colorTW != expected.colorTW) {
        console.log(
            'SampleScatter colorTW did not match. LLM response: ' + output.colorTW + ' Expected: ' + expected.colorTW
        )
        return false
    }

    if (output.shapeTW != expected.shapeTW) {
        console.log(
            'SampleScatter shapeTW did not match. LLM response: ' + output.shapeTW + ' Expected: ' + expected.shapeTW
        )
        return false
    }

    if (output.term0 != expected.term0) {
        console.log('SampleScatter term0 did not match. LLM response: ' + output.term0 + ' Expected: ' + expected.term0)
        return false
    }

    if (!output.simpleFilter && !expected.simpleFilter) {
        return true
    }
    if (!output.simpleFilter || !expected.simpleFilter) {
        console.log(
            'SampleScatter simpleFilter mismatch. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
        return false
    }

    const filter_valid = validate_filter(output.simpleFilter, expected.simpleFilter)
    if (!filter_valid) {
        console.log(
            'SampleScatter simpleFilter did not match. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
    }
    return filter_valid
}

function validate_scatter_output(output: SampleScatterType, expected: SampleScatterType): boolean {
    if (output.plotName != expected.plotName) {
        console.log(
            'SampleScatter plotName did not match. LLM response: ' + output.plotName + ' Expected: ' + expected.plotName
        )
        return false
    }

    if (output.colorTW != expected.colorTW) {
        console.log(
            'SampleScatter colorTW did not match. LLM response: ' + output.colorTW + ' Expected: ' + expected.colorTW
        )
        return false
    }

    if (output.shapeTW != expected.shapeTW) {
        console.log(
            'SampleScatter shapeTW did not match. LLM response: ' + output.shapeTW + ' Expected: ' + expected.shapeTW
        )
        return false
    }

    if (output.term0 != expected.term0) {
        console.log('SampleScatter term0 did not match. LLM response: ' + output.term0 + ' Expected: ' + expected.term0)
        return false
    }

    if (!output.simpleFilter && !expected.simpleFilter) {
        return true
    }
    if (!output.simpleFilter || !expected.simpleFilter) {
        console.log(
            'SampleScatter simpleFilter mismatch. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
        return false
    }

    const filter_valid = validate_filter(output.simpleFilter, expected.simpleFilter)
    if (!filter_valid) {
        console.log(
            'SampleScatter simpleFilter did not match. LLM response: ' +
            JSON.stringify(output.simpleFilter) +
            ' Expected: ' +
            JSON.stringify(expected.simpleFilter)
        )
    }
    return filter_valid
}
