import blitzgsea as blitz  
import json 
import time  
import sys  
import sqlite3  
import os  
import numpy as np  
import pandas as pd  

# Helper function to extract gene symbols from a dictionary
def extract_symbols(x):
    return x['symbol']  # Return the 'symbol' field from the dictionary

# Main function
try:
    # Check if there is input from stdin
    if sys.stdin.read(1):
        # Read each line from stdin
        for line in sys.stdin:
            # Parse the JSON input
            json_object = json.loads(line)
            cachedir = json_object['cachedir']  # Get the cache directory from the JSON object
            genes = json_object['genes']  # Get the genes from the JSON object
            fold_change = json_object['fold_change']  # Get the fold change values from the JSON object
            table_name = json_object['geneset_group']  # Get the gene set group from the JSON object
            filter_non_coding_genes = json_object['filter_non_coding_genes']  # Get the filter_non_coding_genes flag from the JSON object
            db = json_object['db']  # Get the database path from the JSON object
            
            # Create a DataFrame for the signature
            df = {'Genes': genes, 'fold_change': fold_change}  # Create a dictionary with genes and fold change
            signature = pd.DataFrame(df)  # Convert the dictionary to a DataFrame
            
            # Connect to the SQLite database
            conn = sqlite3.connect(db)  # Connect to the SQLite database
            cursor = conn.cursor()  # Create a cursor object
            
            # Query to get gene set IDs
            query = f"SELECT id FROM terms WHERE parent_id='{table_name}'"  # SQL query to get gene set IDs
            cursor.execute(query)  # Execute the query
            
            # Filter out non-coding genes if specified
            if filter_non_coding_genes:
                coding_genes_query = "SELECT * FROM codingGenes"  # SQL query to get coding genes
                genedb = json_object['genedb']  # Get the gene database path from the JSON object
                gene_conn = sqlite3.connect(genedb)  # Connect to the gene database
                gene_cursor = gene_conn.cursor()  # Create a cursor object for the gene database
                gene_cursor.execute(coding_genes_query)  # Execute the query to get coding genes
                coding_genes_list = gene_cursor.fetchall()  # Fetch all coding genes
                coding_genes_list = list(map(lambda x: x[0], coding_genes_list))  # Extract the gene symbols
                signature = signature[signature['Genes'].isin(coding_genes_list)]  # Filter the signature to include only coding genes
            
            # Fetch all gene set IDs
            rows = cursor.fetchall()  # Fetch all rows from the executed query
            
            start_loop_time = time.time()  # Record the start time of the loop
            msigdb_library = {}  # Initialize an empty dictionary for the gene set library
            
            # Iterate over gene set IDs and fetch corresponding genes
            for row in rows:
                query2 = f"SELECT genes FROM term2genes WHERE id='{row[0]}'"  # SQL query to get genes for a gene set ID
                cursor.execute(query2)  # Execute the query
                rows2 = cursor.fetchall()  # Fetch all rows from the executed query
                row3 = json.loads(rows2[0][0])  # Parse the JSON data
                msigdb_library[row[0]] = list(map(extract_symbols, row3))  # Extract gene symbols and add to the library
            
            # Close the cursor and connection to the database
            cursor.close()  # Close the cursor
            conn.close()  # Close the connection
            
            stop_loop_time = time.time()  # Record the stop time of the loop
            execution_time = stop_loop_time - start_loop_time  # Calculate the execution time
            print(f"Execution time: {execution_time} seconds")  # Print the execution time
            
            try:
                # Check if geneset_name and pickle_file are present for generating the plot
                geneset_name = json_object['geneset_name']  # Get the gene set name from the JSON object
                pickle_file = json_object['pickle_file']  # Get the pickle file name from the JSON object
                result = pd.read_pickle(os.path.join(cachedir, pickle_file))  # Load the result from the pickle file
                fig = blitz.plot.running_sum(signature, geneset_name, msigdb_library, result=result.T, compact=True)  # Generate the running sum plot
                random_num = np.random.rand()  # Generate a random number
                png_filename = f"gsea_plot_{random_num}.png"  # Create a filename for the plot
                fig.savefig(os.path.join(cachedir, png_filename), bbox_inches='tight')  # Save the plot as a PNG file
                print(f'image: {{"image_file": "{png_filename}"}}')  # Print the image file path in JSON format
            except KeyError:
                # Initial GSEA calculation and save the result to a pickle file
                start_gsea_time = time.time()  # Record the start time of GSEA
                if __name__ == "__main__":
                    result = blitz.gsea(signature, msigdb_library, permutations=1000).T  # Perform GSEA and transpose the result
                    random_num = np.random.rand()  # Generate a random number
                    pickle_filename = f"gsea_result_{random_num}.pkl"  # Create a filename for the pickle file
                    result.to_pickle(os.path.join(cachedir, pickle_filename))  # Save the result to the pickle file
                    gsea_str = f'{{"data": {result.to_json()}}}'  # Convert the result to JSON format
                    pickle_str = f'{{"pickle_file": "{pickle_filename}"}}'  # Create a JSON string for the pickle file
                    gsea_dict = json.loads(gsea_str)  # Parse the JSON string
                    pickle_dict = json.loads(pickle_str)  # Parse the JSON string
                    result_dict = {**gsea_dict, **pickle_dict}  # Merge the dictionaries
                    print(f"result: {json.dumps(result_dict)}")  # Print the result in JSON format
                stop_gsea_time = time.time()  # Record the stop time of GSEA
                gsea_time = stop_gsea_time - start_gsea_time  # Calculate the GSEA execution time
                print(f"GSEA time: {gsea_time} seconds")  # Print the GSEA execution time
    else:
        pass  # Do nothing if there is no input from stdin
except (EOFError, IOError):
    pass  # Handle EOFError and IOError exceptions gracefully

# Function to extract plot data for GSEA visualization
# def extract_plot_data(signature, geneset, library, result, center=True):

#     print("signature", signature)
#     print("result", result)
#     print("geneset", geneset)
#     print("library", library)
#     signature = signature.copy()  # Create a copy of the signature DataFrame
#     signature.columns = ["i", "v"]  # Rename columns to 'i' and 'v'
#     signature = signature.sort_values("v", ascending=False).set_index("i")  # Sort by 'v' in descending order and set 'i' as index
#     signature = signature[~signature.index.duplicated(keep='first')]  # Remove duplicate indices, keeping the first occurrence
    
#     if center:
#         signature.loc[:, "v"] -= np.mean(signature.loc[:, "v"])  # Center the signature values by subtracting the mean
    
#     signature_map = {h: i for i, h in enumerate(signature.index)}  # Create a mapping of signature indices
    
#     gs = set(library[geneset])  # Get the gene set from the library
#     hits = [i for i, x in enumerate(signature.index) if x in gs]  # Find the indices of hits in the signature
    
#     running_sum, es = blitz.enrichment_score(np.array(np.abs(signature.iloc[:, 0])), signature_map, gs)  # Compute running sum and enrichment score
#     running_sum = list(running_sum)  # Convert running sum to a list
#     nn = np.where(np.abs(running_sum) == np.max(np.abs(running_sum)))[0][0]  # Find the index of the maximum absolute running sum
    
#     running_sum_str = [str(elem) for elem in running_sum]  # Convert running sum elements to strings
#     print(f'result: {{"nn": {nn}, "running_sum": "{",".join(running_sum_str)}", "es": {es}}}')  # Print the result in JSON format