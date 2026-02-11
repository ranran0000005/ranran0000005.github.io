/**
 * Shapefile Writer Module
 * 客户端生成Shapefile格式文件（.shp, .shx, .dbf）
 * 支持将空间分析结果导出为Shapefile格式
 */

/**
 * 将GeoJSON要素数组导出为Shapefile ZIP包
 * @param {Array} features - GeoJSON要素数组
 * @param {Object} options - 配置选项
 * @param {string} options.filename - 输出文件名（不含扩展名）
 * @param {Map} options.connectivity - 连接度结果Map（索引->值）
 * @param {Map} options.integration - 整合度结果Map（索引->值）
 * @returns {Promise<Blob>} ZIP文件的Blob对象
 */
async function exportToShapefile(features, options) {
    const filename = options.filename || 'spatial_analysis_result';
    const connectivity = options.connectivity || new Map();
    const integration = options.integration || new Map();

    console.log('开始导出Shapefile:', {
        featureCount: features.length,
        connectivityCount: connectivity.size,
        integrationCount: integration.size
    });

    // 预计算所有记录内容
    const recordContents = features.map(feature => writeShapeRecord(feature));

    // 生成三个核心文件
    const shpBuffer = writeShpFile(features, recordContents);
    const shxBuffer = writeShxFile(features, recordContents);
    const dbfBuffer = writeDbfFile(features, connectivity, integration);

    // 创建ZIP文件
    const zip = new JSZip();
    zip.file(filename + '.shp', shpBuffer);
    zip.file(filename + '.shx', shxBuffer);
    zip.file(filename + '.dbf', dbfBuffer);
    
    // 添加投影文件(.prj) - WGS84
    const prjContent = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["Degree",0.017453292519943295,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]';
    zip.file(filename + '.prj', prjContent);

    // 生成ZIP
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
}

/**
 * 写入SHP文件（主文件）
 * @param {Array} features - GeoJSON要素数组
 * @param {Array} recordContents - 预计算的记录内容数组
 * @returns {ArrayBuffer} SHP文件内容
 */
function writeShpFile(features, recordContents) {
    // 计算总长度
    let totalLength = 100; // 文件头
    features.forEach((feature, index) => {
        totalLength += 8 + recordContents[index].byteLength; // 记录头(8) + 内容
    });

    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // 文件头 (100 bytes)
    // 大端序写入
    view.setInt32(0, 9994, false); // 文件代码
    view.setInt32(24, totalLength / 2, false); // 文件长度（以16位字为单位）

    // 小端序写入
    view.setInt32(28, 1000, true); // 版本
    view.setInt32(32, getShapeType(features), true); // 形状类型

    // 边界框 (Xmin, Ymin, Xmax, Ymax, Zmin, Zmax, Mmin, Mmax)
    const bbox = calculateBoundingBox(features);
    view.setFloat64(36, bbox.xmin, true);
    view.setFloat64(44, bbox.ymin, true);
    view.setFloat64(52, bbox.xmax, true);
    view.setFloat64(60, bbox.ymax, true);
    view.setFloat64(68, 0, true); // Zmin
    view.setFloat64(76, 0, true); // Zmax
    view.setFloat64(84, 0, true); // Mmin
    view.setFloat64(92, 0, true); // Mmax

    // 写入记录
    let offset = 100;
    features.forEach((feature, index) => {
        const content = recordContents[index];
        const contentLength = content.byteLength;

        // 记录头 (8 bytes) - 大端序
        view.setInt32(offset, index + 1, false); // 记录号（从1开始）
        view.setInt32(offset + 4, contentLength / 2, false); // 记录长度（以16位字为单位）
        offset += 8;

        // 记录内容
        const contentArray = new Uint8Array(content);
        const targetArray = new Uint8Array(buffer, offset, contentLength);
        targetArray.set(contentArray);
        offset += contentLength;
    });

    return buffer;
}

/**
 * 写入SHX文件（索引文件）
 * @param {Array} features - GeoJSON要素数组
 * @param {Array} recordContents - 预计算的记录内容数组
 * @returns {ArrayBuffer} SHX文件内容
 */
function writeShxFile(features, recordContents) {
    const recordCount = features.length;
    const totalLength = 100 + recordCount * 8; // 文件头 + 每个记录的索引

    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // 文件头 (与SHP相同)
    view.setInt32(0, 9994, false); // 文件代码
    view.setInt32(24, totalLength / 2, false); // 文件长度
    view.setInt32(28, 1000, true); // 版本
    view.setInt32(32, getShapeType(features), true); // 形状类型

    // 边界框
    const bbox = calculateBoundingBox(features);
    view.setFloat64(36, bbox.xmin, true);
    view.setFloat64(44, bbox.ymin, true);
    view.setFloat64(52, bbox.xmax, true);
    view.setFloat64(60, bbox.ymax, true);

    // 写入记录索引
    let currentOffset = 100; // 第一个记录从文件头后开始
    let indexOffset = 100;

    features.forEach((feature, index) => {
        const content = recordContents[index];
        const contentLength = content.byteLength;
        const recordLength = 4 + contentLength; // 4 bytes shape type + content

        view.setInt32(indexOffset, currentOffset / 2, false); // 记录偏移（以16位字为单位）
        view.setInt32(indexOffset + 4, recordLength / 2, false); // 记录长度

        currentOffset += 8 + contentLength;
        indexOffset += 8;
    });

    return buffer;
}

/**
 * 写入DBF文件（属性表文件）
 * @param {Array} features - GeoJSON要素数组
 * @param {Map} connectivity - 连接度结果
 * @param {Map} integration - 整合度结果
 * @returns {ArrayBuffer} DBF文件内容
 */
function writeDbfFile(features, connectivity, integration) {
    // 定义字段结构
    const fields = [
        { name: 'ID', type: 'N', length: 10, decimal: 0 },
        { name: 'CONNECT', type: 'N', length: 10, decimal: 4 },
        { name: 'INTEGRATE', type: 'N', length: 15, decimal: 8 }
    ];

    const recordCount = features.length;
    const headerSize = 32 + fields.length * 32 + 1; // 文件头 + 字段描述 + 头结束符
    const recordSize = 1 + fields.reduce((sum, f) => sum + f.length, 0); // 删除标记 + 所有字段
    const totalSize = headerSize + recordCount * recordSize + 1; // +1 for EOF标记

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // 写入文件头 (32 bytes)
    view.setUint8(offset++, 0x03); // 版本号 (dBASE III)
    view.setUint8(offset++, new Date().getFullYear() - 1900); // 年份
    view.setUint8(offset++, new Date().getMonth() + 1); // 月份
    view.setUint8(offset++, new Date().getDate()); // 日期
    view.setUint32(offset, recordCount, true); // 记录数
    offset += 4;
    view.setUint16(offset, headerSize, true); // 文件头大小
    offset += 2;
    view.setUint16(offset, recordSize, true); // 记录大小
    offset += 2;
    // 保留字节 (20 bytes)
    for (let i = 0; i < 20; i++) {
        view.setUint8(offset++, 0);
    }

    // 写入字段描述 (每个32 bytes)
    fields.forEach(field => {
        // 字段名 (11 bytes, 以0结尾)
        const nameBytes = new TextEncoder().encode(field.name.padEnd(11, '\0'));
        for (let i = 0; i < 11; i++) {
            view.setUint8(offset++, nameBytes[i] || 0);
        }

        view.setUint8(offset++, field.type.charCodeAt(0)); // 字段类型
        view.setUint32(offset, 0, true); // 字段数据地址（未使用）
        offset += 4;
        view.setUint8(offset++, field.length); // 字段长度
        view.setUint8(offset++, field.decimal); // 小数位数
        // 保留字节 (14 bytes)
        for (let i = 0; i < 14; i++) {
            view.setUint8(offset++, 0);
        }
    });

    view.setUint8(offset++, 0x0D); // 文件头结束符

    // 写入记录
    features.forEach((feature, index) => {
        view.setUint8(offset++, 0x20); // 记录未删除标记 (空格)

        // ID字段
        const idValue = String(index).padStart(fields[0].length, ' ');
        const idBytes = new TextEncoder().encode(idValue);
        for (let i = 0; i < fields[0].length; i++) {
            view.setUint8(offset++, idBytes[i] || 0x20);
        }

        // 连接度字段
        const connValue = connectivity.has(index)
            ? String(connectivity.get(index).toFixed(fields[1].decimal)).padStart(fields[1].length, ' ')
            : ''.padStart(fields[1].length, ' ');
        const connBytes = new TextEncoder().encode(connValue);
        for (let i = 0; i < fields[1].length; i++) {
            view.setUint8(offset++, connBytes[i] || 0x20);
        }

        // 整合度字段
        const integValue = integration.has(index)
            ? String(integration.get(index).toFixed(fields[2].decimal)).padStart(fields[2].length, ' ')
            : ''.padStart(fields[2].length, ' ');
        const integBytes = new TextEncoder().encode(integValue);
        for (let i = 0; i < fields[2].length; i++) {
            view.setUint8(offset++, integBytes[i] || 0x20);
        }
    });

    view.setUint8(offset++, 0x1A); // 文件结束符

    return buffer;
}

/**
 * 写入单个形状记录内容
 * @param {Object} feature - GeoJSON要素
 * @returns {ArrayBuffer} 记录内容（不含记录头）
 */
function writeShapeRecord(feature) {
    const geometry = feature.geometry;

    if (geometry.type === 'LineString') {
        return writePolylineRecord(geometry.coordinates);
    } else if (geometry.type === 'MultiLineString') {
        // 将MultiLineString作为单个多段线处理
        const allCoords = geometry.coordinates;
        return writeMultiPolylineRecord(allCoords);
    }

    // 默认返回空形状
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setInt32(0, 0, true); // Null shape
    return buffer;
}

/**
 * 写入多段线记录 (Shape Type 3)
 * @param {Array} coordinates - 坐标数组
 * @returns {ArrayBuffer} 记录内容
 */
function writePolylineRecord(coordinates) {
    const numPoints = coordinates.length;
    const numParts = 1;
    const contentLength = 4 + 32 + 4 + 4 + numParts * 4 + numPoints * 16; // 类型 + 边界框 + 部分数 + 点数 + 部分索引 + 点坐标

    const buffer = new ArrayBuffer(contentLength);
    const view = new DataView(buffer);
    let offset = 0;

    // 形状类型 (3 = Polyline)
    view.setInt32(offset, 3, true);
    offset += 4;

    // 边界框
    const bbox = calculateLineBoundingBox(coordinates);
    view.setFloat64(offset, bbox.xmin, true);
    offset += 8;
    view.setFloat64(offset, bbox.ymin, true);
    offset += 8;
    view.setFloat64(offset, bbox.xmax, true);
    offset += 8;
    view.setFloat64(offset, bbox.ymax, true);
    offset += 8;

    // 部分数
    view.setInt32(offset, numParts, true);
    offset += 4;

    // 总点数
    view.setInt32(offset, numPoints, true);
    offset += 4;

    // 部分索引数组
    view.setInt32(offset, 0, true); // 第一个部分从第0个点开始
    offset += 4;

    // 点坐标
    coordinates.forEach(point => {
        view.setFloat64(offset, point[0], true); // X
        offset += 8;
        view.setFloat64(offset, point[1], true); // Y
        offset += 8;
    });

    return buffer;
}

/**
 * 写入多段多段线记录
 * @param {Array} lineStrings - 多段线数组
 * @returns {ArrayBuffer} 记录内容
 */
function writeMultiPolylineRecord(lineStrings) {
    const numParts = lineStrings.length;
    let totalPoints = 0;
    lineStrings.forEach(ls => totalPoints += ls.length);

    const contentLength = 4 + 32 + 4 + 4 + numParts * 4 + totalPoints * 16;

    const buffer = new ArrayBuffer(contentLength);
    const view = new DataView(buffer);
    let offset = 0;

    // 形状类型
    view.setInt32(offset, 3, true);
    offset += 4;

    // 计算整体边界框
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    lineStrings.forEach(coordinates => {
        coordinates.forEach(point => {
            xmin = Math.min(xmin, point[0]);
            ymin = Math.min(ymin, point[1]);
            xmax = Math.max(xmax, point[0]);
            ymax = Math.max(ymax, point[1]);
        });
    });

    view.setFloat64(offset, xmin, true);
    offset += 8;
    view.setFloat64(offset, ymin, true);
    offset += 8;
    view.setFloat64(offset, xmax, true);
    offset += 8;
    view.setFloat64(offset, ymax, true);
    offset += 8;

    // 部分数和总点数
    view.setInt32(offset, numParts, true);
    offset += 4;
    view.setInt32(offset, totalPoints, true);
    offset += 4;

    // 部分索引
    let pointIndex = 0;
    lineStrings.forEach((ls, i) => {
        view.setInt32(offset, pointIndex, true);
        offset += 4;
        pointIndex += ls.length;
    });

    // 点坐标
    lineStrings.forEach(coordinates => {
        coordinates.forEach(point => {
            view.setFloat64(offset, point[0], true);
            offset += 8;
            view.setFloat64(offset, point[1], true);
            offset += 8;
        });
    });

    return buffer;
}

/**
 * 获取形状类型
 * @param {Array} features - 要素数组
 * @returns {number} 形状类型代码
 */
function getShapeType(features) {
    if (features.length === 0) return 0;

    const geomType = features[0].geometry.type;
    switch (geomType) {
        case 'Point': return 1;
        case 'Polyline':
        case 'LineString':
        case 'MultiLineString': return 3;
        case 'Polygon': return 5;
        default: return 0;
    }
}

/**
 * 计算所有要素的边界框
 * @param {Array} features - 要素数组
 * @returns {Object} 边界框 {xmin, ymin, xmax, ymax}
 */
function calculateBoundingBox(features) {
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;

    features.forEach(feature => {
        const coords = getAllCoordinates(feature.geometry);
        coords.forEach(point => {
            xmin = Math.min(xmin, point[0]);
            ymin = Math.min(ymin, point[1]);
            xmax = Math.max(xmax, point[0]);
            ymax = Math.max(ymax, point[1]);
        });
    });

    return { xmin, ymin, xmax, ymax };
}

/**
 * 计算单条线段的边界框
 * @param {Array} coordinates - 坐标数组
 * @returns {Object} 边界框
 */
function calculateLineBoundingBox(coordinates) {
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;

    coordinates.forEach(point => {
        xmin = Math.min(xmin, point[0]);
        ymin = Math.min(ymin, point[1]);
        xmax = Math.max(xmax, point[0]);
        ymax = Math.max(ymax, point[1]);
    });

    return { xmin, ymin, xmax, ymax };
}

/**
 * 获取几何对象中的所有坐标
 * @param {Object} geometry - GeoJSON几何对象
 * @returns {Array} 坐标数组
 */
function getAllCoordinates(geometry) {
    const coords = [];

    if (geometry.type === 'Point') {
        coords.push(geometry.coordinates);
    } else if (geometry.type === 'LineString') {
        geometry.coordinates.forEach(c => coords.push(c));
    } else if (geometry.type === 'MultiLineString') {
        geometry.coordinates.forEach(line => line.forEach(c => coords.push(c)));
    } else if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(ring => ring.forEach(c => coords.push(c)));
    }

    return coords;
}

/**
 * 触发文件下载
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 文件名
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 导出空间分析结果为Shapefile
 * 这是主要的导出入口函数
 */
async function exportSpatialAnalysisResults() {
    try {
        // 检查是否有分析结果
        if (!spatialFeaturesCache || spatialFeaturesCache.length === 0) {
            showPopup('没有可导出的分析结果，请先执行空间分析');
            return;
        }

        if (!spatialAnalysisSource) {
            showPopup('没有找到分析结果图层');
            return;
        }

        // 收集连接度和整合度数据
        const connectivity = new Map();
        const integration = new Map();

        const features = spatialAnalysisSource.getFeatures();
        features.forEach((feature, index) => {
            const conn = feature.get('connectivity');
            const integ = feature.get('integration');

            if (conn !== undefined) {
                connectivity.set(index, conn);
            }
            if (integ !== undefined) {
                integration.set(index, integ);
            }
        });

        console.log('准备导出:', {
            featureCount: spatialFeaturesCache.length,
            connectivityCount: connectivity.size,
            integrationCount: integration.size
        });

        // 显示进度
        updateProgress('正在生成Shapefile...', 0);

        // 生成Shapefile
        const blob = await exportToShapefile(spatialFeaturesCache, {
            filename: 'spatial_analysis_result',
            connectivity: connectivity,
            integration: integration
        });

        updateProgress('正在下载...', 90);

        // 下载文件
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        downloadBlob(blob, `spatial_analysis_${timestamp}.zip`);

        updateProgress('导出完成！', 100);
        closeProgress(2000);

        showPopup('✓ Shapefile导出成功！');

    } catch (error) {
        console.error('导出失败:', error);
        closeProgress(0);
        showPopup('导出失败：' + error.message);
    }
}
