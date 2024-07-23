# cat ~/sjpp/test.txt | python gsea.py

import blitzgsea as blitz
import json
import time
import sys
import sqlite3
import os
import numpy as np
import pandas as pd
            
def extract_symbols(x):
   return x['symbol'] 

def extract_plot_data(signature, geneset, library, result, center=True):
   signature = signature.copy()
   signature.columns = ["i","v"]
   signature = signature.sort_values("v", ascending=False).set_index("i")
   signature = signature[~signature.index.duplicated(keep='first')]
   if center:
       signature.loc[:,"v"] -= np.mean(signature.loc[:,"v"])
   signature_map = {}
   for i,h in enumerate(signature.index):
       signature_map[h] = i
   
   gs = set(library[geneset])
   hits = [i for i,x in enumerate(signature.index) if x in gs]
   
   running_sum, es = blitz.enrichment_score(np.array(np.abs(signature.iloc[:,0])), signature_map, gs)
   running_sum = list(running_sum)
   nn = np.where(np.abs(running_sum)==np.max(np.abs(running_sum)))[0][0]
   #print ("nn:",nn)
   #print ("running_sum:",running_sum)
   #print ("es:",es)
   running_sum_str=[str(elem) for elem in running_sum]
   print ('result: {"nn":'+str(nn)+',"running_sum":"'+",".join(running_sum_str)+'","es":'+str(es)+'}')


# Main function   
try:
    # Try to read a single character from stdin without blocking
    if sys.stdin.read(1):
        # Read from stdin
        for line in sys.stdin:
            # Process each line
            json_object = json.loads(line)
            cachedir=json_object['cachedir']
            genes=json_object['genes']
            fold_change=json_object['fold_change']
            table_name=json_object['geneset_group']
            df = {'Genes': genes, 'fold_change': fold_change}
            signature=pd.DataFrame(df)
            db=json_object['db']
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
            try: # Extract ES data to be plotted on client side
               geneset_name=json_object['geneset_name'] # Checks if geneset_name is present, if yes it indicates the server request is for generating the image. It retrieves the result.pkl file and generates the image without having to recompute gsea again.
               pickle_file=json_object['pickle_file']
               result = pd.read_pickle(os.path.join(cachedir,pickle_file))
               fig = blitz.plot.running_sum(signature, geneset_name, msigdb_library, result=result.T, compact=True)
               random_num = np.random.rand()
               png_filename = "gsea_plot_" + str(random_num) + ".png"
               fig.savefig(os.path.join(cachedir,png_filename), bbox_inches='tight')
               #extract_plot_data(signature, geneset_name, msigdb_library, result) # This returns raw data to client side, not currently used
               print ('image: {"image_file":"' + png_filename + '"}')
            except KeyError: #Initial GSEA calculation, result saved to a result.pkl pickle file               
               # run enrichment analysis
               start_gsea_time = time.time()
               if __name__ == "__main__":
                  result = blitz.gsea(signature, msigdb_library).T
                  random_num = np.random.rand()
                  pickle_filename="gsea_result_"+ str(random_num) +".pkl"
                  result.to_pickle(os.path.join(cachedir,pickle_filename))
                  gsea_str='{"data":' + result.to_json() + '}'
                  pickle_str='{"pickle_file":"' + pickle_filename + '"}'
                  #print ("pickle_file:",pickle_str)
                  gsea_dict = json.loads(gsea_str)
                  pickle_dict = json.loads(pickle_str)
                  result_dict = {**gsea_dict, **pickle_dict}
                  print ("result:",json.dumps(result_dict))
               stop_gsea_time = time.time()   
               gsea_time = stop_gsea_time - start_gsea_time
               print (f"GSEA time: {gsea_time} seconds")
            
    else:
       pass 
except (EOFError, IOError):
    pass
