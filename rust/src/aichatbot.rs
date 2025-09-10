// --------Summary plot examples----------------------//
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary plot for sample information", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show hyperdiploid overlayed with age", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// (does not work)  Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary of fusions in men only", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary plot for fusions in men only", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary plot for sample information", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show hyperdiploid overlayed with age", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://10.200.87.133:32580/v2/models/ray_gateway_router/infer", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text-v1.5", "llm_backend_name": "SJ"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary of fusions in men only", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://10.200.87.133:32580/v2/models/ray_gateway_router/infer", "comp_model_name": "llama3.3-70b-instruct-vllm", "embedding_model_name": "nomic-embed-text-v1.5", "llm_backend_name": "SJ"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary of  molecular subtype in men only", "dataset_file":"src/ALL-pharma_aitrainingdata.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://10.200.87.133:32580/v2/models/ray_gateway_router/infer", "comp_model_name": "llama3.3-70b-instruct-vllm", "embedding_model_name": "nomic-embed-text-v1.5", "llm_backend_name": "SJ"}' && time echo $json | target/release/aichatbot
// -------Differential gene expression examples ------//

// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs", "dataset_file":"sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest/TermdbTest_embeddings.txt", "apilink": "http://0.0.0.0:8000", "comp_model_name": "gpt-oss:20b", "embedding_model_name": "nomic-embed-text:latest", "llm_backend_name": "ollama"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs", "dataset_file":"sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest/TermdbTest_embeddings.txt", "apilink": "http://10.200.87.133:32580/v2/models/ray_gateway_router/infer", "comp_model_name": "llama3.3-70b-instruct-vllm", "embedding_model_name": "multi-qa-mpnet-base-dot-v1", "llm_backend_name": "SJ"}' && time echo $json | target/release/aichatbot
// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Show summary plot for sample information", "dataset_file":"sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest/TermdbTest_embeddings.txt", "dataset_db": "/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/clinical/db8", "apilink": "http://10.200.87.133:32580/v2/models/ray_gateway_router/infer", "comp_model_name": "llama3.3-70b-instruct-vllm", "embedding_model_name": "multi-qa-mpnet-base-dot-v1", "llm_backend_name": "SJ"}' && time echo $json | target/release/aichatbot
use anyhow::Result;
use json::JsonValue;
use r2d2_sqlite::SqliteConnectionManager;
use rig::agent::AgentBuilder;
use rig::client::CompletionClient;
use rig::client::EmbeddingsClient;
use rig::completion::Prompt;
use rig::embeddings::builder::EmbeddingsBuilder;
use std::collections::HashMap;
//use rig::providers::ollama;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use schemars::JsonSchema;
use serde_json::{Value, json};
use std::fs::File;
use std::io::{self, Read};
mod sjprovider; // Importing custom rig module for invoking SJ GPU server

#[allow(non_camel_case_types)]
#[derive(Debug, Clone)]
enum llm_backend {
    Ollama(),
    Sj(),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct OutputJson {
    pub answer: String,
}

#[allow(non_camel_case_types)]
#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
enum cutoff_info {
    lesser(f32),
    greater(f32),
    equalto(f32),
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Cutoff {
    cutoff_name: cutoff_info,
    units: Option<String>,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Filter {
    name: String,
    cutoff: Cutoff,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct Group {
    name: String,
    filter: Filter,
}

#[derive(Debug, JsonSchema)]
#[allow(dead_code)]
struct DEOutput {
    group1: Group,
    group2: Group,
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let user_input_json: &JsonValue = &json_string["user_input"];
                    //let user_input = "Does aspirin leads to decrease in death rates among Africans?";
                    //let user_input = "Show the point deletion in TP53 gene.";
                    //let user_input = "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs";
                    let user_input: &str;
                    match user_input_json.as_str() {
                        Some(inp) => user_input = inp,
                        None => panic!("user_input field is missing in input json"),
                    }

                    let dataset_file_json: &JsonValue = &json_string["dataset_file"];
                    let dataset_file: &str;
                    match dataset_file_json.as_str() {
                        Some(inp) => dataset_file = inp,
                        None => panic!("dataset_file field is missing in input json"),
                    }

                    let dataset_db_json: &JsonValue = &json_string["dataset_db"];
                    let mut dataset_db: Option<&str> = None;
                    match dataset_db_json.as_str() {
                        Some(inp) => dataset_db = Some(inp),
                        None => {}
                    }

                    let apilink_json: &JsonValue = &json_string["apilink"];
                    let apilink: &str;
                    match apilink_json.as_str() {
                        Some(inp) => apilink = inp,
                        None => panic!("apilink field is missing in input json"),
                    }

                    let comp_model_name_json: &JsonValue = &json_string["comp_model_name"];
                    let comp_model_name: &str;
                    match comp_model_name_json.as_str() {
                        Some(inp) => comp_model_name = inp,
                        None => panic!("comp_model_name field is missing in input json"),
                    }

                    let embedding_model_name_json: &JsonValue = &json_string["embedding_model_name"];
                    let embedding_model_name: &str;
                    match embedding_model_name_json.as_str() {
                        Some(inp) => embedding_model_name = inp,
                        None => panic!("embedding_model_name field is missing in input json"),
                    }

                    let llm_backend_name_json: &JsonValue = &json_string["llm_backend_name"];
                    let llm_backend_name: &str;
                    match llm_backend_name_json.as_str() {
                        Some(inp) => llm_backend_name = inp,
                        None => panic!("llm_backend_name field is missing in input json"),
                    }

                    let llm_backend_type: llm_backend;
                    let mut final_output: Option<String> = None;
                    let temperature: f64 = 0.01;
                    let max_new_tokens: usize = 512;
                    let top_p: f32 = 0.95;

                    if llm_backend_name != "ollama" && llm_backend_name != "SJ" {
                        panic!(
                            "This code currently supports only Ollama and SJ provider. llm_backend_name must be \"ollama\" or \"SJ\""
                        );
                    } else if llm_backend_name == "ollama".to_string() {
                        llm_backend_type = llm_backend::Ollama();
                        // Initialize Ollama client
                        let ollama_client = rig::providers::ollama::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("Ollama server not found");
                        let embedding_model = ollama_client.embedding_model(embedding_model_name);
                        let comp_model = ollama_client.completion_model(comp_model_name);
                        final_output = run_pipeline(
                            user_input,
                            comp_model,
                            embedding_model,
                            llm_backend_type,
                            dataset_file,
                            temperature,
                            max_new_tokens,
                            top_p,
                            dataset_db,
                        )
                        .await;
                    // "gpt-oss:20b" "granite3-dense:latest" "PetrosStav/gemma3-tools:12b" "llama3-groq-tool-use:latest" "PetrosStav/gemma3-tools:12b"
                    } else if llm_backend_name == "SJ".to_string() {
                        llm_backend_type = llm_backend::Sj();
                        // Initialize Sj provider client
                        let sj_client = sjprovider::Client::builder()
                            .base_url(apilink)
                            .build()
                            .expect("SJ server not found");
                        let embedding_model = sj_client.embedding_model(embedding_model_name);
                        let comp_model = sj_client.completion_model(comp_model_name);
                        final_output = run_pipeline(
                            user_input,
                            comp_model,
                            embedding_model,
                            llm_backend_type,
                            dataset_file,
                            temperature,
                            max_new_tokens,
                            top_p,
                            dataset_db,
                        )
                        .await;
                    }

                    match final_output {
                        Some(fin_out) => {
                            println!("final_output:{:?}", fin_out);
                        }
                        None => {
                            println!("final_output:{{\"{}\":\"{}\"}}", "chartType", "unknown");
                        }
                    }
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}

async fn run_pipeline(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: llm_backend,
    dataset_file: &str,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: Option<&str>,
) -> Option<String> {
    let mut classification: String = classify_query_by_dataset_type(
        user_input,
        comp_model.clone(),
        embedding_model.clone(),
        &llm_backend_type,
        temperature,
        max_new_tokens,
        top_p,
    )
    .await;
    classification = classification.replace("\"", "");
    let final_output;
    if classification == "dge".to_string() {
        let de_result = extract_search_terms_from_query(
            user_input,
            comp_model,
            embedding_model,
            &llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
        )
        .await;
        final_output = format!(
            "{{\"{}\":\"{}\",\"{}\":[{}}}",
            "chartType",
            "dge",
            "DE_output",
            de_result + &"]"
        );
    } else if classification == "summary".to_string() {
        final_output = extract_summary_information(
            user_input,
            comp_model,
            embedding_model,
            dataset_file,
            &llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
            dataset_db,
        )
        .await;
    } else if classification == "hierarchial".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "hierarchial");
    } else if classification == "snv_indel".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "snv_indel");
    } else if classification == "cnv".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "cnv");
    } else if classification == "variant_calling".to_string() {
        // Not implemented yet and will never be supported. Need a separate messages for this
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "variant_calling");
    } else if classification == "surivial".to_string() {
        // Not implemented yet
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "surivial");
    } else if classification == "none".to_string() {
        final_output = format!("{{\"{}\":\"{}\"}}", "chartType", "none");
        println!("The input query did not match any known features in Proteinpaint");
    } else {
        final_output = format!(
            "{{\"{}\":\"{}\"}}",
            "chartType",
            "unknown:".to_string() + &classification
        );
    }
    Some(final_output)
}

async fn classify_query_by_dataset_type(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
) -> String {
    let file_path = "src/ai_docs3.txt";

    // Open the file
    let mut file = File::open(file_path).unwrap();

    // Create a string to hold the file contents
    let mut contents = String::new();

    // Read the file contents into the string
    file.read_to_string(&mut contents).unwrap();

    // Split the contents by the delimiter "---"
    let parts: Vec<&str> = contents.split("---").collect();
    let schema_json: Value = serde_json::to_value(schemars::schema_for!(OutputJson)).unwrap(); // error handling here

    let additional;
    match llm_backend_type {
        llm_backend::Ollama() => {
            additional = json!({
                    "format": schema_json
            }
                );
        }
        llm_backend::Sj() => {
            additional = json!({
                    "max_new_tokens": max_new_tokens,
                    "top_p": top_p
            });
        }
    }

    // Print the separated parts
    let mut rag_docs = Vec::<String>::new();
    for (_i, part) in parts.iter().enumerate() {
        //println!("Part {}: {}", i + 1, part.trim());
        rag_docs.push(part.trim().to_string())
    }

    let top_k: usize = 3;
    // Create embeddings and add to vector store
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .documents(rag_docs)
        .expect("Reason1")
        .build()
        .await
        .unwrap();

    // Create vector store
    let mut vector_store = InMemoryVectorStore::<String>::default();
    InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

    // Create RAG agent
    let agent = AgentBuilder::new(comp_model).preamble("Generate classification for the user query into summary, dge, hierarchial, snv_indel, cnv, variant_calling, sv_fusion and none categories. Return output in JSON with ALWAYS a single word answer { \"answer\": \"dge\" }, that is 'summary' for summary plot, 'dge' for differential gene expression, 'hierarchial' for hierarchial clustering, 'snv_indel' for SNV/Indel, 'cnv' for CNV and 'sv_fusion' for SV/fusion, 'variant_calling' for variant calling, 'surivial' for survival data, 'none' for none of the previously described categories. The summary plot list and summarizes the cohort of patients according to the user query. The answer should always be in lower case").dynamic_context(top_k, vector_store.index(embedding_model)).temperature(temperature).additional_params(additional).build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama: {}", response);
    let result = response.replace("json", "").replace("```", "");
    println!("result:{}", result);
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    match llm_backend_type {
        llm_backend::Ollama() => json_value["answer"].to_string(),
        llm_backend::Sj() => {
            let json_value2: Value =
                serde_json::from_str(&json_value[0]["generated_text"].to_string()).expect("REASON2");
            //println!("json_value2:{}", json_value2.as_str().unwrap());
            let json_value3: Value = serde_json::from_str(&json_value2.as_str().unwrap()).expect("REASON2");
            //let json_value3: Value = serde_json::from_str(&json_value2["answer"].to_string()).expect("REASON2");
            println!("Classification result:{}", json_value3["answer"]);
            json_value3["answer"].to_string()
        }
    }
}

async fn extract_search_terms_from_query(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
) -> String {
    let file_path = "src/DE_docs2.txt";

    // Open the file
    let mut file = File::open(file_path).unwrap();

    // Create a string to hold the file contents
    let mut contents = String::new();

    // Read the file contents into the string
    file.read_to_string(&mut contents).unwrap();

    // Split the contents by the delimiter "---"
    let parts: Vec<&str> = contents.split("---").collect();

    let schema_json: Value = serde_json::to_value(schemars::schema_for!(DEOutput)).unwrap(); // error handling here

    //println!("DE schema:{}", schema_json);

    let additional;
    match llm_backend_type {
        llm_backend::Ollama() => {
            additional = json!({
                    "format": schema_json
            }
                );
        }
        llm_backend::Sj() => {
            additional = json!({
                    "max_new_tokens": max_new_tokens,
                    "top_p": top_p
            });
        }
    }

    // Print the separated parts
    let mut rag_docs = Vec::<String>::new();
    for (_i, part) in parts.iter().enumerate() {
        //println!("Part {}: {}", i + 1, part.trim());
        rag_docs.push(part.trim().to_string())
    }

    let rag_docs_length = rag_docs.len();
    // Create embeddings and add to vector store
    let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
        .documents(rag_docs)
        .expect("Reason1")
        .build()
        .await
        .unwrap();

    // Create vector store
    let mut vector_store = InMemoryVectorStore::<String>::default();
    InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

    // Create RAG agent
    let router_instructions = "Extract the group variable names for differential gene expression from input query. When two groups are found give the following JSON output show {{\"group1\": {\"name\": \"groupA\"}, \"group2\": {\"name\": \"groupB\"}}}. In case no suitable groups are found, show {\"output\":\"No suitable two groups found for differential gene expression\"}. In case of a continuous variable such as age, height added additional field to the group called \"filter\". This should contain a sub-field called \"names\" followed by a subfield called \"cutoff\". This sub-field should contain a key either greater, lesser or equalto. If the continuous variable has units provided by the user then add it in a separate field called \"units\". User query1: \"Show volcano plot for Asians with age less than 20 and African greater than 80\". Output JSON query1: {\"group1\": {\"name\": \"Asians\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"lesser\": 20}}}, \"group2\": {\"name\": \"African\", \"filter\": {\"name\": \"age\", \"cutoff\": {\"greater\": 80}}}}. User query2: \"Show Differential gene expression plot for males with height greater than 185cm and women with less than 100cm\". Output JSON query2: {\"group1\": {\"name\": \"males\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"greater\": 185, \"units\":\"cm\"}}}, \"group2\": {\"name\": \"women\", \"filter\": {\"name\": \"height\", \"cutoff\": {\"lesser\": 100, \"units\": \"cm\"}}}}. User query3: \"Show DE plot between healthy and diseased groups. Output JSON query3: {\"group1\":{\"name\":\"healthy\"},\"group2\":{\"name\":\"diseased\"}}";
    //println! {"router_instructions:{}",router_instructions};
    let agent = AgentBuilder::new(comp_model)
        .preamble(router_instructions)
        .dynamic_context(rag_docs_length, vector_store.index(embedding_model))
        .temperature(temperature)
        .additional_params(additional)
        .build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama_groups: {}", response);
    let result = response.replace("json", "").replace("```", "");
    //println!("result_groups:{}", result);
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    //println!("json_value:{}", json_value);
    json_value.to_string()
}

struct DbRows {
    name: String,
    description: Option<String>,
    term_type: Option<String>,
    values: Vec<String>,
}

trait ParseDbRows {
    fn parse_db_rows(&self) -> String;
}

impl ParseDbRows for DbRows {
    fn parse_db_rows(&self) -> String {
        let mut output: String = "Name of field is \"".to_string() + &self.name + &"\". ";

        match &self.term_type {
            Some(item_ty) => {
                output += "This field is of the type ";
                output += &item_ty;
                output += &". ";
            }
            None => {}
        }
        match &self.description {
            Some(desc) => output += desc,
            None => {}
        }
        if self.values.len() > 0 {
            output += "This contains the following values (separated by comma(,)):";
            output += &(self.values.join(",") + &".");
        }
        output
    }
}

async fn extract_summary_information(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
    dataset_file: &str,
    llm_backend_type: &llm_backend,
    temperature: f64,
    max_new_tokens: usize,
    top_p: f32,
    dataset_db: Option<&str>,
) -> String {
    match dataset_db {
        Some(db) => {
            // Open the file
            let mut file = File::open(dataset_file).unwrap();

            // Create a string to hold the file contents
            let mut contents = String::new();

            // Read the file contents into the string
            file.read_to_string(&mut contents).unwrap();

            // Split the contents by the delimiter "---"
            let parts: Vec<&str> = contents.split("\n").collect();
            let mut description_map = HashMap::new();
            for (_i, part) in parts.iter().enumerate() {
                let sentence: &str = part.trim();
                let parts2: Vec<&str> = sentence.split(':').collect();
                //println!("parts2:{:?}", parts2);
                if parts2.len() == 2 {
                    description_map.insert(parts2[0], parts2[1]);
                    //println!("Part {}: {:?}", i + 1, parts2);
                }
            }
            println!("description_map:{:?}", description_map);

            let manager = SqliteConnectionManager::file(db);
            let pool = r2d2::Pool::new(manager).unwrap();

            let conn = pool.get().unwrap();
            let sql_statement = "SELECT * from terms";
            let mut terms = conn.prepare(&sql_statement).unwrap();
            let mut rows = terms.query([]).unwrap();

            // Print the separated parts
            let mut rag_docs = Vec::<String>::new();
            let mut names = Vec::<String>::new();
            while let Some(row) = rows.next().unwrap() {
                //println!("row:{:?}", row);
                let name: String = row.get(0).unwrap();
                //println!("id:{}", name);
                match description_map.get(&name as &str) {
                    Some(desc) => {
                        let line: String = row.get(3).unwrap();
                        //println!("line:{}", line);
                        let json_data: Value = serde_json::from_str(&line).expect("Not a JSON");
                        let values_json = json_data["values"].as_object();
                        let mut keys = Vec::<String>::new();
                        match values_json {
                            Some(values) => {
                                for (key, _value) in values {
                                    keys.push(key.to_string())
                                }
                            }
                            None => {}
                        }

                        let item_type_json = json_data["type"].as_str();
                        let mut item_type: Option<String> = None;
                        match item_type_json {
                            Some(item_ty) => item_type = Some(String::from(item_ty)),
                            None => {}
                        }

                        //println!("items:{:?}", keys);
                        let item: DbRows = DbRows {
                            name: name.clone(),
                            description: Some(String::from(*desc)),
                            term_type: item_type,
                            values: keys,
                        };
                        //println!("Field details:{}", item.parse_db_rows());
                        rag_docs.push(item.parse_db_rows());
                        names.push(name)
                    }
                    None => {}
                }
            }
            println!("names:{:?}", names);

            let additional;
            match llm_backend_type {
                llm_backend::Ollama() => {
                    additional = json!({});
                }
                llm_backend::Sj() => {
                    additional = json!({
                            "max_new_tokens": max_new_tokens,
                            "top_p": top_p
                    });
                }
            }

            // Create embeddings and add to vector store
            let embeddings = EmbeddingsBuilder::new(embedding_model.clone())
                .documents(rag_docs)
                .expect("Reason1")
                .build()
                .await
                .unwrap();

            // Create vector store
            let mut vector_store = InMemoryVectorStore::<String>::default();
            InMemoryVectorStore::add_documents(&mut vector_store, embeddings);

            //let system_prompt = "I am an assistant that figures out the summary term from its respective dataset file. Extract the summary term {summary_term} from user query. The final output must be in the following JSON format {{\"chartType\":\"summary\",\"term\":{{\"id\":\"{{summary_term}}\"}}}}";

            let top_k = 3;
            let system_prompt = String::from(
                "I am an assistant that extracts the summary term from user query. It has four fields: group_categories (required), overlay (optional), filter (optional) and divide_by (optional). group_categories (required) is the primary variable being displayed. Overlay consists of the variable that must be overlayed on top of group_categories. divide_by is the variable used to stratify group_categories into two or more categories. The final output must be in the following JSON format with no extra comments: {\"chartType\":\"summary\",\"term\":{\"group_categories\":\"{group_category_answer}\",\"overlay\":\"{overlay_answer}\",\"divide_by\":\"{divide_by_answer}\",\"filter\":\"{filter_answer}\"}}. The values being added to the JSON parameters must be previously defined as field. Sample query1: \"Show ETR1 subtype\" Answer query1: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"ETR1\"}}. Sample query2: \"Show hyperdiploid subtype with age overlayed on top of it\" Answer query2: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"hyperdiploid\", \"overlay\":\"age\"}}. Sample query3: \"Show BAR1 subtype with age overlayed on top of it and stratify it on the basis of gender\" Answer query4: \"{\"chartType\":\"summary\",\"term\":{\"group_categories\":\"BAR1\", \"overlay\":\"age\", \"divide_by\":\"sex\"}}.",
            );
            println!("system_prompt:{}", system_prompt);
            // Create RAG agent
            let agent = AgentBuilder::new(comp_model)
                .preamble(&system_prompt)
                .dynamic_context(top_k, vector_store.index(embedding_model))
                .temperature(temperature)
                .additional_params(additional)
                .build();

            let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

            //println!("Ollama: {}", response);
            let result = response.replace("json", "").replace("```", "");
            //println!("result:{}", result);
            let json_value: Value = serde_json::from_str(&result).expect("REASON");
            //println!("Classification result:{}", json_value);
            json_value.to_string()
        }
        None => {
            panic!("Dataset db file needed for summary term extraction from user input")
        }
    }
}
