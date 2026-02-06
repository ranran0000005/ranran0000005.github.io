<?php
header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/db.php';

// 简单的 JSON 输出助手
function json_response($data, int $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function generate_code(int $length = 6): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $res = '';
    for ($i = 0; $i < $length; $i++) {
        $res .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $res;
}

function generate_token(): string
{
    return bin2hex(random_bytes(16));
}

// 初始化 15x15 空棋盘
function empty_board(): string
{
    return str_repeat('.', 15 * 15);
}

// 棋盘坐标转 index
function idx(int $row, int $col): int
{
    return $row * 15 + $col;
}

// 检查五连
function check_winner(string $board, int $lastRow, int $lastCol, string $stone): bool
{
    $dirs = [
        [1, 0],  // 纵
        [0, 1],  // 横
        [1, 1],  // 斜 \
        [1, -1], // 斜 /
    ];

    foreach ($dirs as [$dr, $dc]) {
        $count = 1;

        // 正方向
        $r = $lastRow + $dr;
        $c = $lastCol + $dc;
        while ($r >= 0 && $r < 15 && $c >= 0 && $c < 15 && $board[idx($r, $c)] === $stone) {
            $count++;
            $r += $dr;
            $c += $dc;
        }

        // 反方向
        $r = $lastRow - $dr;
        $c = $lastCol - $dc;
        while ($r >= 0 && $r < 15 && $c >= 0 && $c < 15 && $board[idx($r, $c)] === $stone) {
            $count++;
            $r -= $dr;
            $c -= $dc;
        }

        if ($count >= 5) {
            return true;
        }
    }

    return false;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';

try {
    if ($action === 'init_db') {
        init_db();
        json_response(['ok' => true, 'message' => 'tables created (if not exist)']);
    }

    if ($action === 'create_game') {
        $pdo = get_pdo();

        // 限制最多 10 个房间
        $count = (int)$pdo->query("SELECT COUNT(*) AS c FROM games")->fetch()['c'];
        if ($count >= 10) {
            json_response([
                'ok' => false,
                'code' => 'ROOMS_LIMIT',
                'error' => '当前房间数量已达到上限（10 个），请先删除一些旧房间。',
            ], 400);
        }

        $code = generate_code();
        $board = empty_board();
        $currentTurn = 'B'; // 黑先
        $token = generate_token(); // 创建者默认执黑

        $stmt = $pdo->prepare("INSERT INTO games (code, board, current_turn, status, player_black_token) VALUES (?, ?, ?, 'waiting', ?)");
        $stmt->execute([$code, $board, $currentTurn, $token]);

        json_response([
            'ok' => true,
            'code' => $code,
            'role' => 'B',
            'token' => $token,
        ]);
    }

    if ($action === 'cleanup_games') {
        $pdo = get_pdo();
        // 这里简单处理为删除所有房间，如果你以后要更精细，可以只删已结束的房间
        $deleted = $pdo->exec("DELETE FROM games");

        json_response([
            'ok' => true,
            'deleted' => $deleted,
            'message' => '已删除所有现有房间',
        ]);
    }

    if ($action === 'join_game') {
        $code = trim($_POST['code'] ?? $_GET['code'] ?? '');
        if ($code === '') {
            json_response(['ok' => false, 'error' => '缺少房间号'], 400);
        }

        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM games WHERE code = ?");
        $stmt->execute([$code]);
        $game = $stmt->fetch();

        if (!$game) {
            json_response(['ok' => false, 'error' => '房间不存在'], 404);
        }

        // 如果白方还没人，就加入为白方，否则只返回观战信息
        if ($game['player_white_token'] === null) {
            $token = generate_token();
            $stmt = $pdo->prepare("UPDATE games SET player_white_token = ?, status = 'playing' WHERE id = ?");
            $stmt->execute([$token, $game['id']]);
            $role = 'W';
        } else {
            $token = null;
            $role = 'spectator';
        }

        json_response([
            'ok' => true,
            'code' => $game['code'],
            'role' => $role,
            'token' => $token,
            'status' => $game['status'],
        ]);
    }

    if ($action === 'get_state') {
        $code = trim($_GET['code'] ?? '');
        if ($code === '') {
            json_response(['ok' => false, 'error' => '缺少房间号'], 400);
        }

        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM games WHERE code = ?");
        $stmt->execute([$code]);
        $game = $stmt->fetch();

        if (!$game) {
            json_response(['ok' => false, 'error' => '房间不存在'], 404);
        }

        json_response([
            'ok' => true,
            'code' => $game['code'],
            'board' => $game['board'],
            'current_turn' => $game['current_turn'],
            'status' => $game['status'],
            'winner' => $game['winner'],
        ]);
    }

    if ($action === 'make_move') {
        $code = trim($_POST['code'] ?? '');
        $token = trim($_POST['token'] ?? '');
        $row = isset($_POST['row']) ? (int)$_POST['row'] : -1;
        $col = isset($_POST['col']) ? (int)$_POST['col'] : -1;

        if ($code === '' || $token === '') {
            json_response(['ok' => false, 'error' => '缺少参数'], 400);
        }
        if ($row < 0 || $row >= 15 || $col < 0 || $col >= 15) {
            json_response(['ok' => false, 'error' => '坐标非法'], 400);
        }

        $pdo = get_pdo();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("SELECT * FROM games WHERE code = ? FOR UPDATE");
        $stmt->execute([$code]);
        $game = $stmt->fetch();

        if (!$game) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => '房间不存在'], 404);
        }

        if ($game['status'] !== 'playing') {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => '游戏未在进行中'], 400);
        }

        // 判断当前 token 是黑还是白
        $stone = null;
        if ($token === $game['player_black_token']) {
            $stone = 'B';
        } elseif ($token === $game['player_white_token']) {
            $stone = 'W';
        } else {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => '无效玩家'], 403);
        }

        // 是否轮到该玩家
        if ($stone !== $game['current_turn']) {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => '还没轮到你'], 400);
        }

        $board = $game['board'];
        $i = idx($row, $col);
        if ($board[$i] !== '.') {
            $pdo->rollBack();
            json_response(['ok' => false, 'error' => '该位置已被占用'], 400);
        }

        // 落子
        $board[$i] = $stone;

        $winner = null;
        $status = 'playing';

        if (check_winner($board, $row, $col, $stone)) {
            $winner = $stone;
            $status = 'finished';
        } elseif (strpos($board, '.') === false) {
            $winner = 'draw';
            $status = 'finished';
        }

        $nextTurn = $stone === 'B' ? 'W' : 'B';

        $stmt = $pdo->prepare("UPDATE games SET board = ?, current_turn = ?, status = ?, winner = ? WHERE id = ?");
        $stmt->execute([$board, $nextTurn, $status, $winner, $game['id']]);

        $pdo->commit();

        json_response([
            'ok' => true,
            'board' => $board,
            'current_turn' => $nextTurn,
            'status' => $status,
            'winner' => $winner,
        ]);
    }

    json_response(['ok' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_response(['ok' => false, 'error' => '服务器异常: ' . $e->getMessage()], 500);
}


