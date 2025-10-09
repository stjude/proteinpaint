// For capturing output from a test, run: cd .. && cargo test -- --nocapture
#[allow(dead_code)]
fn main() {}

#[cfg(test)]
mod tests {
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
        genedb: Option<&str>,
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
        let genedb: Option<&str> = Some("../../server/test/tp/files/hg38/TermdbTest/db");
    }
}
