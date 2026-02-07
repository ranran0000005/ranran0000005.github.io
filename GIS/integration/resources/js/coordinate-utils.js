/**
 * 坐标转换工具函数
 * 处理 BD-09、GCJ-02 和 WGS84 之间的坐标转换
 */

const PI = Math.PI;
const X_PI = PI * 3000.0 / 180.0;

/**
 * BD-09 转 GCJ-02（火星坐标系）
 * @param {number} bdLng - BD-09 经度
 * @param {number} bdLat - BD-09 纬度
 * @returns {Array<number>} [GCJ-02经度, GCJ-02纬度]
 */
function bd09ToGcj02(bdLng, bdLat) {
    const x = bdLng - 0.0065;
    const y = bdLat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
    const gcjLng = z * Math.cos(theta);
    const gcjLat = z * Math.sin(theta);
    return [gcjLng, gcjLat];
}

/**
 * GCJ-02 转 BD-09
 * @param {number} gcjLng - GCJ-02 经度
 * @param {number} gcjLat - GCJ-02 纬度
 * @returns {Array<number>} [BD-09经度, BD-09纬度]
 */
function gcj02ToBd09(gcjLng, gcjLat) {
    const z = Math.sqrt(gcjLng * gcjLng + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * X_PI);
    const theta = Math.atan2(gcjLat, gcjLng) + 0.000003 * Math.cos(gcjLng * X_PI);
    const bdLng = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return [bdLng, bdLat];
}

/**
 * GCJ-02 转 WGS84
 * @param {number} gcjLng - GCJ-02 经度
 * @param {number} gcjLat - GCJ-02 纬度
 * @returns {Array<number>} [WGS84经度, WGS84纬度]
 */
function gcj02ToWgs84(gcjLng, gcjLat) {
    let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
    let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
    const radLat = gcjLat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - 0.00669342162296594323 * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (6378245.0 / sqrtMagic * Math.cos(radLat) * PI);
    const wgsLat = gcjLat - dLat;
    const wgsLng = gcjLng - dLng;
    return [wgsLng, wgsLat];
}

/**
 * WGS84 转 GCJ-02
 * @param {number} wgsLng - WGS84 经度
 * @param {number} wgsLat - WGS84 纬度
 * @returns {Array<number>} [GCJ-02经度, GCJ-02纬度]
 */
function wgs84ToGcj02(wgsLng, wgsLat) {
    let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
    let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
    const radLat = wgsLat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - 0.00669342162296594323 * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (6378245.0 / sqrtMagic * Math.cos(radLat) * PI);
    const gcjLat = wgsLat + dLat;
    const gcjLng = wgsLng + dLng;
    return [gcjLng, gcjLat];
}

/**
 * BD-09 转 WGS84
 * 百度坐标系转国际标准坐标系
 * @param {number} bdLng - BD-09 经度
 * @param {number} bdLat - BD-09 纬度
 * @returns {Array<number>} [WGS84经度, WGS84纬度]
 */
function bd09ToWgs84(bdLng, bdLat) {
    // 先转GCJ-02，再转WGS84
    const gcj02 = bd09ToGcj02(bdLng, bdLat);
    return gcj02ToWgs84(gcj02[0], gcj02[1]);
}

/**
 * WGS84 转 BD-09
 * 国际标准坐标系转百度坐标系
 * @param {number} wgsLng - WGS84 经度
 * @param {number} wgsLat - WGS84 纬度
 * @returns {Array<number>} [BD-09经度, BD-09纬度]
 */
function wgs84ToBd09(wgsLng, wgsLat) {
    // 先转GCJ-02，再转BD-09
    const gcj02 = wgs84ToGcj02(wgsLng, wgsLat);
    return gcj02ToBd09(gcj02[0], gcj02[1]);
}

/**
 * 辅助函数：纬度转换
 */
function transformLat(lng, lat) {
    let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

/**
 * 辅助函数：经度转换
 */
function transformLng(lng, lat) {
    let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
    ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

