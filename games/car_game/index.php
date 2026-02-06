<?php
// 数据库配置
$db_host = 'localhost';
$db_name = 'car_game';
$db_user = 'player';
$db_pass = 'player123';

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    // 如果数据库连接失败，继续运行游戏但不保存分数
    echo '<script>alert("数据库连接失败: ' . addslashes($e->getMessage()) . '");</script>';
}

// 处理分数提交
if ($_POST['action'] ?? '' === 'submit_score') {
    $response = ['success' => false, 'message' => ''];
    
    if (isset($pdo)) {
        try {
            $stmt = $pdo->prepare("INSERT INTO high_scores (player_name, score, distance, level, game_time) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $_POST['player_name'] ?? '匿名玩家',
                $_POST['score'] ?? 0,
                $_POST['distance'] ?? 0,
                $_POST['level'] ?? 1,
                $_POST['game_time'] ?? 0
            ]);
            $response['success'] = true;
            $response['message'] = '分数提交成功！';
        } catch(PDOException $e) {
            $response['message'] = '分数提交失败: ' . $e->getMessage();
        }
    } else {
        $response['message'] = '数据库连接不可用，分数无法保存';
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// 获取高分榜
$high_scores = [];
if (isset($pdo)) {
    try {
        $stmt = $pdo->prepare("SELECT player_name, score, distance, level, game_time 
                              FROM high_scores 
                              ORDER BY score DESC 
                              LIMIT 10");
        $stmt->execute();
        $high_scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e) {
        error_log("获取高分榜失败: " . $e->getMessage());
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PHP 2D赛车游戏 - 带数据库</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
        }
        body {
            background: linear-gradient(to bottom, #2c3e50, #1a1a2e);
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            margin: 0;
        }
        .header {
            text-align: center;
            margin-bottom: 10px;
            width: 100%;
        }
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 5px;
            color: #f1c40f;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .header p {
            font-size: 0.9rem;
            max-width: 800px;
            margin: 0 auto 10px;
            line-height: 1.4;
        }
        .game-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 20px;
            max-width: 100%;
            width: 100%;
            margin: 0 auto;
        }
        .game-area {
            flex: 1;
            min-width: 600px;
            max-width: 100%;
            background: linear-gradient(145deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.2));
            border-radius: 15px;
            padding: 15px;
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        #gameCanvas {
            width: 100%;
            height: auto;
            max-width: 1024px;
            display: block;
            margin: 0 auto;
        }
        .game-ui {
            flex: 0 0 300px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .info-panel, .controls-panel, .high-scores {
            background: linear-gradient(145deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.2));
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .info-panel h2, .controls-panel h2, .high-scores h2 {
            color: #f1c40f;
            margin-bottom: 15px;
            font-size: 1.5rem;
            border-bottom: 2px solid #f1c40f;
            padding-bottom: 5px;
        }
        .stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .stat {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-value {
            color: #f1c40f;
            font-weight: bold;
        }
        .controls-list {
            list-style: none;
        }
        .controls-list li {
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
        }
        .key {
            background: rgba(255, 255, 255, 0.1);
            padding: 3px 8px;
            border-radius: 5px;
            font-family: monospace;
        }
        canvas {
            display: block;
            background: #1e272e;
            border-radius: 5px;
            margin: 0 auto;
            border: 2px solid #34495e;
            max-width: 100%;
            height: auto;
        }
        .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        
        .game-button {
            padding: 10px 20px;
            font-size: 1rem;
            font-weight: bold;
            border: none;
            border-radius: 5px;
            background: linear-gradient(45deg, #f1c40f, #f39c12);
            color: #2c3e50;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .game-button:hover {
            background: linear-gradient(45deg, #f39c12, #e67e22);
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
        }
        
        .game-button:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        /* 基础按钮样式被.game-button替代 */
        /* 保留flex布局以便与现有代码兼容 */
        .buttons button {
            flex: 1;
        }
        #start-btn {
            background: #2ecc71;
        }
        #start-btn:hover {
            background: #27ae60;
        }
        .score-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .score-rank {
            color: #f1c40f;
            font-weight: bold;
            width: 30px;
        }
        .score-name {
            flex: 1;
            margin-left: 10px;
        }
        .score-value {
            color: #f1c40f;
            font-weight: bold;
        }
        .score-details {
            font-size: 0.8rem;
            color: #95a5a6;
            margin-top: 2px;
        }
        .game-over {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(145deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.8));
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            display: none;
            z-index: 10;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .game-over h2 {
            color: #e74c3c;
            font-size: 2.5rem;
            margin-bottom: 20px;
        }
        .final-score {
            font-size: 1.5rem;
            margin-bottom: 20px;
            color: #f1c40f;
        }
        .name-input {
            width: 100%;
            padding: 12px;
            margin: 15px 0;
            border: none;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 1rem;
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            display: none;
        }
        .success {
            background: rgba(46, 204, 113, 0.2);
            border: 1px solid #2ecc71;
            color: #2ecc71;
        }
        .error {
            background: rgba(231, 76, 60, 0.2);
            border: 1px solid #e74c3c;
            color: #e74c3c;
        }
        @media (max-width: 1000px) {
            .game-container {
                flex-direction: column;
            }
            .game-area {
                min-width: 100%;
            }
            .game-ui {
                flex: 1;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PHP 2D赛车游戏 - 带数据库</h1>
        <p>控制你的赛车，避开障碍物，收集加速道具，获得最高分数！您的分数将保存到数据库中。</p>
    </div>
    
    <div class="game-container">
        <div class="game-area">
            <canvas id="gameCanvas" width="1024" height="680"></canvas>
        </div>
        
        <div class="game-ui">
            <div class="info-panel">
                <h2>游戏状态</h2>
                <div class="stats">
                    <div class="stat">
                        <span>分数:</span>
                        <span id="score" class="stat-value">0</span>
                    </div>
                    <div class="stat">
                        <span>速度:</span>
                        <span id="speed" class="stat-value">0 km/h</span>
                    </div>
                    <div class="stat">
                        <span>距离:</span>
                        <span id="distance" class="stat-value">0 m</span>
                    </div>
                    <div class="stat">
                        <span>生命:</span>
                        <span id="lives" class="stat-value">3</span>
                    </div>
                    <div class="stat">
                        <span>等级:</span>
                        <span id="level" class="stat-value">1</span>
                    </div>
                    <div class="stat">
                        <span>时间:</span>
                        <span id="time" class="stat-value">0 s</span>
                    </div>
                </div>
                
                <div class="buttons">
                    <button id="start-btn" class="game-button">开始</button>
                    <button id="pause-btn" class="game-button">暂停</button>
                    <button onclick="location.href='../'" class="game-button">退出</button>
                </div>
            </div>
            
            <div class="controls-panel">
                <h2>游戏控制</h2>
                <ul class="controls-list">
                    <li>
                        <span>加速</span>
                        <span class="key">↑</span>
                    </li>
                    <li>
                        <span>减速</span>
                        <span class="key">↓</span>
                    </li>
                    <li>
                        <span>左转</span>
                        <span class="key">←</span>
                    </li>
                    <li>
                        <span>右转</span>
                        <span class="key">→</span>
                    </li>
                    <li>
                        <span>暂停</span>
                        <span class="key">P</span>
                    </li>
                </ul>
            </div>
            
            <div class="high-scores">
                <h2>最高分数</h2>
                <div id="scores-list">
                    <?php if (empty($high_scores)): ?>
                        <div class="score-item">
                            <span>暂无记录</span>
                        </div>
                    <?php else: ?>
                        <?php foreach ($high_scores as $index => $score): ?>
                            <div class="score-item">
                                <span class="score-rank"><?php echo $index + 1; ?>.</span>
                                <div class="score-name">
                                    <?php echo htmlspecialchars($score['player_name']); ?>
                                    <div class="score-details">
                                        距离: <?php echo $score['distance']; ?>m | 
                                        等级: <?php echo $score['level']; ?> | 
                                        时间: <?php echo $score['game_time']; ?>s
                                    </div>
                                </div>
                                <span class="score-value"><?php echo $score['score']; ?></span>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
    
    <div class="game-over" id="game-over">
        <h2>游戏结束</h2>
        <div class="final-score">你的分数: <span id="final-score">0</span></div>
        <div class="message" id="message"></div>
          <input type="text" class="name-input" id="player-name" placeholder="输入你的名字" maxlength="15">
          <div class="buttons">
              <button id="restart-btn" class="game-button">重开</button>
              <button id="submit-score" class="game-button">提交分数</button>
            </div>
    </div>

    <script>
        // 游戏变量
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        let gameRunning = false;
        let gamePaused = false;
        let score = 0;
        let distance = 0;
        let lives = 3;
        let level = 1;
        let gameTime = 0;
        let lastTime = 0;
        let animationId;
        // 标准化因子，使游戏在不同设备上运行速度一致
        const NORMALIZATION_FACTOR = 16; // 假设目标60fps，约16ms每帧
        
        // 玩家赛车
        const playerCar = {
            x: canvas.width / 2 - 30,
            y: canvas.height - 200, // 增加车后空间，将赛车位置向上移
            width: 60,
            height: 100,
            color: '#e74c3c',
            speed: 0,
            baseSpeed: 0,
            maxSpeed: 3,
            acceleration: 0.05,
            deceleration: 0.03,
            steering: 0,
            maxSteering: 6,
            isBoosted: false,
            boostTime: 0,
            boostDuration: 3000 // 3秒加速时间
        };
        
        // 道路
        const road = {
            width: 550, // 增加道路宽度以匹配新的画布尺寸
            x: (canvas.width - 550) / 2,
            laneWidth: 550 / 3,
            markings: [],
            markingWidth: 12,
            markingHeight: 35,
            markingGap: 25
        };
        
        // 初始化道路标记
        for (let i = 0; i < 20; i++) {
            road.markings.push({
                x: road.x + road.laneWidth * 1.5 - road.markingWidth / 2,
                y: i * (road.markingHeight + road.markingGap) - road.markingHeight
            });
        }
        
        // 障碍物和道具
        let obstacles = [];
        let powerUps = [];
        
        // 按键状态
        const keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };
        
        // 游戏初始化
        function initGame() {
            score = 0;
            distance = 0;
            lives = 3;
            level = 1;
            gameTime = 0;
            
            playerCar.x = canvas.width / 2 - 25;
            playerCar.y = canvas.height - 200; // 保持初始化位置一致
            playerCar.speed = 0;
            playerCar.baseSpeed = 0;
            playerCar.steering = 0;
            playerCar.isBoosted = false;
            playerCar.boostTime = 0;
            playerCar.maxSpeed = 3;
            
            obstacles = [];
            powerUps = [];
            
            updateUI();
        }
        
        // 更新UI
        function updateUI() {
            document.getElementById('score').textContent = Math.round(score);
            document.getElementById('speed').textContent = Math.round(playerCar.speed * 15) + ' km/h';
            document.getElementById('distance').textContent = Math.round(distance) + ' m';
            document.getElementById('lives').textContent = lives;
            document.getElementById('level').textContent = level;
            document.getElementById('time').textContent = Math.round(gameTime) + ' s';
        }
        
        // 绘制道路
        function drawRoad() {
            // 道路背景
            ctx.fillStyle = '#34495e';
            ctx.fillRect(road.x, 0, road.width, canvas.height);
            
            // 道路标记
            ctx.fillStyle = '#f1c40f';
            for (let marking of road.markings) {
                ctx.fillRect(marking.x, marking.y, road.markingWidth, road.markingHeight);
            }
            
            // 道路边界
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(road.x, 0, road.width, canvas.height);
        }
        
        // 绘制玩家赛车
        function drawPlayerCar() {
            ctx.save();
            ctx.translate(playerCar.x + playerCar.width / 2, playerCar.y + playerCar.height / 2);
            ctx.rotate(playerCar.steering * 0.02);
            
            // 车身
            ctx.fillStyle = playerCar.color;
            ctx.fillRect(-playerCar.width / 2, -playerCar.height / 2, playerCar.width, playerCar.height);
            
            // 加速状态特效
            if (playerCar.isBoosted) {
                // 增强尾部火焰效果
                ctx.fillStyle = 'rgba(241, 196, 15, 0.8)';
                ctx.fillRect(-playerCar.width / 2 - 5, playerCar.height / 2, playerCar.width + 10, 20);
                // 添加额外的火焰细节
                ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
                ctx.fillRect(-playerCar.width / 2, playerCar.height / 2 + 20, playerCar.width / 2, 15);
                ctx.fillRect(0, playerCar.height / 2 + 20, playerCar.width / 2, 15);
            }
            
            // 车窗
            ctx.fillStyle = '#3498db';
            ctx.fillRect(-playerCar.width / 2 + 5, -playerCar.height / 2 + 5, playerCar.width - 10, 20);
            
            // 车轮
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-playerCar.width / 2 - 5, -playerCar.height / 2 + 10, 5, 15);
            ctx.fillRect(-playerCar.width / 2 - 5, playerCar.height / 2 - 25, 5, 15);
            ctx.fillRect(playerCar.width / 2, -playerCar.height / 2 + 10, 5, 15);
            ctx.fillRect(playerCar.width / 2, playerCar.height / 2 - 25, 5, 15);
            
            ctx.restore();
        }
        
        // 生成障碍物
        function generateObstacle(deltaTime) {
            // 计算标准化的delta时间，使游戏在不同设备上运行速度一致
            const normalizedDelta = Math.min(deltaTime, 100) / NORMALIZATION_FACTOR;
            
            // 基础生成概率为0.005（0.5%），随等级缓慢增加，但设置上限
            const baseProbability = 0.005 * normalizedDelta;
            // 每5级增加0.002的概率，最大增加到0.015（1.5%）
            const levelBonus = Math.min(0.015 * normalizedDelta, (level - 1) * 0.0004 * normalizedDelta);
            const spawnProbability = baseProbability + levelBonus;
            
            if (Math.random() < spawnProbability) {
                const lane = Math.floor(Math.random() * 3);
                // 设置基础速度，与玩家最大速度保持合理比例
                const baseSpeed = Math.min(2 + level * 0.1, 8); // 降低基础速度，限制最大速度
                obstacles.push({
                    x: road.x + lane * road.laneWidth + 15,
                    y: -60,
                    width: 40,
                    height: 60,
                    color: '#e67e22',
                    speed: baseSpeed,
                    // 相对于玩家基础速度的速度系数
                    relativeSpeed: 1.05 // 加速状态下障碍物速度调整系数
                });
            }
        }
        
        // 生成道具
        function generatePowerUp(deltaTime) {
            // 计算标准化的delta时间，使游戏在不同设备上运行速度一致
            const normalizedDelta = Math.min(deltaTime, 100) / NORMALIZATION_FACTOR;
            
            // 道具生成概率为障碍物的一半左右，保持合理比例
            const baseProbability = 0.0025 * normalizedDelta;
            // 每5级增加0.001的概率，最大增加到0.0075
            const levelBonus = Math.min(0.0075 * normalizedDelta, (level - 1) * 0.0002 * normalizedDelta);
            const spawnProbability = baseProbability + levelBonus;
            
            if (Math.random() < spawnProbability) {
                const lane = Math.floor(Math.random() * 3);
                // 道具速度略低于障碍物
                const baseSpeed = Math.min(5 + level * 0.2, 12); // 限制最大速度
                powerUps.push({
                    x: road.x + lane * road.laneWidth + 20,
                    y: -40,
                    width: 35,
                    height: 35,
                    color: '#2ecc71',
                    type: Math.random() < 0.5 ? 'speed' : 'life',
                    speed: baseSpeed,
                    // 相对于玩家基础速度的速度系数
                    relativeSpeed: 0.8 // 道具比玩家基础速度慢20%
                });
            }
        }
        
        // 绘制障碍物和道具
        function drawObstaclesAndPowerUps() {
            // 绘制障碍物
            for (let obstacle of obstacles) {
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // 绘制障碍物细节
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(obstacle.x + 5, obstacle.y + 5, obstacle.width - 10, 10);
                ctx.fillRect(obstacle.x + 5, obstacle.y + obstacle.height - 15, obstacle.width - 10, 10);
            }
            
            // 绘制道具
            for (let powerUp of powerUps) {
                ctx.fillStyle = powerUp.color;
                ctx.beginPath();
                ctx.arc(
                    powerUp.x + powerUp.width / 2,
                    powerUp.y + powerUp.height / 2,
                    powerUp.width / 2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                // 绘制道具图标
                ctx.fillStyle = '#fff';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                if (powerUp.type === 'speed') {
                    ctx.fillText('⚡', powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
                } else {
                    ctx.fillText('❤️', powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
                }
            }
        }
        
        // 更新游戏对象位置
        function updatePositions(deltaTime) {
            // 计算标准化的delta时间，使游戏在不同设备上运行速度一致
            const normalizedDelta = Math.min(deltaTime, 100) / NORMALIZATION_FACTOR;
            
            // 获取当前速度（使用playerCar.speed）
            const currentSpeed = playerCar.speed;
            
            // 更新道路标记
            for (let marking of road.markings) {
                marking.y += currentSpeed * normalizedDelta;
                if (marking.y > canvas.height + road.markingHeight) { // 确保标记完全离开画布后再重置
                    marking.y = -road.markingHeight;
                }
                // 确保标记位置正确
                marking.x = road.x + road.laneWidth * 1.5 - road.markingWidth / 2;
            }
            
            // 更新障碍物
            for (let i = obstacles.length - 1; i >= 0; i--) {
                // 障碍物速度根据玩家状态动态调整
                let obstacleSpeed;
                
                // 区分正常行驶和加速状态
                if (playerCar.isBoosted) {
                    // 加速状态下，障碍物速度基于玩家基础速度增加，但增加比例低于玩家
                    // 使用基础速度的1.5倍作为基准，加上相对比例
                    obstacleSpeed = Math.max(obstacles[i].speed, playerCar.baseSpeed * 1.5 * obstacles[i].relativeSpeed);
                } else {
                    // 正常行驶时，障碍物速度更接近玩家当前速度
                    obstacleSpeed = Math.max(obstacles[i].speed, playerCar.speed * 1.1); // 略快于玩家正常速度
                }
                
                obstacles[i].y += obstacleSpeed * normalizedDelta;
                
                // 检测碰撞
                if (checkCollision(playerCar, obstacles[i])) {
                    obstacles.splice(i, 1);
                    lives--;
                    if (lives <= 0) {
                        gameOver();
                    }
                    continue;
                }
                
                // 移除超出屏幕的障碍物
                if (obstacles[i].y > canvas.height) {
                    obstacles.splice(i, 1);
                    score += 10;
                }
            }
            
            // 更新道具
            for (let i = powerUps.length - 1; i >= 0; i--) {
                // 道具速度与玩家实际速度（包括加速状态）相关联
                const powerUpSpeed = Math.max(powerUps[i].speed, playerCar.speed * powerUps[i].relativeSpeed);
                powerUps[i].y += powerUpSpeed * normalizedDelta;
                
                // 检测收集
                if (checkCollision(playerCar, powerUps[i])) {
                    if (powerUps[i].type === 'speed') {
                        // 激活临时加速
                        playerCar.isBoosted = true;
                        playerCar.boostTime = Date.now();
                        playerCar.color = '#f1c40f'; // 加速时改变颜色
                        score += 50;
                    } else {
                        lives++;
                        score += 30;
                    }
                    powerUps.splice(i, 1);
                    continue;
                }
                
                // 移除超出屏幕的道具
                if (powerUps[i].y > canvas.height) {
                    powerUps.splice(i, 1);
                }
            }
            
            // 检查加速状态
            if (playerCar.isBoosted) {
                const boostElapsed = Date.now() - playerCar.boostTime;
                if (boostElapsed > playerCar.boostDuration) {
                    playerCar.isBoosted = false;
                    playerCar.color = '#e74c3c'; // 恢复原颜色
                }
            }
            
            // 更新玩家位置
            if (keys.ArrowUp) {
                // 加速状态下提供更强的加速度
                const currentAcceleration = playerCar.isBoosted ? playerCar.acceleration * 2 : playerCar.acceleration;
                playerCar.baseSpeed = Math.min(playerCar.baseSpeed + currentAcceleration * normalizedDelta, playerCar.maxSpeed);
            } else if (keys.ArrowDown) {
                playerCar.baseSpeed = Math.max(playerCar.baseSpeed - playerCar.deceleration * 2 * normalizedDelta, 0);
            } else {
                // 加速状态下减速更慢
                const currentDeceleration = playerCar.isBoosted ? playerCar.deceleration * 0.5 : playerCar.deceleration;
                playerCar.baseSpeed = Math.max(playerCar.baseSpeed - currentDeceleration * normalizedDelta, 0);
            }
            
            // 计算最终速度，包括临时加速
            playerCar.speed = playerCar.isBoosted ? playerCar.baseSpeed * 2.5 : playerCar.baseSpeed;
            
            if (keys.ArrowLeft) {
                playerCar.steering = Math.max(playerCar.steering - 0.5 * normalizedDelta, -playerCar.maxSteering);
            } else if (keys.ArrowRight) {
                playerCar.steering = Math.min(playerCar.steering + 0.5 * normalizedDelta, playerCar.maxSteering);
            } else {
                playerCar.steering *= 0.9;
            }
            
            playerCar.x += playerCar.steering * normalizedDelta;
            
            // 限制玩家在道路内
            const minX = road.x + 15; // 增加边距以适应更宽的道路
            const maxX = road.x + road.width - playerCar.width - 15;
            playerCar.x = Math.max(minX, Math.min(maxX, playerCar.x));
            
            // 更新游戏数据，使用playerCar.speed而不是speed
            distance += currentSpeed * normalizedDelta * 2;
            score += currentSpeed * normalizedDelta;
            
            // 确保等级增长不会过快
            level = Math.floor(distance / 2000) + 1; // 每2000米升一级，而不是1000米
        }
        
        // 碰撞检测
        function checkCollision(obj1, obj2) {
            return obj1.x < obj2.x + obj2.width &&
                   obj1.x + obj1.width > obj2.x &&
                   obj1.y < obj2.y + obj2.height &&
                   obj1.y + obj1.height > obj2.y;
        }
        
        // 游戏循环
        function gameLoop(timestamp) {
            if (!gameRunning || gamePaused) {
                return;
            }
            
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;
            gameTime += deltaTime / 1000;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            drawRoad();
            drawObstaclesAndPowerUps();
            drawPlayerCar();
            
            generateObstacle(deltaTime);
            generatePowerUp(deltaTime);
            updatePositions(deltaTime);
            updateUI();
            
            animationId = requestAnimationFrame(gameLoop);
        }
        
        // 开始游戏
        function startGame() {
            if (!gameRunning) {
                initGame();
                gameRunning = true;
                gamePaused = false;
                lastTime = performance.now();
                animationId = requestAnimationFrame(gameLoop);
                document.getElementById('start-btn').textContent = '重开';
            } else {
                initGame();
            }
        }
        
        // 暂停游戏
        function togglePause() {
            if (!gameRunning) return;
            
            gamePaused = !gamePaused;
            document.getElementById('pause-btn').textContent = gamePaused ? '继续' : '暂停';
            
            if (!gamePaused) {
                lastTime = performance.now();
                animationId = requestAnimationFrame(gameLoop);
            }
        }
        
        // 游戏结束
        function gameOver() {
            gameRunning = false;
            cancelAnimationFrame(animationId);
            
            document.getElementById('final-score').textContent = Math.round(score);
            document.getElementById('game-over').style.display = 'block';
        }
        
        // 提交分数
        function submitScore() {
            const playerName = document.getElementById('player-name').value || '匿名玩家';
            const messageEl = document.getElementById('message');
            
            // 显示加载消息
            messageEl.textContent = '提交中...';
            messageEl.className = 'message';
            messageEl.style.display = 'block';
            
            // 创建FormData对象
            const formData = new FormData();
            formData.append('action', 'submit_score');
            formData.append('player_name', playerName);
            formData.append('score', Math.round(score));
            formData.append('distance', Math.round(distance));
            formData.append('level', level);
            formData.append('game_time', Math.round(gameTime));
            
            // 发送AJAX请求
            fetch('', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    messageEl.textContent = data.message;
                    messageEl.className = 'message success';
                    
                    // 3秒后隐藏游戏结束界面并重新加载页面以更新排行榜
                    setTimeout(() => {
                        document.getElementById('game-over').style.display = 'none';
                        location.reload();
                    }, 3000);
                } else {
                    messageEl.textContent = data.message;
                    messageEl.className = 'message error';
                }
            })
            .catch(error => {
                messageEl.textContent = '提交失败: ' + error;
                messageEl.className = 'message error';
            });
        }
        
        // 事件监听
        document.addEventListener('keydown', (e) => {
            if (keys.hasOwnProperty(e.key)) {
                keys[e.key] = true;
                e.preventDefault();
            }
            
            if (e.key === 'p' || e.key === 'P') {
                togglePause();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (keys.hasOwnProperty(e.key)) {
                keys[e.key] = false;
                e.preventDefault();
            }
        });
        
        document.getElementById('start-btn').addEventListener('click', startGame);
        document.getElementById('pause-btn').addEventListener('click', togglePause);
        document.getElementById('restart-btn').addEventListener('click', () => {
            document.getElementById('game-over').style.display = 'none';
            startGame();
        });
        document.getElementById('submit-score').addEventListener('click', submitScore);
        
        // 初始绘制
        drawRoad();
        drawPlayerCar();
    </script>
</body>
</html>
