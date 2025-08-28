// Syntax: cd .. && cargo build --release && export RUST_BACKTRACE=full && json='{"user_input": "Generate DE plot for men with weight greater than 30lbs vs women less than 20lbs"}' && time echo $json | target/release/aichatbot
use anyhow::Result;
use json::JsonValue;
use rig::agent::AgentBuilder;
use rig::client::CompletionClient;
use rig::client::EmbeddingsClient;
use rig::completion::Prompt;
use rig::embeddings::builder::EmbeddingsBuilder;
use rig::providers::ollama;
use rig::vector_store::in_memory_store::InMemoryVectorStore;
use schemars::JsonSchema;
use serde_json::{Value, json};
use std::fs::File;
use std::io;
use std::io::Read;

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

                    // Initialize Ollama client
                    let ollama_host = "http://0.0.0.0:8000";
                    let ollama_client = ollama::Client::builder()
                        .base_url(ollama_host)
                        .build()
                        .expect("Ollama server not found");
                    //let ollama_client = ollama::Client::new();
                    let embedding_model = ollama_client.embedding_model("nomic-embed-text:latest");
                    let comp_model = ollama_client.completion_model("gpt-oss:20b"); // "granite3-dense:latest" "PetrosStav/gemma3-tools:12b" "llama3-groq-tool-use:latest" "PetrosStav/gemma3-tools:12b"

                    let mut classification: String =
                        classify_query_by_dataset_type(user_input, comp_model.clone(), embedding_model.clone()).await;
                    classification = classification.replace("\"", "");
                    if classification == "dge".to_string() {
                        extract_search_terms_from_query(user_input, comp_model, embedding_model).await;
                    } else if classification == "hierarchial".to_string() {
                        // Not implemented yet
                        println!("Hierarchial clustering not supported yet");
                    } else if classification == "snv_indel".to_string() {
                        // Not implemented yet
                        println!("snv_indel not supported yet");
                    } else if classification == "cnv".to_string() {
                        // Not implemented yet
                        println!("cnv not supported yet");
                    } else if classification == "variant_calling".to_string() {
                        // Not implemented yet
                        println!("variant_calling is not supported in Proteinpaint");
                    } else if classification == "surivial".to_string() {
                        // Not implemented yet
                        println!("survival not supported yet");
                    } else if classification == "none".to_string() {
                        println!("The input query did not match any known features in Proteinpaint");
                    } else {
                        println!("Unknown output:{}", classification);
                    }
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}

async fn classify_query_by_dataset_type(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
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

    let additional = json!({
        "format": schema_json
    });

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
    let agent = AgentBuilder::new(comp_model).preamble("Generate classification for the user query into summary, dge, hierarchial, snv_indel, cnv, variant_calling, sv_fusion and none categories. Return output in JSON with ALWAYS a single word answer { \"answer\": \"dge\" }, that is 'summary' for summary plot, 'dge' for differential gene expression, 'hierarchial' for hierarchial clustering, 'snv_indel' for SNV/Indel, 'cnv' for CNV and 'sv_fusion' for SV/fusion, 'variant_calling' for variant calling, 'surivial' for survival data, 'none' for none of the previously described categories. The answer should always be in lower case").dynamic_context(rag_docs_length, vector_store.index(embedding_model)).temperature(0.0).additional_params(additional).build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama: {}", response);
    let result = response.replace("json", "").replace("```", "");
    //println!("result:{}", result);
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    println!("Classification result:{}", json_value);
    json_value["answer"].to_string()
}

async fn extract_search_terms_from_query(
    user_input: &str,
    comp_model: impl rig::completion::CompletionModel + 'static,
    embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
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

    let additional = json!({
        "format": schema_json
    });

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
        .temperature(0.0)
        .additional_params(additional)
        .build();

    let response = agent.prompt(user_input).await.expect("Failed to prompt ollama");

    //println!("Ollama_groups: {}", response);
    let result = response.replace("json", "").replace("```", "");
    //println!("result_groups:{}", result);
    let json_value: Value = serde_json::from_str(&result).expect("REASON");
    println!("json_value:{}", json_value);
    json_value["answer"].to_string()
}
