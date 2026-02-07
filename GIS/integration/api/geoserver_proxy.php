<?php
/**
 * GeoServer 代理 API
 * 用于解决跨域问题，代理 GeoServer 的 WMS GetCapabilities 请求
 */

header('Content-Type: application/xml; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 只允许 GET 请求
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// 获取参数
$workspace = isset($_GET['workspace']) ? trim($_GET['workspace']) : '';
$action = isset($_GET['action']) ? trim($_GET['action']) : 'capabilities';

if (empty($workspace)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing workspace parameter']);
    exit;
}

// GeoServer 基础 URL（根据实际情况修改）
$geoserver_base_url = 'http://gis.kjjfpt.top/geoserver';

// 尝试多种 URL 格式
$urls_to_try = [
    // 格式1: /workspace/wms
    $geoserver_base_url . '/' . urlencode($workspace) . '/wms?service=WMS&version=1.1.0&request=GetCapabilities',
    // 格式2: /wms?workspace=...
    $geoserver_base_url . '/wms?service=WMS&version=1.1.0&request=GetCapabilities&workspace=' . urlencode($workspace),
    // 格式3: /ows
    $geoserver_base_url . '/ows?service=WMS&version=1.1.0&request=GetCapabilities&workspace=' . urlencode($workspace),
    // 格式4: /workspace/ows
    $geoserver_base_url . '/' . urlencode($workspace) . '/ows?service=WMS&version=1.1.0&request=GetCapabilities',
];

$response = false;
$http_code = 0;
$error = '';
$success_url = '';

// 尝试每个 URL
foreach ($urls_to_try as $url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GeoServer-Proxy/1.0');
    
    $result = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    // 如果成功（HTTP 200），使用这个 URL
    if ($result !== false && $code === 200 && empty($err)) {
        $response = $result;
        $http_code = $code;
        $success_url = $url;
        break;
    }
    
    // 记录最后一个错误（用于调试）
    $error = "URL: $url, HTTP: $code" . ($err ? ", cURL Error: $err" : '');
}

// 检查错误
if ($response === false || !empty($error)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'Failed to fetch from GeoServer',
        'message' => $error ?: 'Unknown error',
        'tried_urls' => $urls_to_try,
        'last_url' => $success_url ?: $urls_to_try[0]
    ]);
    exit;
}

// 检查 HTTP 状态码
if ($http_code !== 200) {
    http_response_code($http_code);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'GeoServer returned error',
        'http_code' => $http_code,
        'tried_urls' => $urls_to_try,
        'last_url' => $success_url ?: $urls_to_try[0]
    ]);
    exit;
}

// 返回 XML 响应
echo $response;
?>

