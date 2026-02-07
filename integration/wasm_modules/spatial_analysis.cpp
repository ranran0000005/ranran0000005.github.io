#include "spatial_analysis.h"
#include <cmath>
#include <queue>
#include <algorithm>
#include <limits>

// Constants
const double EPSILON = 1e-10;
const Point INVALID_POINT(-123456.0, -789012.0);

/**
 * Check if two line segments intersect
 */
bool checkLineIntersection(const Line& line1, const Line& line2, Point& intersectionPoint) {
    const Point& p1 = line1.p1;
    const Point& p2 = line1.p2;
    const Point& p3 = line2.p1;
    const Point& p4 = line2.p2;
    
    double x1 = p1.x, y1 = p1.y;
    double x2 = p2.x, y2 = p2.y;
    double x3 = p3.x, y3 = p3.y;
    double x4 = p4.x, y4 = p4.y;
    
    // Calculate denominator
    double denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (std::abs(denom) < EPSILON) {
        intersectionPoint = INVALID_POINT;
        return false; // Lines are parallel
    }
    
    // Calculate intersection parameters
    double t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    double u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    // Check if intersection is within both line segments
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        intersectionPoint.x = x1 + t * (x2 - x1);
        intersectionPoint.y = y1 + t * (y2 - y1);
        return true;
    }
    
    intersectionPoint = INVALID_POINT;
    return false;
}

/**
 * Calculate angle between two lines in degrees (0-180)
 */
double angleBetweenLines(const Line& line1, const Line& line2) {
    Point v1 = line1.direction();
    Point v2 = line2.direction();
    
    double len1 = std::sqrt(v1.x * v1.x + v1.y * v1.y);
    double len2 = std::sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (len1 < EPSILON || len2 < EPSILON) return 0.0;
    
    double dot = v1.x * v2.x + v1.y * v2.y;
    double cos_angle = dot / (len1 * len2);
    cos_angle = std::max(-1.0, std::min(1.0, cos_angle)); // Clamp to [-1, 1]
    
    double angle_rad = std::acos(cos_angle);
    double angle_deg = angle_rad * 180.0 / M_PI;
    
    // Return minimum angle (lines are undirected)
    return std::min(angle_deg, 180.0 - angle_deg);
}

/**
 * Build adjacency list with weights
 */
std::vector<std::vector<std::pair<int, double>>> buildAdjacencyList(
    const std::vector<Line>& lines,
    const char* mode,
    int tulipBins
) {
    // First, group lines by feature index
    std::map<int, std::vector<int>> featureToLines;
    for (size_t i = 0; i < lines.size(); i++) {
        featureToLines[lines[i].featureIndex].push_back(i);
    }
    
    int featureCount = featureToLines.size();
    std::vector<std::vector<std::pair<int, double>>> adjacencyList(featureCount);
    
    bool useAngleWeight = (std::string(mode) == "angle");
    
    // Check intersection between features
    for (int f1 = 0; f1 < featureCount; f1++) {
        for (int f2 = f1 + 1; f2 < featureCount; f2++) {
            const auto& lines1 = featureToLines[f1];
            const auto& lines2 = featureToLines[f2];
            
            bool intersects = false;
            double angle = 0.0;
            double avgLength = 0.0;
            
            // Check all line pairs between these two features
            for (int idx1 : lines1) {
                for (int idx2 : lines2) {
                    Point intersection;
                    if (checkLineIntersection(lines[idx1], lines[idx2], intersection)) {
                        intersects = true;
                        angle = angleBetweenLines(lines[idx1], lines[idx2]);
                        avgLength = (lines[idx1].length() + lines[idx2].length()) / 2.0;
                        break;
                    }
                }
                if (intersects) break;
            }
            
            if (intersects) {
                double weight = 1.0;
                
                if (useAngleWeight) {
                    // Calculate weight based on angle and length
                    double binSize = 180.0 / tulipBins;
                    int bin = static_cast<int>(angle / binSize);
                    bin = std::min(bin, tulipBins - 1);
                    
                    // Weight formula: (1 + bin) * avgLength
                    weight = (1.0 + bin) * avgLength;
                }
                
                // Add bidirectional edges
                adjacencyList[f1].push_back({f2, weight});
                adjacencyList[f2].push_back({f1, weight});
            }
        }
    }
    
    return adjacencyList;
}

/**
 * Calculate connectivity
 */
std::vector<int> calculateConnectivity(
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    int featureCount
) {
    std::vector<int> connectivity(featureCount);
    
    for (int i = 0; i < featureCount; i++) {
        connectivity[i] = adjacencyList[i].size();
    }
    
    return connectivity;
}

/**
 * Calculate depth from a root node using BFS with weighted edges
 */
double calculateDepthFromRoot(
    int rootIndex,
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    int nodeCount
) {
    std::vector<double> depth(nodeCount, std::numeric_limits<double>::infinity());
    depth[rootIndex] = 0.0;
    
    // Priority queue: {depth, nodeIndex}
    std::priority_queue<
        std::pair<double, int>,
        std::vector<std::pair<double, int>>,
        std::greater<std::pair<double, int>>
    > pq;
    
    pq.push({0.0, rootIndex});
    
    while (!pq.empty()) {
        auto [currentDepth, node] = pq.top();
        pq.pop();
        
        if (currentDepth > depth[node]) continue;
        
        // Check bounds
        if (node < 0 || node >= (int)adjacencyList.size()) continue;
        
        for (const auto& [neighbor, weight] : adjacencyList[node]) {
            // Check bounds for neighbor
            if (neighbor < 0 || neighbor >= nodeCount) continue;
            
            double newDepth = currentDepth + weight;
            if (newDepth < depth[neighbor]) {
                depth[neighbor] = newDepth;
                pq.push({newDepth, neighbor});
            }
        }
    }
    
    // Sum all depths - handle unreachable nodes more gracefully
    double totalDepth = 0.0;
    int reachableCount = 0;
    
    for (int i = 0; i < nodeCount; i++) {
        if (i != rootIndex) {
            if (depth[i] != std::numeric_limits<double>::infinity()) {
                totalDepth += depth[i];
                reachableCount++;
            }
        }
    }
    
    // If there are unreachable nodes, add a moderate penalty
    // instead of extreme penalty to avoid dominating the calculation
    int unreachableCount = nodeCount - 1 - reachableCount;
    if (unreachableCount > 0 && reachableCount > 0) {
        // Calculate average depth of reachable nodes
        double avgDepth = totalDepth / reachableCount;
        // Add penalty based on average depth * 2 for each unreachable node
        totalDepth += unreachableCount * avgDepth * 2.0;
    } else if (reachableCount == 0) {
        // All nodes unreachable - this node is completely isolated
        // Return a very high but not extreme value
        totalDepth = nodeCount * nodeCount * 1.0;
    }
    
    return totalDepth;
}

/**
 * Calculate integration value for a single root
 * Uses the same formula as JavaScript implementation for consistency
 */
double calculateIntegrationForRoot(
    int rootIndex,
    int nodeCount,
    const std::vector<std::vector<std::pair<int, double>>>& adjacencyList,
    bool applyFormula,
    int globalNodeCount,
    int tulipBins
) {
    if (globalNodeCount == 0) {
        globalNodeCount = nodeCount;
    }
    
    double MD = calculateDepthFromRoot(rootIndex, adjacencyList, nodeCount);
    
    if (!applyFormula) {
        return MD;
    }
    
    // Apply integration formula (must match JavaScript implementation exactly)
    // Integration = n² / totalDepth_conv
    // totalDepth_conv = (2 * MD) / (tulipBins - 1)
    
    if (nodeCount <= 0 || tulipBins <= 1) return 0.0;
    
    double totalDepthConv = (2.0 * MD) / (static_cast<double>(tulipBins) - 1.0);
    
    if (totalDepthConv <= 0.0 || std::isnan(totalDepthConv) || std::isinf(totalDepthConv)) {
        return 0.0;
    }
    
    double integration = (static_cast<double>(nodeCount) * static_cast<double>(nodeCount)) / totalDepthConv;
    
    // Check for invalid results
    if (std::isnan(integration) || std::isinf(integration)) {
        return 0.0;
    }
    
    return integration;
}
