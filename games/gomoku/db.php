<?php
// 简单的数据库连接配置，请根据自己的环境修改

$DB_HOST = 'localhost';
$DB_NAME = 'gomoku_db';   // 请先在 MySQL 中创建这个数据库，或改成你已有的库名
$DB_USER = 'player';
$DB_PASS = 'player123';
$DB_CHARSET = 'utf8mb4';

function get_pdo(): PDO
{
    static $pdo = null;
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_CHARSET;

    if ($pdo === null) {
        $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
    }

    return $pdo;
}

/**
 * 初始化数据表（如果不存在就创建）
 * 你可以在浏览器里访问 api.php?action=init_db 来自动创建表
 */
function init_db()
{
    $pdo = get_pdo();

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS games (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,          -- 房间号/分享码
    board TEXT NOT NULL,                       -- 15x15 棋盘，用 225 长度的字符串保存，. 表示空，B 表示黑，W 表示白
    current_turn ENUM('B','W') NOT NULL,       -- 当前轮到谁落子
    status ENUM('waiting','playing','finished') NOT NULL DEFAULT 'waiting',
    player_black_token VARCHAR(64) DEFAULT NULL,
    player_white_token VARCHAR(64) DEFAULT NULL,
    winner ENUM('B','W','draw') DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL;

    $pdo->exec($sql);
}


