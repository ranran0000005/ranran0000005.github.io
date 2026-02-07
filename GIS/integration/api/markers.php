<?php
/**
 * 地图标注点 API
 * 处理标注点的增删改查操作
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理 OPTIONS 请求（CORS 预检）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 数据库配置
$db_host = 'localhost';
$db_name = 'gis_markers';
$db_user = 'map_user';  // 根据实际情况修改
$db_pass = 'mapdata87h7';      // 根据实际情况修改

// 如果使用单独的用户，可以使用：
// $db_user = 'gis_user';
// $db_pass = 'gis_password';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '数据库连接失败: ' . $e->getMessage()
    ]);
    exit;
}

// 获取请求方法和动作
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// 处理不同的请求
try {
    switch ($method) {
        case 'GET':
            if ($action === 'list' || $action === '') {
                // 获取所有标注
                $stmt = $pdo->query("SELECT * FROM markers ORDER BY created_at DESC");
                $markers = $stmt->fetchAll();
                
                // 将 decimal 转换为 float
                foreach ($markers as &$marker) {
                    $marker['longitude'] = (float)$marker['longitude'];
                    $marker['latitude'] = (float)$marker['latitude'];
                }
                
                echo json_encode([
                    'success' => true,
                    'data' => $markers
                ]);
            } elseif ($action === 'get' && isset($_GET['id'])) {
                // 获取单个标注
                $id = (int)$_GET['id'];
                $stmt = $pdo->prepare("SELECT * FROM markers WHERE id = ?");
                $stmt->execute([$id]);
                $marker = $stmt->fetch();
                
                if ($marker) {
                    $marker['longitude'] = (float)$marker['longitude'];
                    $marker['latitude'] = (float)$marker['latitude'];
                    echo json_encode([
                        'success' => true,
                        'data' => $marker
                    ]);
                } else {
                    http_response_code(404);
                    echo json_encode([
                        'success' => false,
                        'message' => '标注不存在'
                    ]);
                }
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '无效的请求参数'
                ]);
            }
            break;
            
        case 'POST':
            // 创建新标注
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($data['name']) || !isset($data['longitude']) || !isset($data['latitude'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少必需参数: name, longitude, latitude'
                ]);
                break;
            }
            
            $name = trim($data['name']);
            $description = isset($data['description']) ? trim($data['description']) : null;
            $longitude = (float)$data['longitude'];
            $latitude = (float)$data['latitude'];
            
            // 验证坐标范围
            if ($longitude < -180 || $longitude > 180 || $latitude < -90 || $latitude > 90) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '坐标范围无效'
                ]);
                break;
            }
            
            $stmt = $pdo->prepare("INSERT INTO markers (name, description, longitude, latitude) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $description, $longitude, $latitude]);
            $id = $pdo->lastInsertId();
            
            // 获取刚创建的标注
            $stmt = $pdo->prepare("SELECT * FROM markers WHERE id = ?");
            $stmt->execute([$id]);
            $marker = $stmt->fetch();
            $marker['longitude'] = (float)$marker['longitude'];
            $marker['latitude'] = (float)$marker['latitude'];
            
            echo json_encode([
                'success' => true,
                'message' => '标注创建成功',
                'data' => $marker
            ]);
            break;
            
        case 'PUT':
            // 更新标注
            $data = json_decode(file_get_contents('php://input'), true);
            
            if (!isset($data['id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少必需参数: id'
                ]);
                break;
            }
            
            $id = (int)$data['id'];
            $updates = [];
            $params = [];
            
            if (isset($data['name'])) {
                $updates[] = "name = ?";
                $params[] = trim($data['name']);
            }
            if (isset($data['description'])) {
                $updates[] = "description = ?";
                $params[] = trim($data['description']);
            }
            if (isset($data['longitude'])) {
                $updates[] = "longitude = ?";
                $params[] = (float)$data['longitude'];
            }
            if (isset($data['latitude'])) {
                $updates[] = "latitude = ?";
                $params[] = (float)$data['latitude'];
            }
            
            if (empty($updates)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '没有要更新的字段'
                ]);
                break;
            }
            
            $params[] = $id;
            $sql = "UPDATE markers SET " . implode(', ', $updates) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            if ($stmt->rowCount() > 0) {
                // 获取更新后的标注
                $stmt = $pdo->prepare("SELECT * FROM markers WHERE id = ?");
                $stmt->execute([$id]);
                $marker = $stmt->fetch();
                $marker['longitude'] = (float)$marker['longitude'];
                $marker['latitude'] = (float)$marker['latitude'];
                
                echo json_encode([
                    'success' => true,
                    'message' => '标注更新成功',
                    'data' => $marker
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => '标注不存在或未更改'
                ]);
            }
            break;
            
        case 'DELETE':
            // 删除标注
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => '缺少必需参数: id'
                ]);
                break;
            }
            
            $id = (int)$_GET['id'];
            $stmt = $pdo->prepare("DELETE FROM markers WHERE id = ?");
            $stmt->execute([$id]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => '标注删除成功'
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => '标注不存在'
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'message' => '不支持的请求方法'
            ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '数据库操作失败: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '服务器错误: ' . $e->getMessage()
    ]);
}

