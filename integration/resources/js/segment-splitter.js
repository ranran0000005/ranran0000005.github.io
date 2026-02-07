/**
 * Segment Splitting Module
 * Converts multi-vertex LineString features into individual line segments
 */

/**
 * Split a LineString feature into individual segments
 * Each segment becomes a separate feature with 2 points
 * @param {Object} feature - GeoJSON LineString feature
 * @param {number} parentIndex - Index of parent feature
 * @returns {Array<Object>} Array of segment features
 */
function splitLineStringToSegments(feature, parentIndex) {
    const segments = [];
    const geometry = feature.geometry;
    const properties = feature.properties || {};
    
    if (geometry.type === 'LineString') {
        const coords = geometry.coordinates;
        
        for (let i = 0; i < coords.length - 1; i++) {
            const segment = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [coords[i], coords[i + 1]]
                },
                properties: {
                    ...properties,
                    _parentIndex: parentIndex,
                    _segmentIndex: i,
                    _segmentId: `${parentIndex}_${i}`,
                    _isSegment: true
                }
            };
            segments.push(segment);
        }
    } else if (geometry.type === 'MultiLineString') {
        let segmentCounter = 0;
        geometry.coordinates.forEach((lineString, lineIdx) => {
            for (let i = 0; i < lineString.length - 1; i++) {
                const segment = {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [lineString[i], lineString[i + 1]]
                    },
                    properties: {
                        ...properties,
                        _parentIndex: parentIndex,
                        _lineIndex: lineIdx,
                        _segmentIndex: segmentCounter,
                        _segmentId: `${parentIndex}_${lineIdx}_${segmentCounter}`,
                        _isSegment: true
                    }
                };
                segments.push(segment);
                segmentCounter++;
            }
        });
    }
    
    return segments;
}

/**
 * Convert all features to segments
 * @param {Array<Object>} features - Array of GeoJSON features
 * @returns {Array<Object>} Array of segment features
 */
function convertFeaturesToSegments(features) {
    console.log('开始将线要素转换为段...');
    const allSegments = [];
    
    features.forEach((feature, index) => {
        const segments = splitLineStringToSegments(feature, index);
        allSegments.push(...segments);
    });
    
    console.log(`转换完成: ${features.length} 条线 → ${allSegments.length} 个段`);
    return allSegments;
}

/**
 * Merge segment results back to parent features
 * Aggregates segment values (average, max, or sum)
 * @param {Map} segmentResults - Results map with segment indices
 * @param {Array} allSegments - All segment features
 * @param {string} aggregation - 'average', 'max', or 'sum'
 * @returns {Map} Results map with parent feature indices
 */
function mergeSegmentResults(segmentResults, allSegments, aggregation = 'average') {
    const parentResults = new Map();
    const parentSegments = new Map(); // parentIndex -> [segmentValues]
    
    // Group segment results by parent
    segmentResults.forEach((value, segmentIndex) => {
        const segment = allSegments[segmentIndex];
        const parentIndex = segment.properties._parentIndex;
        
        if (!parentSegments.has(parentIndex)) {
            parentSegments.set(parentIndex, []);
        }
        parentSegments.get(parentIndex).push(value);
    });
    
    // Aggregate for each parent
    parentSegments.forEach((values, parentIndex) => {
        let result;
        
        switch (aggregation) {
            case 'average':
                result = values.reduce((sum, v) => sum + v, 0) / values.length;
                break;
            case 'max':
                result = Math.max(...values);
                break;
            case 'sum':
                result = values.reduce((sum, v) => sum + v, 0);
                break;
            default:
                result = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
        
        parentResults.set(parentIndex, result);
    });
    
    return parentResults;
}
