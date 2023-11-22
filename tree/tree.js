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
treeJSON = d3.json("data_nextstrain.json", function (error, treeData) {

    //#region Setup

    // Calculate total nodes, max label length
    var totalNodes = 0;
    var maxLabelLength = 0;
    // variables for drag/drop
    var selectedNode = null;
    var draggingNode = null;
    // panning variables
    var panSpeed = 200;
    var panBoundary = 20; // Within 20px from edges will pan when dragging.
    // Misc. variables
    var i = 0;
    var duration = 300;
    var root;

    // size of the diagram
    var viewerWidth = $(document).width();
    var viewerHeight = $(document).height();



    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    var nodeList = tree.nodes(treeData);

    let additionalLinks = []
    for (let index = 0; index < nodeList.length; index++) {
        let node = nodeList[index];
        if (node.otherParents) {
            node.otherParents.forEach(parent => {
                let parentNode = nodeList.filter(function (d) {
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

    //#endregion Setup

    //#region Node accessing

    // Returns a list of all nodes under the root.
    function flatten(root) {
        var nodes = [],
            i = 0;

        function recurse(node) {
            if (node.children) node.children.forEach(recurse);
            if (node._children) node._children.forEach(recurse);
            if (!node.id) node.id = ++i;
            nodes.push(node);
        }

        recurse(root);
        return nodes;
    }

    function flattenDict(root, unaliased = true, aliased = true) {
        var nodes = {},
            i = 0;

        function recurse(node) {
            if (node.children) node.children.forEach(recurse);
            if (node._children) node._children.forEach(recurse);
            if (!node.id) node.id = ++i;
            if (unaliased) nodes[node.name] = node;
            if (aliased) nodes[node.compressed_name] = node;
        }

        recurse(root);
        return nodes;
    }

    //#endregion Node accessing

    //#region Tool bar

    // d3.select("#textbox")
    //     .append("foreignObject")
    //     .html(function (d) {
    //         return '<textarea id="import" name="story" rows="10" cols="15">'
    //     })

    // d3.select("#toolbar").append("button")
    //     .text("Import table").on("click", function () {
    //         collapse(root);

    //         prevData = document.getElementById("import").value.split("\n");
    //         prevGroups = prevData
    //         nodes = flattenDict(root);

    //         for (let i = 0; i < strains.length; i++) {
    //             if (strains[i] == "") return
    //             var [strain, value] = strains[i].split(';');
    //             console.log("Searching for '" + strain)

    //             var d = nodes[strain]

    //             if (d) {
    //                 show(d)
    //                 if (value) d.value = parseFloat(value)
    //             } else {
    //                 console.log("Could not find strain: " + strain)
    //             }
    //         }

    //         update(root);
    //         centerNode(root)

    //     });

    d3.select("#textbox")
        .append("foreignObject")
        .html(function (d) {
            return '<textarea id="subset" name="story" rows="10" cols="15">'
        })

    d3.select("#toolbar").append("button")
        .text("Subset").on("click", function () {
            collapse(root);

            strains = document.getElementById("subset").value.split("\n");
            nodes = flattenDict(root);

            for (let i = 0; i < strains.length; i++) {
                if (strains[i] == "") return
                var [strain, value] = strains[i].split(';');
                console.log("Searching for '" + strain)

                var d = nodes[strain]

                if (d) {
                    show(d)
                    if (value) d.value = parseFloat(value)
                } else {
                    console.log("Could not find strain: " + strain)
                }
            }

            update(root);
            centerNode(root)

        });

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
            strains = Object.keys(flattenDict(root, unaliased = false));
            document.getElementById("subset").value = strains.join("\n");
        });

    d3.select("#toolbar").append("text").text("   ")

    var select = d3.select("#toolbar")
        .append("select")
        .on("change", function () {

            var select = d3.select("select").node().value;
            if (select == "Locate strain") return

            var find = flatten(root).find(function (d) {
                if (d.compressed_name == select)
                    return true;
            });

            show(find)
            centerNode(find)

            while (find.parent) {
                find.color = "#e74c3c";
                find = find.parent;
            }

            update(find)
            removePaths()
        });

    select.append("option")
        .attr("value", "Locate strain")
        .attr("selected", "true")
        .text("Locate strain");

    nodes = []
    nodeList.forEach(function (d) {
        if (d.compressed_name) nodes.push(d.compressed_name)
    });

    nodes.sort().forEach(function (node) {
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

    //#endregion Tool bar

    //#region Help bar
    d3.select("#helpbox").append("foreignObject")
        .html(function (d) {
            return 'Green nodes indicate groups.<br> \
        Yellow nodes are grouped as "Other".<br> \
        Red nodes are ignored.<br> \
        Blue nodes are new strains.<p> \
        <table><tr><td>Left Click:</td><td>Un/collapse children</td></tr> \
        <tr><td>CTRL + Left Click:</td><td>Collapse Node</td></tr> \
        <tr><td>ALT + Left Click:</td><td>Assign as "Other"</td></tr> \
        <tr><td>SHIFT + Left Click:</td><td>Ignore node</td></tr>'
        })

    //#endregion Help bar


    function handleFileSelect() {
        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            // Great success! All the File APIs are supported.
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }

        var f = event.target.files[0]; // FileList object
        var reader = new FileReader();

        reader.onload = function (event) {
            load_d3(event.target.result)
        };
        // Read in the file as a data URL.
        reader.readAsDataURL(f);
    }

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

    // Helper functions for collapsing and expanding nodes.

    function collapse(d) {
        if (d.children) {
            d._children = (d._children) ? d._children.concat(d.children) : d.children
            d.children = null;
            d._children.forEach(collapse);
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = (d.children) ? d.children.concat(d._children) : d._children
            d._children = null;
            d.children.forEach(expand);
        }
    }

    function removeHidden(d) {
        if (d.children) {
            d.children.forEach(removeHidden);
        }
        d._children = null;
    }

    const wait = (n) => new Promise((resolve) => setTimeout(resolve, n));
    const removePaths = async () => {
        await wait(1000);
        flatten(root).forEach(function (d) {
            d.color = undefined;
        })
        update(root);
    }

    function show(d) {
        while (d.parent) {

            // console.log("d:" + d.name)
            // console.log("d.parent:" + d.parent.name)
            // console.log("d.parent._children (before):" + (d.parent._children ? d.parent._children.map(a => a.name) : ""))
            // console.log("d.parent.children (before):" + (d.parent.children ? d.parent.children.map(a => a.name) : ""))

            d.parent._children = spliceByName(d, d.parent._children)
            d.parent.children = spliceByName(d, d.parent.children).concat(d)

            // console.log("d.parent._children (after):" + (d.parent._children ? d.parent._children.map(a => a.name) : ""))
            // console.log("d.parent.children (after):" + (d.parent.children ? d.parent.children.map(a => a.name) : ""))

            d = d.parent;
        }
        updateLinks(d);
        update(d);
    }

    function findNode(strain) {
        nodes = flattenDict(root);
        return nodes[strain]
    }

    function calculate(d, root = true) {

        return 0

        childTotal = 0
        children = root ? getHiddenChildren(d) : getAllChildren(d)

        if (children) {
            children.forEach((child) => {
                childTotal += calculate(child, root = false)
            });
        }

        return childTotal + d.value
    }

    function getVisibleChildren(d) {
        return (d.children) ? d.children : []
    }

    function getHiddenChildren(d) {
        return (d._children) ? d._children : []
    }

    function getAllChildren(d) {
        children = []
        if (d._children) children = children.concat(d._children)
        if (d.children) children = children.concat(d.children)
        return children
    }

    var overCircle = function (d) {
        selectedNode = d;
        updateTempConnector();
    };
    var outCircle = function (d) {
        selectedNode = null;
        updateTempConnector();
    };

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.

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

    // Toggle children function

    function toggleNode(d, collapseSelf = false) {
        if (d.children) {
            collapse(d);
        } else if (d._children) {
            expand(d)
        }

        if ((!d.children && !d._children) || collapseSelf) {
            d.parent.children = spliceByName(d, d.parent.children)
            d.parent._children = (d.parent._children) ? d.parent._children.concat([d]) : [d]
        }

        return d;
    }

    function toggleIgnore(d) {
        d.ignore = !d.ignore
        if (d.other) d.other = false
    }

    function toggleOther(d) {
        d.other = !d.other
        if (d.ignore) d.ignore = false
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

    // Clicking on nodes
    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed

        center = false

        if (d3.event.shiftKey) {
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
                console.log(d);
                tooltip.style("visibility", "visible")
                    .html('Strain: ' + d.name +
                        '<br>Alias: ' + d.compressed_name +
                        '<br>Nextclade: ' + d.nextstrain +
                        '<br>Designation Date: ' + d.designationDate
                    )
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
                // console.log("setting color: " + d.name)
                return d._children ? "black" : "white";
            })
            .style("fill", function (d) {
                if (d.ignore) {
                    return "firebrick"
                } else if (d.other) {
                    return "goldenrod"
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
            .attr("r", 0);

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

    var tooltip = d3.select("body")
        .append("tspan")
        .attr("class", "my-tooltip") //add the tooltip class
        .style("position", "absolute")
        .style("z-index", "10")
        .style("visibility", "hidden");

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");

    // Define the root
    root = treeData;
    root.x0 = viewerHeight / 2;
    root.y0 = 0;

    // Layout the tree initially and center on the root node.
    update(root);
    centerNode(root);
});