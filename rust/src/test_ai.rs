// For capturing output from a test, run: cd .. && cargo test -- --nocapture
// Ignored tests: cd .. && export RUST_BACKTRACE=full && time cargo test -- --ignored --nocapture
#[allow(dead_code)]
fn main() {}

#[cfg(test)]
mod tests {
    //use crate::sjprovider::CompletionModel;
    //use crate::sjprovider::EmbeddingModel;
    //use crate::sjprovider;

    use serde_json;
    use std::fs::{self};
    use std::path::Path; // Importing custom rig module for invoking SJ GPU server

    //#[tokio::test]
    #[ignore]
    async fn run_pipeline(
        user_input: &str,
        comp_model: impl rig::completion::CompletionModel + 'static,
        embedding_model: impl rig::embeddings::EmbeddingModel + 'static,
        llm_backend_type: super::super::llm_backend,
        temperature: f64,
        max_new_tokens: usize,
        top_p: f32,
        dataset_db: &str,
        genedb: &str,
        has_gene_expression: bool,
    ) -> Option<String> {
        let final_output = super::super::run_pipeline(
            user_input,
            comp_model,
            embedding_model,
            llm_backend_type,
            temperature,
            max_new_tokens,
            top_p,
            dataset_db,
            genedb,
            has_gene_expression,
        )
        .await;
        final_output
    }

    struct UserQuery {
        user_prompt: String,
        has_gene_expression: bool,
    }

    fn user_prompts() {
        let user_prompts = vec![
            UserQuery {
                user_prompt: String::from("Show molecular subtypes for men reater than 60 yrs"),
                has_gene_expression: true,
            },
            UserQuery {
                user_prompt: String::from("Show TP53 gene expression between genders"),
                has_gene_expression: true,
            },
        ];
        let termdbtestdb: &str = "../../server/test/tp/files/hg38/TermdbTest/db";
        let genedb: &str = "../../server/test/tp/anno/genes.hg38.test.db";
        let temperature: f64 = 0.01;
        let max_new_tokens: usize = 512;
        let top_p: f32 = 0.95;
        let serverconfig_file_path = Path::new("../../serverconfig.json");
        let absolute_path = serverconfig_file_path.canonicalize().unwrap();

        // Read the file
        let data = fs::read_to_string(absolute_path).unwrap();

        // Parse the JSON data
        let json: serde_json::Value = serde_json::from_str(&data).unwrap();

        // Initialize Myprovider client
        let sjprovider_host = json["sj_apilink"].as_str().unwrap();
        let sjprovider_embedding_model = json["sj_embedding_model_name"].as_str().unwrap();
        let sjprovider_comp_model = json["sj_comp_model_name"].as_str().unwrap();

        let sj_client = super::super::sjprovider::Client::builder()
            .base_url(sjprovider_host)
            .build()
            .expect("SJ server not found");
        let embedding_model = sj_client.embedding_model(sjprovider_embedding_model);
        let comp_model = sj_client.completion_model(sjprovider_comp_model);
    }
}
