# 'cat ~/sjpp/test.txt | python gsea.py

import blitzgsea as blitz
import json
import time
import sys
import sqlite3
import pandas as pd

            
def extract_symbols(x):
   return x['symbol'] 

try:
    # Try to read a single character from stdin without blocking
    if sys.stdin.read(1):
        # Read from stdin
        for line in sys.stdin:
            # Process each line
            json_object = json.loads(line)
            db=json_object['db']
            table_name=json_object['gene_set_group']
            genes=json_object['genes']
            fold_change=json_object['fold_change']
            df = {'Genes': genes, 'fold_change': fold_change}
            
            # Connect to the SQLite database
            conn = sqlite3.connect(db)
            
            # Create a cursor object using the cursor() method
            cursor = conn.cursor()
            
            # SQL query to select all data from the table
            query = f"select id from terms where parent_id='" + table_name  + "'"
            
            # Execute the SQL query
            cursor.execute(query)
            
            # Fetch all rows from the executed SQL query
            rows = cursor.fetchall()
            
            
            start_loop_time = time.time()
            msigdb_library={} 
            # Iterate over the rows and print them
            for row in rows:
                #print(row[0])
                query2=f"select genes from term2genes where id='" + row[0]  + "'"
                cursor.execute(query2)
                rows2 = cursor.fetchall()
                row3=json.loads(rows2[0][0])
                msigdb_library[row[0]] = list(map(extract_symbols,row3))
            
            #print ("msigdb_library:",msigdb_library)
            # Close the cursor and connection to the database
            cursor.close()
            conn.close()
            stop_loop_time = time.time()
            execution_time = stop_loop_time - start_loop_time
            print(f"Execution time: {execution_time} seconds")
            signature=pd.DataFrame(df)
            
            # run enrichment analysis
            start_gsea_time = time.time()
            if __name__ == "__main__":
               result = blitz.gsea(signature, msigdb_library).T
               print ("result:",result.to_json())
            stop_gsea_time = time.time()   
            gsea_time = stop_gsea_time - start_gsea_time
            print (f"GSEA time: {gsea_time} seconds")
            
    else:
       pass 
except (EOFError, IOError):
    pass
