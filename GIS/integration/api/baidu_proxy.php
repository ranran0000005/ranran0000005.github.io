<?php
/**
 * 百度地图 API 代理
 * 用于解决跨域问题，代理百度地图地理编码 API 请求
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 只允许 GET 和 POST 请求
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// 服务器端百度地图 API 密钥（推荐使用服务器端 key）
$SERVER_API_KEY = 'ZlxgX6bVovCzN38UV7ASypjvnc8N2M83';

// 获取参数
$address = isset($_GET['address']) ? trim($_GET['address']) : (isset($_POST['address']) ? trim($_POST['address']) : '');
// 优先使用服务器端 key，如果前端传了 key 也可以使用（向后兼容）
$ak = isset($_GET['ak']) && !empty(trim($_GET['ak'])) ? trim($_GET['ak']) : 
      (isset($_POST['ak']) && !empty(trim($_POST['ak'])) ? trim($_POST['ak']) : $SERVER_API_KEY);
// 百度地图API默认返回BD-09坐标，使用bd09ll更准确
// 如果需要WGS84，可以设置为wgs84ll，但转换可能有误差
$ret_coordtype = isset($_GET['ret_coordtype']) ? trim($_GET['ret_coordtype']) : (isset($_POST['ret_coordtype']) ? trim($_POST['ret_coordtype']) : 'bd09ll');

if (empty($address)) {
    http_response_code(400);
    echo json_encode([
        'status' => 2,
        'message' => '缺少必需参数: address'
    ]);
    exit;
}

// 现在使用服务器端 key，不需要检查 ak 是否为空
// 但如果需要，可以添加验证
if (empty($ak)) {
    http_response_code(400);
    echo json_encode([
        'status' => 5,
        'message' => 'API密钥未配置'
    ]);
    exit;
}

// 构建百度地图 API URL
$baidu_api_url = 'https://api.map.baidu.com/geocoding/v3/';
$params = [
    'address' => $address,
    'output' => 'json',
    'ak' => $ak,
    'ret_coordtype' => $ret_coordtype
];

$url = $baidu_api_url . '?' . http_build_query($params);

// 使用 cURL 调用百度地图 API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // 如果遇到 SSL 问题可以设置为 false
curl_setopt($ch, CURLOPT_USERAGENT, 'BaiduMap-Proxy/1.0');

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// 检查 cURL 错误
if ($response === false || !empty($curl_error)) {
    http_response_code(500);
    echo json_encode([
        'status' => 1,
        'message' => '请求失败: ' . ($curl_error ?: 'Unknown error'),
        'error' => $curl_error
    ]);
    exit;
}

// 检查 HTTP 状态码
if ($http_code !== 200) {
    http_response_code($http_code);
    echo json_encode([
        'status' => 1,
        'message' => 'HTTP error: ' . $http_code
    ]);
    exit;
}

// 解析 JSON 响应
$data = json_decode($response, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode([
        'status' => 1,
        'message' => 'JSON 解析失败: ' . json_last_error_msg()
    ]);
    exit;
}

// 直接返回百度地图 API 的响应
echo $response;
?>

