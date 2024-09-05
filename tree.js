/*Copyright (c) 2013-2016, Rob Schmuecker
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* The name Rob Schmuecker may not be used to endorse or promote products
  derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MICHAEL BOSTOCK BE LIABLE FOR ANY DIRECT,
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/

// Get JSON data
//treeJSON = d3.json("https://raw.githubusercontent.com/MDU-PHL/pango-watch/main/tree/data.json", function(error, treeData) {
treeJSON = d3.json("ncov_tree_data.json", function (error, treeData) {

    //#region Initial setup

    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;

    // panning variables
    var panSpeed = 200;
    var panBoundary = 20; // Within 20px from edges will pan when dragging.

    // Misc. variables
    var i = 0;
    var duration = 500;
    var root;

    // size of the diagram
    var viewerWidth = $(document).width();
    var viewerHeight = $(document).height();

    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    var treeNodes = tree.nodes(treeData);

    treeNodes.forEach(add_fields)

    const nodeType = {
        grouping: 'grouping',
        subgroup: 'subgroup',
        ignore: 'ignore',
        other: 'other',
        new: 'new'
      };

    function add_fields(node) {
        node.ignore = false
        node.other = false
        node.subgroup = false
        node.grouping = null
        node.subgrouping = null
        node.hidden = false
        //node.type = nodeType.grouping
        if (!node.children) node.children = []
    }

    let additionalLinks = []
    for (let index = 0; index < treeNodes.length; index++) {
        let node = treeNodes[index];
        if (node.otherParents) {
            node.otherParents.forEach(parent => {
                let parentNode = treeNodes.filter(function (d) {
                    return d['name'] === parent;
                })[0];
                let link = new Object();
                link.source = parentNode;
                link.target = node;
                link._source = parentNode; // backup source
                link._target = node; // backup target
                additionalLinks.push(link)
            })
        }
    }

    //#endregion Initial setup

    //#region UI
    function getTextBox(name) {
        return document.getElementById(name).value.split("\n").filter(elm => elm);
     }

    d3.select("#textbox")
        .append("foreignObject")
        .html(function (d) {
            return '<textarea id="strainTextArea" rows="10" cols="16">KP.2.2\nKP.2.10\nJN.1.28\nKP.3.2\nKP.3.1.1\nKP.2.3.1\nKP.3\nJN.1.26\nKP.2\nLB.1\nKP.1.1.3\nKP.3.3\nKP.2.3\nJN.1.16.1\nKP.3.1</textarea>'
        })

    d3.select("#textboxbar1").append("button")
        .text("Add").on("click", function () {
            strains = getTextBox("strainTextArea")
            showStrains(strains)
            showNodes(root) // TODO: not sure why this is needed. Additional links don't get removed without it
        });

    d3.select("#textboxbar1").append("button")
        .text("Remove").on("click", function () {
            strains = getTextBox("strainTextArea")
            visible = getVisibleNodes(root).map((x) => x.compressed_name)
            let difference = visible.filter(x => !strains.includes(x));       
            showStrains(difference)
            showNodes(root) // TODO: not sure why this is needed. Additional links don't get removed without it
        });

    d3.select("#textboxbar1").append("button")
        .text("Only").on("click", function () {
            strains = getTextBox("strainTextArea")
            showStrains(strains)
            showNodes(root) // TODO: not sure why this is needed. Additional links don't get removed without it
        });

    // Node colors

    var from = d3.select("#textboxbar2")
        .append("select")
        .attr("id", "fromSelect")
        // .on("change", function () {
        //     var select = d3.select("select").node().value;
        //     if (select == "From") return
        //     console.log(select)
        // });

    from.append("option")
        .attr("value", "From")
        .attr("selected", "true")
        .text("From");

    new Array("All", "Grouping", "Subgroup", "Ignored", "Other").forEach(function (node) {
        from.append("option")
                .attr("value", node)
                .text(node);
    });

    d3.select("#textboxbar2").append("text").text("  >  ")

    var from = d3.select("#textboxbar2")
        .append("select")
        .attr("id", "toSelect")
        // .on("change", function () {
        //     var select = d3.select("select").node().value;
        //     if (select == "To") return
        //     console.log(select)
        // });

    from.append("option")
        .attr("value", "To")
        .attr("selected", "true")
        .text("To");

    new Array("Grouping", "Subgroup", "Ignored", "Other").forEach(function (node) {
        from.append("option")
                .attr("value", node)
                .text(node);
    });
    
    d3.select("#textboxbar2").append("text").text("  ")
    
    d3.select("#textboxbar2").append("button")
        .text("Set").on("click", function () {
            strains = getTextBox("strainTextArea")
            nodeFrom = document.getElementById("fromSelect").value
            nodeTo = document.getElementById("toSelect").value
            
            if (strains == "" || nodeFrom == "From" || nodeTo == "To") return

            nodes = findNodesByStrain(strains)

            switch (nodeFrom) {
                case "All":
                    if (nodeTo == "Subgroup") nodes = nodes.filter(node => node.ignore || node.subgroup || node.other)
                break;
                case "Grouping":
                    nodes = nodes.filter(node => !node.ignore && !node.subgroup && !node.other)
                break;
                case "Subgroup":
                    nodes = nodes.filter(node => node.subgroup)
                break;
                case "Ignored":
                    nodes = nodes.filter(node => node.ignore)
                break;
                case "Other":
                    nodes = nodes.filter(node => node.other)
                break;
            }

            switch (nodeTo) {
                case "Grouping":
                    nodes.map(node => setGrouping(node))
                break;
                case "Subgroup":
                    nodes.map(node => setSubgroup(node))
                break;
                case "Ignored":
                    nodes.map(node => setIgnore(node))
                break;
                case "Other":
                    nodes.map(node => setOther(node))
                break;
            }
            
            showStrains(strains, reset = false)
            showNodes(root) // TODO: not sure why this is needed. Additional links don't get removed without it
        });

    // Toolbar

    d3.select("#toolbar").append("text").text("   ")

    d3.select("#toolbar").append("input")    
        .attr("type","file")
        .attr("id", "tableInput")
        .attr("class","hideInput")
        .on("change", handleFileSelect)
    
    d3.select("#toolbar").append("input")    
        .attr("type","button")
        .attr("id", "tableInput")
        .attr("value", "Import Table")
        .on("click", function () {
            document.getElementById('tableInput').click()
        })

    // d3.select("#toolbar").append("button")
    //     .text("Remove Hidden").on("click", function () {
    //         removeHidden(root);
    //         collapse(root);
    //         expand(root);
    //     });

    d3.select("#toolbar").append("button")
        .text("Export table")
        .attr("class","labelAsButton")
        .on("click", function () {
            exportTable()
        });

    d3.select("#toolbar").append("text").text("   ")

    var select = d3.select("#toolbar")
        .append("select")
        .on("change", function () {
            console.log("Finding strain...")
            var select = d3.select("select").node().value;
            if (select == "Locate strain") return

            var node = findNode(select)
            showNodes(node)
            centerNode(node)

            while (node.parent) {
                node.color = "#e74c3c";
                node = node.parent;
            }

            update(node)
            removePaths()
        });

    select.append("option")
        .attr("value", "Locate strain")
        .attr("selected", "true")
        .text("Locate strain");

    nodeSelect = []
    treeNodes.forEach(function (d) {
        if (d.compressed_name) nodeSelect.push(d.compressed_name)
    });

    castIntOrStr = function(t) {return(isNaN(Number(t)) ? t.toLowerCase() : Number(t))}
    triCompare = function (value1, value2) {
        value1 = castIntOrStr(value1); value2 = castIntOrStr(value2);
        return((value1 === value2) ? 0 : (value1 < value2) ? -1 : 1)
    }

    sortLexicographic = function (a, b) {
        var result;
        a = a.split('.');
        b = b.split('.');
        while (a.length) {
          result = triCompare(a.shift(), (b.shift() || 0))
          if (result !== 0) return result;
        }
        return -1;
    }

    nodeSelect.toSorted(sortLexicographic).forEach(function (node) {
        select.append("option")
            .attr("value", node)
            .text(node);
    });

    d3.select("#toolbar").append("text").text("   ")

    d3.select("#toolbar").append("button")
        .text("Recenter").on("click", function () {
            centerNode(root)
        });

    d3.select("#toolbar").append("button")
        .text("Collapse").on("click", function () {
            collapse(root)
            update(root);
            centerNode(root)
        });

    d3.select("#toolbar").append("button")
        .text("Expand").on("click", function () {
            expand(root)
            update(root);
            centerNode(root)
        });

    d3.select("#toolbar").append("button")
        .text("Add Grouping").on("click", function () {
            addGroupings(root)
            update(root)
        });

    // d3.select("#toolbar").append("button")
    //     .text("Show Recombinants").on("click", function () {
    //         nodes = getRecombinantStrains()
    //         console.log(nodes)
    //         showNodes(nodes)
    //     });

    d3.select("#toolbar").append("button")
        .text("Subset Mermaid").on("click", function () {
            subsetMermaid()
        });
        
    d3.select("#toolbar").append("button")
        .text("Export Mermaid").on("click", function () {
            exportMermaid()
        });

    d3.select("#helpbox").append("foreignObject")
        .html(function (d) {
            return "<table><tr><td style='text-align: center; background-color:forestgreen;'><font color='white'>Green</font></td><td>&nbsp&nbsp&nbspGrouping strains</td></tr> \
            <tr><td style='text-align: center; background-color:MediumPurple;'><font color='white'>Purple</font></td><td>&nbsp&nbsp&nbspSub-grouping strains</td></tr> \
            <tr><td style='text-align: center; background-color:goldenrod;'><font color='white'>Yellow</font></td><td>&nbsp&nbsp&nbsp'Other' strains</td></tr> \
            <tr><td style='text-align: center; background-color:firebrick;'><font color='white'>Red</font></td><td>&nbsp&nbsp&nbspIgnored strains</td></tr> \
            <tr><td style='text-align: center; background-color:DodgerBlue;'><font color='white'>Blue</font></td><td>&nbsp&nbsp&nbspNew strains</td></tr> \
            <tr><td><br /></td></tr> \
            <tr><td style='text-align: right;'>Left Click:</td><td>Un/collapse children</td></tr> \
            <tr><td style='text-align: right;'>CTRL + Click:</td><td>Collapse Node</td></tr> \
            <tr><td style='text-align: right;'>ALT + Click:</td><td>Assign as 'Other'</td></tr> \
            <tr><td style='text-align: right;'>SHIFT + Click:</td><td>Ignore node</td></tr> \
            <tr><td style='text-align: right;'>CTRL + ALT + <br>&nbsp&nbspLeft Click:&nbsp&nbsp</td><td>Assign as sub-group</td></tr> \
            </table><br> \
            Database last updated: <a href='https://mdu-phl.github.io/pango-watch/'>" + treeData.lastChanged + "</a>"      
        })
    
    var tooltip = d3.select("body")
        .append("tspan")
        .attr("class", "my-tooltip") //add the tooltip class
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden");

    //#endregion UI

    //#region File input

    function handleFileSelect() {
        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            // Great success! All the File APIs are supported.
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }
        
        var reader = new FileReader(); 
        var file = document.querySelector('input[type=file]').files[0];      
        if (file) {
            dfd.readCSV(file).then((df) => {
                console.log("Got " + file)
                df.print()
                if (!df.columns.includes("subgrouping")) df = df.addColumn("subgrouping",Array(df.index.length).fill("Other"))
                df.print()
                importTable(df)
            })
        }

        function parseFile() {
            



            // var data = d3.csv.parse(reader.result, function(d){
            //     return [d.name, d.alias, d.grouping, d.subgrouping, d.label]
            //   });
            // let df = new dfd.DataFrame(data, { columns: ["name","alias","grouping","subgrouping","label"] })
            // importTable(df)
        }

        // var f = event.target.files[0]; // FileList object
        // var reader = new FileReader();

        // reader.onload = function (event) {
        //     loadTable(d3.csv.parse(event.target.result))
        // };

        // // Read in the file as a data URL.
        // reader.readAsDataURL(f);
    }

    function importTable(df) {

        // Ignore everything
        nodeList(root).forEach(function(node) {
            node.ignore = true
        })

        // Deignore grouping nodes
        let groupings = new Set(df['grouping'].unique().values)
        let subgroupings = new Set(df.query(df["subgrouping"].ne("Other"))['alias'].unique().values).difference(groupings)
        groupings = Array.from(groupings)
        subgroupings = Array.from(subgroupings)
        allgroupings = groupings.concat(subgroupings)
        console.log(subgroupings)
        console.log()
        showStrains(groupings.concat(subgroupings))
        let visible = getVisibleNodes(root).map(function(node){return node.compressed_name})

        let groups = visible.filter(x => groupings.includes(x))
        groups.forEach(function(name) {
            node = findNode(name)
            node.ignore = false
            node.subgroup = false
        })

        let subgroups = visible.filter(x => subgroupings.includes(x))
        subgroups.forEach(function(name) {
            node = findNode(name)
            node.ignore = false
            node.subgroup = true
        })

        // Process other nodes
        let others = df.groupby(["label"]).getGroup(["Other"])["grouping"].unique().values
        others = others.concat(df.groupby(["label"]).getGroup(["Recombinant other"])["grouping"].unique().values)
        others.forEach(function(name) {
            node = findNode(name)
            node.other = true
            node.ignore = false
            //update(node)
        })

        // Process new nodes
        let refStrains = nodeList(root).map(function(node){return node.compressed_name})
        let oldStrains = df['alias'].values
        let newStrains = refStrains.filter(x => !oldStrains.includes(x))
        showStrains(groupings.concat(newStrains))
        let newVisible = getVisibleNodes(root).map(function(node){return node.compressed_name})
        newVisible = newVisible.filter(x => !visible.includes(x))
        newVisible = newVisible.filter(x => !oldStrains.includes(x))
        newVisible.forEach(function (strain) {
            node = findNode(strain)
            node.new = true
            node.ignore = false
            //update(node)
        })
        showStrains(newVisible.concat(allgroupings))
    }

    function exportTable() {
        addGroupings(root)
        nodes = nodeList(root)
        nodes.sort(function compareByName(a, b) {return a.name.localeCompare(b.name)})

        data = []
        nodes.forEach(function(node) { 
            let strain = {"name": node.name, 
                       "alias": node.compressed_name, 
                       "clade": node.nextstrain, 
                       "grouping": node.grouping, 
                       "subgrouping": node.subgrouping, 
                       "label": node.other, 
                       "designationDate": node.designationDate}
            data.push(strain)
        });

        let csvContent = "data:text/csv;charset=utf-8,";

        csvContent += ["name","alias","clade","grouping","subgrouping","label","designationDate"].join(",") + "\r\n";

        nodes.forEach(function(node) {            
            if (node.label == "Other" && node.name.startsWith("X")) {
                node.label = "Recombinant other"
            }

            let row = [node.name, node.compressed_name, node.nextstrain, node.grouping, node.subgrouping, node.label, node.designationDate].join(",");
            csvContent += row + "\r\n";
        });

        exportFile(csvContent, yymmdd() +"_variant_groupings.csv")
    }

    function subsetMermaid() {

        groupingNodes = getGroupingStrains(root)
        recombParents = []

        groupingNodes.forEach(function (node) {
            if (node.otherParents) {
                recombParents.push.apply(recombParents,node.otherParents)
                recombParents.push(node.parent.name)
            }
        })

        recombParents = recombParents.map(findNode)
 
        nodes = [...new Set(groupingNodes.concat(recombParents))].concat(root)
        nodes = nodes.map((x) => x.name)

        showStrains(nodes)
        removeHidden(root)

        allNodes = getVisibleNodes(root).map((x) => x.name)

        allNodes.forEach(function (d) {
            if (!nodes.includes(d)) {
                removeNode(findNode(d))
            }    
        })

        updateTree(root);
    }

    function exportMermaid() {

        mermaid = []
        
        getVisibleNodes(root).forEach(function(node) {
            if (!node.ignore) {
                mermaid.push("style " + node.compressed_name + " stroke:DarkBlue, stroke-width:4px") // Can't use RGB values starting with #. Output file will not show anything past a #.
            }

            if (getAllChildren(node).length) {
                links = getAllChildren(node).map((x) => node.compressed_name + (node.ignore ? " -.-> " : " --> ") + x.compressed_name)
                mermaid.push(...links)
            }

            if (node.otherParents) {
                parents = node.otherParents.map((x) => findNode(x))
                links = parents.map((x) => x.compressed_name + (x.ignore ? " -.-> " : " --> ") + node.compressed_name)
                mermaid.push(...links)
            }

            mermaid.push("")
        })

        mermaid.reverse()

        let fileContent = "data:text/plain;charset=utf-8,";
        fileContent += "graph LR\r\n"
        fileContent += mermaid.join("\r\n") //+ "\r\n"
        // fileContent += styles.join("\r\n")

        exportFile(fileContent, yymmdd() +"_mermaid.txt")
    }

    function yymmdd() {
        var now = new Date();
        return now.getFullYear().toString().slice(-2) + 
               ('0' + (now.getMonth() + 1).toString()).slice(-2) +
               ('0' + now.getDate().toString()).slice(-2);
    }

    function exportFile(data, name) {
        var encodedUri = encodeURI(data);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", name);
        document.body.appendChild(link); // Required for FF
        link.click();
    }

    //#endregion File input

    //#region D3.js
    function load_d3(fileHandler) {
        d3.json(fileHandler, function (error, root) {
            //do stuff
        });
    };

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal()
        .projection(function (d) {
            return [d.y, d.x];
        });

    // A recursive helper function for performing some setup by walking through all nodes
    function visit(parent, visitFn, childrenFn) {
        if (!parent) return;

        visitFn(parent);

        var children = childrenFn(parent);
        if (children) {
            var count = children.length;
            for (var i = 0; i < count; i++) {
                visit(children[i], visitFn, childrenFn);
            }
        }
    }

    // Call visit function to establish maxLabelLength
    visit(treeData, function (d) {
        totalNodes++;
        maxLabelLength = Math.max(d.compressed_name.length, maxLabelLength);

    }, function (d) {
        return d.children && d.children.length > 0 ? d.children : null;
    });


    // sort the tree according to the node names

    function sortTree() {
        tree.sort(function (a, b) {
            return b.compressed_name.toLowerCase() < a.compressed_name.toLowerCase() ? 1 : -1;
        });
    }
    // Sort the tree initially incase the JSON isn't in a sorted order.
    sortTree();

    // TODO: Pan function, can be better implemented.

    function pan(domNode, direction) {
        var speed = panSpeed;
        if (panTimer) {
            clearTimeout(panTimer);
            translateCoords = d3.transform(svgGroup.attr("transform"));
            if (direction == 'left' || direction == 'right') {
                translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                translateY = translateCoords.translate[1];
            } else if (direction == 'up' || direction == 'down') {
                translateX = translateCoords.translate[0];
                translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
            }
            scaleX = translateCoords.scale[0];
            scaleY = translateCoords.scale[1];
            scale = zoomListener.scale();
            svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
            d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
            zoomListener.scale(zoomListener.scale());
            zoomListener.translate([translateX, translateY]);
            panTimer = setTimeout(function () {
                pan(domNode, speed, direction);
            }, 50);
        }
    }

    // Define the zoom function for the zoomable tree

    function zoom() {
        svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.05, 3]).on("zoom", zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(zoomListener);

    //#endregion D3.js setup

    //#region Node search
    function nodeList(node) {

        if (node == root && this.nodeListCache) return this.nodeListCache

        var nodes = [],
            i = 0;

        function recurse(node) {
            getAllChildren(node).forEach(recurse);
            if (!node.id) node.id = ++i;
            nodes.push(node);
        }

        recurse(node);
        if (node == root) nodeListCache = nodes
        return nodes;
    }

    function nodeDict(node, unaliased = true, aliased = true) {        
        
        if (node == root && unaliased && aliased && this.nodeDictCache) {
            return this.nodeDictCache
        } else {        
            var nodes = {}, i = 0;

            function recurse(node) {
                getAllChildren(node).forEach(recurse);
                if (!node.id) node.id = ++i;
                if (unaliased) nodes[node.name] = node;
                if (aliased) nodes[node.compressed_name] = node;
            }

            recurse(node);
            if (node == root && unaliased && aliased) nodeDictCache = nodes
            return nodes;
        }
    }
    
    function findNode(strain) {
        return nodeDict(root)[strain];
    }

    function findNodesByStrain(strains) {
        return strains.map((x) => findNode(x))
    }

    //#endregion Node search

    //#region Node metadata

    function addGroupings(d) {
        addMaingroupings(d)
        addSubgroupings(d)
    }

    function addMaingroupings(d) {
        if (d.new) {
            if (d.name.startsWith("X") && d.name.length == 3) {
                d.other = true
            } else {
                d.ignore = true
            }
            d.new = false
        }

        if (!d.parent) {
            d.grouping = d.compressed_name
        } else if (d.hidden || d.ignore || d.subgroup) {
            d.grouping = d.parent.grouping 
        } else {
            d.grouping = d.compressed_name
        }

        d.label = nodeDict(root)[d.grouping].other ? "Other" : d.grouping

        getAllChildren(d).forEach(addGroupings)
    }

    function addSubgroupings(d) {
        if (!d.parent) { //root node
            d.subgrouping = d.label
        } else if (d.subgroup || !(d.hidden || d.ignore)) { // subgroup or grouping
            d.subgrouping = d.compressed_name
            nodeDict(root)[d.grouping].subgrouping = nodeDict(root)[d.grouping].label
        } else {
            d.subgrouping = d.parent.subgrouping
        }

        getAllChildren(d).forEach(addSubgroupings)
    }

    function toggleGrouping(d) {
        if (d.ignore) d.ignore = false
        if (d.other) d.other = false
        if (d.subgroup) d.subgroup = false
    }

    function toggleIgnore(d) {
        d.ignore = !d.ignore
        if (d.other) d.other = false
        if (d.subgroup) d.subgroup = false
    }

    function toggleOther(d) {
        d.other = !d.other
        if (d.ignore) d.ignore = false
        if (d.subgroup) d.subgroup = false
    }

    function toggleSubgroup(d) {
        d.subgroup = !d.subgroup
        if (d.other) d.other = false
        if (d.ignore) d.ignore = false
    }

    function setGrouping(d) {
        if (d.ignore) d.ignore = false
        if (d.other) d.other = false
        if (d.subgroup) d.subgroup = false
    }

    function setIgnore(d) {
        d.ignore = true
        if (d.other) d.other = false
        if (d.subgroup) d.subgroup = false
    }

    function setOther(d) {
        d.other = true
        if (d.ignore) d.ignore = false
        if (d.subgroup) d.subgroup = false
    }

    function setSubgroup(d) {
        d.subgroup = true
        if (d.other) d.other = false
        if (d.ignore) d.ignore = false
    }

    //#endregion Node metadata

    //#region Node subset

    function getVisibleNodes(node) {
        var nodes = [], i = 0;

        function recurse(node) {
            getVisibleChildren(node).forEach(recurse);
            if (!node.id) node.id = ++i;
            nodes.push(node);
        }

        recurse(node);
        return nodes;   
    }

    function getVisibleChildren(d) {
        return (d.children) ? d.children : []
    }

    function getHiddenChildren(d) {
        return (d._children) ? d._children : []
    }

    function getAllChildren(d) {
        return getVisibleChildren(d).concat(getHiddenChildren(d))
    }

    function getRecombinantStrains() {
        recomb = []
        additionalLinks.forEach(function (link) {
            strain = link._target.name
            recomb.push(findNode(strain))
        })
        return recomb
    }

    function getGroupingStrains(d) {       
        nodes = new Set();
        addGroupings(d)
        getVisibleNodes(d).forEach(function (n) {
            if (n.label == n.compressed_name) nodes.add(n);
        })    
        return Array.from(nodes); 
    }

    //#endregion Node subset

    //#region Node actions
    function collapse(d) {
        if (d.children) {
            d._children = (d._children) ? d._children.concat(d.children) : d.children
            d.children = null
            d._children.forEach(collapse)
            d._children.map((child) => child.hidden = true)
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = (d.children) ? d.children.concat(d._children) : d._children
            d._children = null
            d.children.forEach(expand)
            d.children.map((child) => child.hidden = false)
        }
    }

    function removeHidden(d) {
        if (d.children) {
            d.children.forEach(removeHidden);
        }
        d._children = null;
    }

    function removeNode(d) {        
        if (d.parent) {
            if (d.children) {
                d.parent.children.push(...d.children)
                d.children.forEach(function (c) {c.parent = d.parent})
                d.children = null
                d.parent.children = d.parent.children.filter((n) => n.name !== d.name);
            }

            if (d._children) {
                d.parent._children.push(d._children)            
                d._children.forEach(function (c) {c.parent = d.parent})
                d._children = null
                d.parent._children = d.parent._children.filter((n) => n.name !== d.name);
            }

            d = null  
        }
    }

    function toggleNode(d, collapseSelf = false) {
        if (d.children) {
            collapse(d);
        } else if (d._children) {
            expand(d)
        }

        if ((!d.children && !d._children) || collapseSelf) {
            d.parent.children = spliceByName(d, d.parent.children)
            d.parent._children = (d.parent._children) ? d.parent._children.concat([d]) : [d]
            d.hidden = true
        }

        return d;
    }

    function spliceByName(d, array) {
        if (array) {
            array = array.filter(function (array) {
                return array.name !== d.name;
            })
        } else {
            array = []
        }
        return array
    }

    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed

        center = false

        if (d3.event.shiftKey && d3.event.altKey) {
            toggleSubgroup(d)
        } else if (d3.event.shiftKey) {
            toggleIgnore(d)
        } else if (d3.event.altKey) {
            toggleOther(d)
        } else {
            d = toggleNode(d, d3.event.ctrlKey);
            center = true
        }

        updateLinks(d)
        update(d);
        if (center) centerNode(d)
    }

    //#endregion Node actions

    //#region Node visualization

    const wait = (n) => new Promise((resolve) => setTimeout(resolve, n));

    const removePaths = async () => {
        await wait(2000);
        nodeList(root).forEach(function (d) {
            d.color = undefined;
        })
        update(root);
    }

    const removeNewColor = async () => {
        await wait(2000);
        nodeList(root).forEach(function (d) {
            d.new = false;
        })
        update(root);
    }

    function showNodes(node, redraw = true) {

        if (Array.isArray(node)) {
            node.forEach(function(n) {showNodes(n, redraw = true)})
            updateTree(root)
        } else {
            while (node.parent) {
                node.hidden = false
                node.parent._children = spliceByName(node, node.parent._children)
                node.parent.children = spliceByName(node, node.parent.children).concat(node)
                node = node.parent;
            }

            if (redraw) {
                updateLinks(node);
                update(node);
            }
        }
    }

    function showStrains(strains, reset = true) {

        if (reset) collapse(root)
        strains.forEach(function(strain) {
            if (strain == "") return
            let d = nodeDict(root)[strain]
            if (d) {
                showNodes(d, redraw = false)
            } else {
                console.log("Could not find strain: " + strain)
            }
        })

        updateTree(root)
        centerNode(root)
    }

    var overCircle = function (d) {
        selectedNode = d;
        updateTempConnector();
    };
    var outCircle = function (d) {
        selectedNode = null;
        updateTempConnector();
    };

    function centerNode(source, highlight = false) {
        scale = zoomListener.scale();
        x = -source.y0;
        y = -source.x0;
        x = x * scale + viewerWidth / 2;
        y = y * scale + viewerHeight / 2;
        d3.select('g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");

        zoomListener.scale(scale);
        zoomListener.translate([x, y]);
    }
    
    //#endregion Node visualizations

    //#region Updates

    function updateLinks(d) {
        additionalLinks.forEach(function (link) {
            let sourceVisible = false;
            let targetVisible = false;
            tree.nodes(root).filter(function (n) {
                if (n["name"] == link._source.name) {
                    sourceVisible = true;
                }
                if (n["name"] == link._target.name) {
                    targetVisible = true;
                }
            });
            if (sourceVisible && targetVisible) {
                link.source = link._source;
                link.target = link._target;
            }
            else if (!sourceVisible && targetVisible
                || !sourceVisible && !targetVisible) {
                link.source = d;
                link.target = link.source;
            }
            else if (sourceVisible && !targetVisible) {
                link.source = link._source;
                link.target = link.source;
            }
        });
    }

    function updateTree(node) {
        update(node)
        updateLinks(node)
       // if (node.children) node.children.forEach(function(node) {updateTree(node, true)})
    }

    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function (level, n) {

            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function (d) {
                    childCount(level + 1, d);
                });
            }
        };
        childCount(0, root);
        var newHeight = d3.max(levelWidth) * 40; // 25 pixels per line  
        tree = tree.size([newHeight, viewerWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);

        // Set widths between levels based on maxLabelLength.
        nodes.forEach(function (d) {
            d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
            // alternatively to keep a fixed scale one can set a fixed depth per level
            // Normalize for fixed-depth by commenting out below line
            d.y = (d.depth * 75); //500px per level.
        });

        // Update the nodes…
        node = svgGroup.selectAll("g.node")
            .data(nodes, function (d) {
                return d.id || (d.id = ++i);
            });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on('click', click)
            .on('mouseover', function (d) {
                tooltip.style("visibility", "visible")
                    .html('Strain: ' + d.name +
                        '<br>Alias: ' + d.compressed_name +
                        '<br>Nextclade: ' + d.nextstrain +
                        '<br>Designation Date: ' + d.designationDate +
                        //'<br>Hidden: ' + d.hidden + 
                        '<br>Grouping: ' + (d.grouping ? d.grouping : "NA") + 
                        '<br>Label: ' + (d.label ? d.label : "NA")
                    )
                console.log(d)
            })
            .on("mousemove", function () {
                return tooltip.style("top", (d3.event.pageY + 10) + "px").style("left", (d3.event.pageX + 10) + "px");
            })
            .on("mouseout", function () {
                return tooltip.style("visibility", "hidden");
            });

        nodeEnter.append("circle")
            .attr('class', 'nodeCircle')
            .attr("r", 0)

        nodeEnter.append("text")
            .attr("x", function (d) {
                return d.children || d._children ? -10 : 10;
            })
            .attr("dy", ".35em")
            .attr('class', 'nodeText')
            .attr("text-anchor", function (d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function (d) {
                return d.compressed_name;
            })
            .style("fill-opacity", 0);

        // phantom node to give us mouseover in a radius around it
        nodeEnter.append("circle")
            .attr('class', 'ghostCircle')
            .attr("r", 30)
            .attr("opacity", 0.2) // change this to zero to hide the target area
            .style("fill", "red")
            .attr('pointer-events', 'mouseover')
            .on("mouseover", function (node) {
                overCircle(node);
            })
            .on("mouseout", function (node) {
                outCircle(node);
            });

        // Update the text to reflect whether node has children or not.
        node.select('text')
            .attr("x", function (d) {
                return -10 //d.children || d._children ? -10 : 10;
            })
            .attr("text-anchor", function (d) {
                return "end" //d.children || d._children ? "end" : "start";
            })
            .text(function (d) {
                return d.compressed_name;
            });

        // Change the circle fill depending on whether it has children and is collapsed
        node.select("circle.nodeCircle")
            .attr("r", 6)
            .style("stroke", function (d) {
                return d._children ? "black" : "white";
            })
            .style("fill", function (d) {
                if (d.ignore) {
                    return "firebrick"
                } else if (d.other) {
                    return "goldenrod"
                } else if (d.new) {
                    return "blue"
                } else if (d.subgroup) {
                    return "MediumPurple"
                }
                return "forestgreen"
            });

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function (d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            //.attr("r", 0); //TODO: Not sure why 0 makes some nodes disappear. Can see nodes fly from the root node sometimes
            .attr("r", 6); 

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Update the links…
        var link = svgGroup.selectAll("path.link")
            .data(links, function (d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function (d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        d3.selectAll("path").style("stroke", function (d) {
            if (d.target.color) {
                return d.target.color
            } else {
                return null
            }
        })
        d3.selectAll("path").style("stroke-width", function (d) {
            if (d.target.color) {
                return '4px'
            } else {
                return null
            }
        })
        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // ======== add additional links (mpLinks) ========
        let mpLink = svgGroup.selectAll("path.mpLink")
            .data(additionalLinks);

        mpLink.enter().insert("path", "g")
            .attr("class", "mpLink")
            .attr("d", function (d) {
                var o = { x: source.x0, y: source.y0 };
                return diagonal({ source: o, target: o });
            });

        mpLink.transition()
            .duration(duration)
            .attr("d", diagonal)

        mpLink.exit().transition()
            .duration(duration)
            .attr("d", function (d) {
                let o = { x: source.x, y: source.y };
                return diagonal({ source: o, target: o });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    //#endregion Updates

    //#region Final setup

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);

    //#endregion Updates
});