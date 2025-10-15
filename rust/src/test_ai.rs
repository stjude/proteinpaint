// For capturing output from a test, run: cd .. && cargo test -- --nocapture
// Ignored tests: cd .. && export RUST_BACKTRACE=full && time cargo test -- --ignored --nocapture
#[allow(dead_code)]
fn main() {}

#[cfg(test)]
mod tests {
    use serde_json;
    use std::fs::{self};
    use std::path::Path;

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
        let temperature: f64 = 0.01;
        let max_new_tokens: usize = 512;
        let top_p: f32 = 0.95;
        let serverconfig_file_path = Path::new("../../serverconfig.json");
        let absolute_path = serverconfig_file_path.canonicalize().unwrap();

        // Read the file
        let data = fs::read_to_string(absolute_path).unwrap();

        // Parse the JSON data
        let serverconfig: ServerConfig = serde_json::from_str(&data).expect("JSON not in serverconfig.json format");

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
                        let ai_json: super::super::AiJsonFormat =
                            serde_json::from_str(&ai_data).expect("AI JSON file does not have the correct format");
                        //println!("ai_json:{:?}", ai_json);
                        let genedb = String::from(&serverconfig.tpmasterdir) + &"/" + &ai_json.genedb;
                        let dataset_db = String::from(&serverconfig.tpmasterdir) + &"/" + &ai_json.db;
                        let llm_backend_name = &serverconfig.llm_backend;
                        let llm_backend_type: super::super::llm_backend;

                        if llm_backend_name != "ollama" && llm_backend_name != "SJ" {
                            panic!(
                                "This code currently supports only Ollama and SJ provider. llm_backend_name must be \"ollama\" or \"SJ\""
                            );
                        } else if *llm_backend_name == "ollama".to_string() {
                            let ollama_host = &serverconfig.ollama_apilink;
                            let ollama_embedding_model_name = &serverconfig.ollama_embedding_model_name;
                            let ollama_comp_model_name = &serverconfig.ollama_comp_model_name;
                            llm_backend_type = super::super::llm_backend::Ollama();
                            let ollama_client = super::super::ollama::Client::builder()
                                .base_url(ollama_host)
                                .build()
                                .expect("Ollama server not found");
                            let embedding_model = ollama_client.embedding_model(ollama_embedding_model_name);
                            let comp_model = ollama_client.completion_model(ollama_comp_model_name);

                            for chart in ai_json.charts.clone() {
                                match chart {
                                    super::super::Charts::Summary(testdata) => {
                                        for ques_ans in testdata.TestData {
                                            let user_input = ques_ans.question;
                                            let llm_output = super::super::run_pipeline(
                                                &user_input,
                                                comp_model.clone(),
                                                embedding_model.clone(),
                                                llm_backend_type.clone(),
                                                temperature,
                                                max_new_tokens,
                                                top_p,
                                                &dataset_db,
                                                &genedb,
                                                &ai_json,
                                            )
                                            .await;
                                            let llm_json_value: super::super::SummaryType = serde_json::from_str(&llm_output.unwrap()).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
                                            let expected_json_value: super::super::SummaryType = serde_json::from_str(&ques_ans.answer).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
                                            assert_eq!(llm_json_value, expected_json_value);
                                        }
                                    }
                                    super::super::Charts::DE(_testdata) => {} // To do
                                }
                            }
                        } else if *llm_backend_name == "SJ".to_string() {
                            let sjprovider_host = &serverconfig.sj_apilink;
                            let sj_embedding_model_name = &serverconfig.sj_embedding_model_name;
                            let sj_comp_model_name = &serverconfig.sj_comp_model_name;
                            llm_backend_type = super::super::llm_backend::Sj();
                            let sj_client = super::super::sjprovider::Client::builder()
                                .base_url(sjprovider_host)
                                .build()
                                .expect("SJ server not found");
                            let embedding_model = sj_client.embedding_model(sj_embedding_model_name);
                            let comp_model = sj_client.completion_model(sj_comp_model_name);

                            for chart in ai_json.charts.clone() {
                                match chart {
                                    super::super::Charts::Summary(testdata) => {
                                        for ques_ans in testdata.TestData {
                                            let user_input = ques_ans.question;
                                            if user_input.len() > 0 {
                                                let llm_output = super::super::run_pipeline(
                                                    &user_input,
                                                    comp_model.clone(),
                                                    embedding_model.clone(),
                                                    llm_backend_type.clone(),
                                                    temperature,
                                                    max_new_tokens,
                                                    top_p,
                                                    &dataset_db,
                                                    &genedb,
                                                    &ai_json,
                                                )
                                                .await;
                                                let llm_json_value: super::super::SummaryType = serde_json::from_str(&llm_output.unwrap()).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
                                                let expected_json_value: super::super::SummaryType = serde_json::from_str(&ques_ans.answer).expect("Did not get a valid JSON of type {action: summary, summaryterms:[{clinical: term1}, {geneExpression: gene}], filter:[{term: term1, value: value1}]} from the LLM");
                                                assert_eq!(llm_json_value, expected_json_value);
                                            } else {
                                                panic!("The user input is empty");
                                            }
                                        }
                                    }
                                    super::super::Charts::DE(_testdata) => {} // To do
                                }
                            }
                        }
                    }
                    None => {}
                }
            }
        }
    }
}
