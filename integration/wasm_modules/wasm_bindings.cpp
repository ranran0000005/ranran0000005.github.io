#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "spatial_analysis.h"
#include <vector>

using namespace emscripten;

/**
 * Convert JavaScript array of lines to C++ vector
 */
std::vector<Line> jsLinesToCpp(val jsLines) {
    std::vector<Line> lines;
    int length = jsLines["length"].as<int>();
    
    for (int i = 0; i < length; i++) {
        val jsLine = jsLines[i];
        val jsP1 = jsLine["p1"];
        val jsP2 = jsLine["p2"];
        
        Point p1(jsP1["x"].as<double>(), jsP1["y"].as<double>());
        Point p2(jsP2["x"].as<double>(), jsP2["y"].as<double>());
        int featureIndex = jsLine["featureIndex"].as<int>();
        
        lines.push_back(Line(p1, p2, featureIndex));
    }
    
    return lines;
}

/**
 * Convert adjacency list to JavaScript array
 */
val adjacencyListToJs(const std::vector<std::vector<std::pair<int, double>>>& adjList) {
    val jsResult = val::array();
    
    for (size_t i = 0; i < adjList.size(); i++) {
        val jsNeighbors = val::array();
        for (const auto& [neighbor, weight] : adjList[i]) {
            val jsEdge = val::object();
            jsEdge.set("index", neighbor);
            jsEdge.set("weight", weight);
            jsNeighbors.call<void>("push", jsEdge);
        }
        jsResult.call<void>("push", jsNeighbors);
    }
    
    return jsResult;
}

/**
 * Convert JavaScript adjacency list to C++
 */
std::vector<std::vector<std::pair<int, double>>> jsAdjacencyListToCpp(val jsAdjList) {
    std::vector<std::vector<std::pair<int, double>>> adjList;
    int length = jsAdjList["length"].as<int>();
    
    for (int i = 0; i < length; i++) {
        val jsNeighbors = jsAdjList[i];
        int neighborCount = jsNeighbors["length"].as<int>();
        
        std::vector<std::pair<int, double>> neighbors;
        for (int j = 0; j < neighborCount; j++) {
            val jsEdge = jsNeighbors[j];
            int index = jsEdge["index"].as<int>();
            double weight = jsEdge["weight"].as<double>();
            neighbors.push_back({index, weight});
        }
        adjList.push_back(neighbors);
    }
    
    return adjList;
}

/**
 * JavaScript-callable wrapper for buildAdjacencyList
 */
val buildAdjacencyListWrapper(val jsLines, std::string mode, int tulipBins) {
    std::vector<Line> lines = jsLinesToCpp(jsLines);
    auto adjList = buildAdjacencyList(lines, mode.c_str(), tulipBins);
    return adjacencyListToJs(adjList);
}

/**
 * JavaScript-callable wrapper for calculateConnectivity
 */
val calculateConnectivityWrapper(val jsAdjList, int featureCount) {
    auto adjList = jsAdjacencyListToCpp(jsAdjList);
    auto connectivity = calculateConnectivity(adjList, featureCount);
    
    val jsResult = val::array();
    for (int value : connectivity) {
        jsResult.call<void>("push", value);
    }
    return jsResult;
}

/**
 * JavaScript-callable wrapper for calculateDepthFromRoot
 */
double calculateDepthFromRootWrapper(int rootIndex, val jsAdjList, int nodeCount) {
    auto adjList = jsAdjacencyListToCpp(jsAdjList);
    return calculateDepthFromRoot(rootIndex, adjList, nodeCount);
}

/**
 * JavaScript-callable wrapper for calculateIntegrationForRoot
 */
double calculateIntegrationForRootWrapper(
    int rootIndex,
    int nodeCount,
    val jsAdjList,
    bool applyFormula,
    int globalNodeCount,
    int tulipBins
) {
    auto adjList = jsAdjacencyListToCpp(jsAdjList);
    return calculateIntegrationForRoot(rootIndex, nodeCount, adjList, applyFormula, globalNodeCount, tulipBins);
}

/**
 * Check if two lines intersect (simple wrapper)
 */
val checkLineIntersectionWrapper(val jsLine1, val jsLine2) {
    val jsP1_1 = jsLine1["p1"];
    val jsP2_1 = jsLine1["p2"];
    val jsP1_2 = jsLine2["p1"];
    val jsP2_2 = jsLine2["p2"];
    
    Point p1_1(jsP1_1["x"].as<double>(), jsP1_1["y"].as<double>());
    Point p2_1(jsP2_1["x"].as<double>(), jsP2_1["y"].as<double>());
    Point p1_2(jsP1_2["x"].as<double>(), jsP1_2["y"].as<double>());
    Point p2_2(jsP2_2["x"].as<double>(), jsP2_2["y"].as<double>());
    
    Line line1(p1_1, p2_1);
    Line line2(p1_2, p2_2);
    
    Point intersection;
    bool intersects = checkLineIntersection(line1, line2, intersection);
    
    val result = val::object();
    result.set("intersects", intersects);
    if (intersects) {
        val jsPoint = val::object();
        jsPoint.set("x", intersection.x);
        jsPoint.set("y", intersection.y);
        result.set("point", jsPoint);
    }
    
    return result;
}

/**
 * Calculate angle between two lines (simple wrapper)
 */
double angleBetweenLinesWrapper(val jsLine1, val jsLine2) {
    val jsP1_1 = jsLine1["p1"];
    val jsP2_1 = jsLine1["p2"];
    val jsP1_2 = jsLine2["p1"];
    val jsP2_2 = jsLine2["p2"];
    
    Point p1_1(jsP1_1["x"].as<double>(), jsP1_1["y"].as<double>());
    Point p2_1(jsP2_1["x"].as<double>(), jsP2_1["y"].as<double>());
    Point p1_2(jsP1_2["x"].as<double>(), jsP1_2["y"].as<double>());
    Point p2_2(jsP2_2["x"].as<double>(), jsP2_2["y"].as<double>());
    
    Line line1(p1_1, p2_1);
    Line line2(p1_2, p2_2);
    
    return angleBetweenLines(line1, line2);
}

// Emscripten bindings
EMSCRIPTEN_BINDINGS(spatial_analysis_module) {
    function("buildAdjacencyList", &buildAdjacencyListWrapper);
    function("calculateConnectivity", &calculateConnectivityWrapper);
    function("calculateDepthFromRoot", &calculateDepthFromRootWrapper);
    function("calculateIntegrationForRoot", &calculateIntegrationForRootWrapper);
    function("checkLineIntersection", &checkLineIntersectionWrapper);
    function("angleBetweenLines", &angleBetweenLinesWrapper);
}
