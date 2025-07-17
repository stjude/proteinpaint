import pandas as pd

# Step 1: Read the TSV file into a DataFrame
file_path = 'sample1_umap.txt'  # Replace with your input file path
df = pd.read_csv(file_path, sep='\t')

# Step 2: Insert a new column
# For example, let's add a column named 'NewColumn' with default values
df['cell_type'] = 'Blood'  # Replace with your desired values

# Step 3: Save the updated DataFrame back to a TSV file
output_file_path = 'termdb_sample1_umap.txt'  # Replace with your output file path
df.to_csv(output_file_path, sep='\t', index=False)
