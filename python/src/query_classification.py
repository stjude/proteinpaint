# cat ~/sjpp/test.txt | python query_classification.py 

import json
import sys
import requests
from langchain_ollama import ChatOllama

def call_sj_llm(prompt, model_name, apilink):
    payload = {
        "inputs": [
            {
                "model_name": model_name,
                "inputs": {
                    "text": prompt,
                    "max_new_tokens": max_new_tokens,
                    "temperature": temperature,
                    "top_p": top_p
                }
            }
        ]
    }
    
    try:
        response = requests.post(
            apilink,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=2000
        )
        response.raise_for_status()
        
        result = response.json()
        if result and "outputs" in result and isinstance(result["outputs"], list) and len(result["outputs"]) > 0:
            # --- THIS IS THE FIX ---
            # The response is a dict; we need to extract the value from the 'generated_text' key.
            model_output_dict = result["outputs"][0]
            if isinstance(model_output_dict, dict) and 'generated_text' in model_output_dict:
                return model_output_dict['generated_text']
            else:
                # Handle cases where the output might be just a string already
                return str(model_output_dict)
        else:
            return f"Error: Received an unexpected response format: {result}"

    except requests.exceptions.RequestException as e:
        return f"Error: API request failed: {e}"
    
def read_json_file(file_path: str) -> dict:
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)  # Load the JSON data into a dictionary
        return data
    except FileNotFoundError:
        print(f"Error: The file '{file_path}' was not found.")
        return None  # Return None or handle it as needed
    except json.JSONDecodeError:
        print(f"Error: The file '{file_path}' contains invalid JSON.")
        return None  # Return None or handle it as needed


def classify_query_by_dataset_type(user_input, comp_model_name, llm_backend_type, temperature, max_new_tokens, top_p, apilink, aiRoute):
    data=read_json_file(aiRoute)
    contents = data["general"] # The general description should be right at the top of the system prompt
    for key in data.keys(): # Add descriptions of all other agents after the general description
        if key != "general":
            contents += data[key]
    template = contents + " Question: {" + user_input +"} Answer: {answer}"
    response = call_sj_llm(template, comp_model_name, apilink)
    print(response)

    
# Main function
try:
    # Check if there is input from stdin
    if sys.stdin.read(1):
        # Read each line from stdin
        for line in sys.stdin:
            # Parse the JSON input
            json_object = json.loads(line)
            user_input = json_object['user_input']  # Get the user input from the JSON object
            bin_path = json_object['binpath']  # Get serverconfig binpath
            aiRoute_json = json_object['aiRoute'] # The ai JSON file
            apilink = json_object['apilink']
            comp_model_name = json_object['comp_model_name']
            llm_backend_type = json_object['llm_backend_name']
            temperature = 0.01
            max_new_tokens = 512
            top_p = 0.95
            classify_query_by_dataset_type(user_input, comp_model_name, llm_backend_type, temperature, max_new_tokens, top_p, apilink, bin_path + "/../../"  + aiRoute_json)
    else:
        pass  # Do nothing if there is no input from stdin
except (EOFError, IOError):
    pass  # Handle EOFError and IOError exceptions gracefully
