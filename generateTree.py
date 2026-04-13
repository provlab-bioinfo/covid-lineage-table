import json, urllib.request, os
from datetime import datetime
import argparse

os.chdir(os.path.dirname(__file__))

def generateTree(node, summary):
    """Adds data to a JSON node. Recursively calls all the children of the node.
    :param node: The 'node'; a dictionary derived from the JSON.
    :return: The node with updated data.
    """    
    if (node.get("name", None) == "root"):
        node["lastChanged"] = datetime.today().strftime('%Y-%m-%d')

    strain = node.get("compressed_name", None)
    node["nextstrain"] = summary.get(strain,{}).get("nextstrainClade","None")
    node["designationDate"] = summary.get(strain,{}).get("designationDate","")
    if (node["designationDate"] == ""): node["designationDate"] = "Unknown"
    children = []
    for child in node["children"]:
        children.append(generateTree(child, summary))
    node["children"] = children
    del node['group']
    return node

parser = argparse.ArgumentParser(description="Generates the tree for the covid-lineage-table")
parser.add_argument('--pango', required=False, help="Manual input of data.json")
parser.add_argument('--summary', required=False, help="Manual input of pango-consensus-sequences_summary.json")
args = parser.parse_args()

# Load base data
data = args.pango
if data is None:
    print("Loading data.json from URL")
    pangoURL = "https://raw.githubusercontent.com/MDU-PHL/pango-watch/main/tree/data.json" 
    data = json.load(urllib.request.urlopen(pangoURL))
else:
    print("Loading data.json manually")
    with open(data) as file:
        data = json.load(file)

# Load additional data for Nextstrain clade and designation dates
summary = args.summary
if summary is None:
    print("Loading pango-consensus-sequences_summary.json from URL")
    summaryURL = "https://raw.githubusercontent.com/corneliusroemer/pango-sequences/main/data/pango-consensus-sequences_summary.json" 
    summary = json.load(urllib.request.urlopen(summaryURL))
else:
    print("Loading data.json manually")
    with open(summary) as file:
        summary = json.load(file)

# Generate the tree and output
pango = generateTree(data, summary)
with open('ncov_tree_data.json', 'w') as f:
    json.dump(pango, f, indent=2)

