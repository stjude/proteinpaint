// For capturing output from a test, run: cd .. && cargo test -- --nocapture
// Ignored tests: cd .. && export RUST_BACKTRACE=full && time cargo test -- --ignored --nocapture
#[allow(dead_code)]
fn main() {}

#[cfg(test)]
mod tests {
    use crate::{AiJsonFormat, Charts};
    use serde_json;
    use std::fs::{self};
    use std::path::Path;
    struct UserQuery {
        user_prompt: String,
        has_gene_expression: bool,
        expected_json: String,
        action_type: ActionType,
    }

    enum ActionType {
        // The (ground truth) action type of the query e.g. Summary, DE, survival etc.
        Summary(),
        DE(),
    }

    #[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
    struct ServerConfig {
        tpmasterdir: String,
        llm_backend: String,
        sj_apilink: String,
        sj_comp_model_name: String,
        sj_embedding_model_name: String,
        ollama_apilink: String,
        ollama_comp_model_name: String,
        ollama_embedding_model_name: String,
        genomes: Vec<Genomes>,
    }

    #[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
    struct Genomes {
        name: String,
        datasets: Vec<Dataset>,
    }

    #[derive(PartialEq, Debug, Clone, schemars::JsonSchema, serde::Serialize, serde::Deserialize)]
    struct Dataset {
        name: String,
        aifiles: Option<String>, // For now aifiles are defined only for certain datasets
    }

    #[tokio::test]
    #[ignore]
    async fn user_prompts() {
        let user_prompts = vec![
            UserQuery {
                user_prompt: String::from("Show molecular subtypes for men greater than 60 yrs"),
                has_gene_expression: true,
                action_type: ActionType::Summary(),
                expected_json: String::from(
                    "{\"action\":\"summary\",\"filter\":[{\"Categorical\":{\"term\":\"Sex\",\"value\":\"Male\"}},{\"Numeric\":{\"greaterThan\":60.0,\"lessThan\":null,\"term\":\"Age\"}}],\"summaryterms\":[{\"clinical\":\"Molecular subtype\"}]}",
                ),
            },
            UserQuery {
                user_prompt: String::from("Show TP53 gene expression between genders"),
                has_gene_expression: true,
                action_type: ActionType::Summary(),
                expected_json: String::from(
                    "{\"action\":\"summary\",\"summaryterms\":[{\"clinical\":\"Sex\"},{\"geneExpression\":\"TP53\"}]}",
                ),
            },
        ];
        let termdbtestdb: &str = "../server/test/tp/files/hg38/TermdbTest/db";
        let genedb: &str = "../server/test/tp/anno/genes.hg38.test.db";
        let temperature: f64 = 0.01;
        let max_new_tokens: usize = 512;
        let top_p: f32 = 0.95;
        let serverconfig_file_path = Path::new("../../serverconfig.json");
        let absolute_path = serverconfig_file_path.canonicalize().unwrap();

        // Read the file
        let data = fs::read_to_string(absolute_path).unwrap();

        // Parse the JSON data
        let serverconfig: ServerConfig = serde_json::from_str(&data).expect("JSON not in serverconfig.json format");
        println!("serverconfig:{:?}", serverconfig);

        for genome in &serverconfig.genomes {
            for dataset in &genome.datasets {
                match &dataset.aifiles {
                    Some(ai_json_file) => {
                        println!("Testing dataset:{}", dataset.name);
                        let ai_json_file_path = String::from("../../") + ai_json_file;
                        let ai_json_file = Path::new(&ai_json_file_path);

                        // Read the file
                        let ai_data = fs::read_to_string(ai_json_file).unwrap();
                        // Parse the JSON data
                        let ai_json: AiJsonFormat =
                            serde_json::from_str(&ai_data).expect("AI JSON file does not have the correct format");

                        let genedb = String::from(&serverconfig.tpmasterdir) + &"/" + &ai_json.genedb;
                        let dataset_db = String::from(&serverconfig.tpmasterdir) + &"/" + &ai_json.db;

                        for chart in ai_json.charts.clone() {
                            match chart {
                                Charts::Summary(testdata) => {
                                    for ques_ans in testdata.TestData {
                                        let user_input = ques_ans.question;
                                    }
                                }
                                Charts::DE(testdata) => {} // To do
                            }
                        }
                    }
                    None => {}
                }
            }
        }

        // Initialize Myprovider client
        //let sjprovider_host = json["sj_apilink"].as_str().unwrap();
        //let sjprovider_embedding_model = json["sj_embedding_model_name"].as_str().unwrap();
        //let sjprovider_comp_model = json["sj_comp_model_name"].as_str().unwrap();

        //let sj_client = super::super::sjprovider::Client::builder()
        //    .base_url(sjprovider_host)
        //    .build()
        //    .expect("SJ server not found");
        //let embedding_model = sj_client.embedding_model(sjprovider_embedding_model);
        //let comp_model = sj_client.completion_model(sjprovider_comp_model);
        //let llm_backend_type = super::super::llm_backend::Sj();

        //for user_input in user_prompts {
        //    let llm_output = super::super::run_pipeline(
        //        &user_input.user_prompt,
        //        comp_model.clone(),
        //        embedding_model.clone(),
        //        llm_backend_type.clone(),
        //        temperature,
        //        max_new_tokens,
        //        top_p,
        //        termdbtestdb,
        //        genedb,
        //        user_input.has_gene_expression,
        //    )
        //    .await;

        //    match user_input.action_type {
        //        ActionType::Summary() => {
        //            let llm_json_value: super::super::SummaryType = serde_json::from_str(&llm_output.unwrap()).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
        //            let expected_json_value: super::super::SummaryType = serde_json::from_str(&user_input.expected_json).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
        //            assert_eq!(llm_json_value, expected_json_value);
        //        }
        //        ActionType::DE() => {}
        //    }
        //}
    }
}
