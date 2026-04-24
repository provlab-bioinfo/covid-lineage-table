import json, urllib.request, os
from datetime import datetime
import typer
from file import File
from db import DB
from pango_aliasor.aliasor import Aliasor

os.chdir(os.path.dirname(__file__))

def check_pango_designation(path = "../data/db.json", url = "https://api.github.com/repos/cov-lineages/pango-designation/contents/lineage_notes.txt?ref=master"):
    # load the db
    db = DB(path=path)

    new_file = File.from_url(url)

    last_file = db.get_last()

    # check for sha in db
    if last_file.sha == new_file.sha:
        # if sha in db no change
        typer.echo("No change!")
        return typer.Exit()

    last_text = last_file.text
    diff = new_file.diff(last_text)
    changes: list = db.get("changes")
    changes.append(
        {"sha": new_file.sha, "datetime": str(datetime.now()), "changes": diff}
    )
    db.put("changes", changes)
    db.put("last", new_file.data)

def create_tree(path = "../data/db.json"):
    aliasor = Aliasor()
    db = DB(path=path)
    last_file = db.get_last()
    last_text = last_file.text
    lineages = []
    groups = []
    alias_key = load_alias_key()
    for i, line in enumerate(last_text.split('\n')):
        if not line or i == 0:
            # skip header and EOF
            continue
        compressed_lineage = line.split('\t')[0].split()[0]
        if compressed_lineage.startswith('*'): # remove withdrawn
            continue
        uncompressed_lineage = aliasor.uncompress(compressed_lineage)
        # process recombinants but only XBB not XBB.1
        if uncompressed_lineage.startswith('X') and len(compressed_lineage.split('.')) == 1: 
            # base lineage e.g. XBB
            unclean_parents = alias_key[compressed_lineage]
            parents = clean_parents(unclean_parents, uncompressor=aliasor.uncompress)
            # unique and order
            parents = sorted(list(set(parents)), reverse=True)
            lineages.append({"compressed_name":compressed_lineage,"name":uncompressed_lineage, "recombinant": True, "parents": parents})
        else:
            lineages.append({"compressed_name":compressed_lineage,"name":uncompressed_lineage, "recombinant": False})

    root = {'name':'root', 'children':[], 'compressed_name': 'SARS-CoV-2', 'group': None}
    # build tree
    for i, lineage in enumerate(lineages):
        if lineage['recombinant']:
            # recombinant
            parent = lineage['parents'][0].split(".")
            node = {
                    'name': lineage['name'], 
                    'children': [], 
                    'compressed_name':lineage['compressed_name'], 
                    'otherParents': lineage['parents'][1:],
                }
        else:
            parts = lineage['name'].split(".")
            *parent, end = parts
            node = {'name': lineage['name'], 'children': [], 'compressed_name':lineage['compressed_name']}
        group: str = node['compressed_name'].split('.')[0]
        if node['name'].startswith('X'):
            group = 'Recombinant'
        if group not in groups:
            groups.append(group)
        node['group'] = groups.index(group)
        if not parent:
            insertNodeIntoTree(root, 'root', node)
            continue
        insertNodeIntoTree(root, ".".join(parent), node)

    lineage_tree = count_children(root)

    # with open('data/data.json', 'w') as f:
    #     json.dump(count_children(root), f)

    return lineage_tree

def count_children(node):
    """
    Recursive function to count the number of children of each node in a tree structure.

    :param node: The node of the tree.
    :return: The node with an additional field 'num_children' indicating the number of children.
    """
    # Base case: If the node has no children, return 0
    if 'children' not in node or not node['children']:
        node['num_children'] = 0
        return node

    # Recursive case: Count children of each child node
    child_count = 0
    for child in node['children']:
        # Recursive call
        updated_child = count_children(child)
        child_count += 1 + updated_child['num_children']

    # Update the current node with the count of its children
    node['num_children'] = child_count

    return node

def insertNodeIntoTree(node, parentName, newNode):
  if node['name'] == parentName:
    node['children'].append(newNode)
  elif node['children']:
    for child in node['children']:
      insertNodeIntoTree(child, parentName, newNode)

def load_alias_key(url = "https://raw.githubusercontent.com/cov-lineages/pango-designation/master/pango_designation/alias_key.json"):
    import urllib.request, json

    with urllib.request.urlopen(url) as data:
        file = json.load(data)
    return file 

def clean_parents(lineages, uncompressor):
    parents = []
    for lineage in lineages:
        lineage = lineage.replace('*', '')
        if '/' in lineage:
            # "BA.4/5"
            first, second = lineage.split('/')
            parents.append(first)
            parents.append(f"{first[:-1]}{second}")
        else:
            parents.append(lineage)
    return [uncompressor(p) for p in parents]

def addDataToNodes(node, summary):
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
        children.append(addDataToNodes(child, summary))
    node["children"] = children
    del node['group']
    return node

# Do the stuff
# Generate the tree
check_pango_designation()
lineage_tree = create_tree()

# Add extra data to nodes
with urllib.request.urlopen(
    "https://raw.githubusercontent.com/corneliusroemer/pango-sequences/main/data/pango-consensus-sequences_summary.json"
) as data:
    summary = json.load(data)
pango = addDataToNodes(lineage_tree, summary)

# Export
with open('../ncov_tree_data.json', 'w') as f:
    json.dump(pango, f, indent=2)