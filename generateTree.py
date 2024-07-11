import json, urllib.request, os
from datetime import datetime

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

# Load base data
pangoURL = "https://raw.githubusercontent.com/MDU-PHL/pango-watch/main/tree/data.json" 
pango = json.load(urllib.request.urlopen(pangoURL))

# Load additional data for Nextstrain clade and designation dates
summaryURL = "https://raw.githubusercontent.com/corneliusroemer/pango-sequences/main/data/pango-consensus-sequences_summary.json" 
summary = json.load(urllib.request.urlopen(summaryURL))

# Generate the tree and output
pango = generateTree(pango, summary)
with open('ncov_tree_data.json', 'w') as f:
    json.dump(pango, f, indent=2)
