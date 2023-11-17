import json, urllib.request, os

os.chdir(os.path.dirname(__file__))

def addData(node):
    """Adds data to a JSON node. Recursively calls all the children of the node.
    :param node: The 'node'; a dictionary derived from the JSON.
    :return: The node with updated data.
    """    
    strain = node.get("compressed_name", None)
    node["nextstrain"] = summary.get(strain,{}).get("nextstrainClade","None")
    node["designationDate"] = summary.get(strain,{}).get("designationDate","None")
    children = []
    for child in node["children"]:
        children.append(addData(child))
    node["children"] = children
    return node

# Base data
pangoURL = "https://raw.githubusercontent.com/MDU-PHL/pango-watch/main/tree/data.json" 
pango = json.load(urllib.request.urlopen(pangoURL))

# Additional data for Nextstrain clade and designation dates
summaryURL = "https://raw.githubusercontent.com/corneliusroemer/pango-sequences/main/data/pango-consensus-sequences_summary.json" 
summary = json.load(urllib.request.urlopen(summaryURL))

pango = addData(pango)

with open('data_nextstrain.json', 'w') as f:
    json.dump(pango, f)