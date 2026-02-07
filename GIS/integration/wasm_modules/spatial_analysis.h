#ifndef SPATIAL_ANALYSIS_H
#define SPATIAL_ANALYSIS_H

#include "point.h"
#include <vector>
#include <map>

/**
 * Check if two line segments intersect
 * @param line1 First line segment
 * @param line2 Second line segment
 * @param intersectionPoint Output parameter for intersection point
 * @return true if lines intersect, false otherwise
 */
bool checkLineIntersection(const Line& line1, const Line& line2, Point& intersectionPoint);

/**
 * Calculate angle between two lines in degrees (0-180)
 * @param line1 First line segment
 * @param line2 Second line segment
 * @return Angle in degrees
 */
double angleBetweenLines(const Line& line1, const Line& line2);

/**
 * Build adjacency list with weights for spatial analysis
 * @param lines All line segments
 * @param mode "topo" for topology only, "angle" for angle+length weighted
 * @param tulipBins Angle resolution for weighting (default 8)
 * @return Adjacency list where each entry is {featureIndex, weight}
 */
std::vector<std::vector<std::pair<int, double>>> buildAdjacencyList(
    const std::vector<Line>& lines,
    const char* mode,
    int tulipBins = 8
);

/**
 * Calculate connectivity (number of connections per feature)
 * @param adjacencyList Pre-computed adjacency list
 * @param featureCount Total number of features
 * @return Array of connectivity values (one per feature)
 */
std::vector<int> calculateConnectivity(
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    int featureCount
);

/**
 * Calculate depth from a root node using BFS
 * @param rootIndex Index of root node
 * @param adjacencyList Adjacency list with weights
 * @param nodeCount Total number of nodes
 * @return Total depth sum
 */
double calculateDepthFromRoot(
    int rootIndex,
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    int nodeCount
);

/**
 * Calculate integration value for a single root
 * @param rootIndex Index of root node
 * @param nodeCount Total number of nodes
 * @param adjacencyList Adjacency list with weights
 * @param applyFormula Whether to apply the integration formula
 * @param globalNodeCount Global node count for formula (use nodeCount if 0)
 * @param tulipBins Angle resolution for formula (default 8)
 * @return Integration value
 */
double calculateIntegrationForRoot(
    int rootIndex,
    int nodeCount,
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    bool applyFormula = true,
    int globalNodeCount = 0,
    int tulipBins = 8
);

#endif // SPATIAL_ANALYSIS_H
