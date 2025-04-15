use extendr_api::prelude::*;
use std::time::Instant;

/// Return string `"Hello world!"` to R.
/// @export
#[extendr]
fn hello_world() -> &'static str {
    "Hello world!"
}

/// @export
#[extendr]
fn add(x: f64, y: f64) -> f64 {
    x + y
}

/// @export
#[extendr]
fn differential_gene_expression(
    case_string: String,
    control_string: String,
    file_name: String,
) -> Robj {
    let now = Instant::now();
    let case_list: Vec<&str> = case_string.split(",").collect();
    let control_list: Vec<&str> = control_string.split(",").collect();
    let a = 1;
    let b = R!(r"
                        x <- {{ a }}
                        x + 1
                    ")
    .unwrap();
    b
}

// Macro to generate exports.
// This ensures exported functions are registered with R.
// See corresponding C code in `entrypoint.c`.
extendr_module! {
    mod RustRUtilities;
    fn hello_world;
    fn add;
}
