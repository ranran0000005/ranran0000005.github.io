<?php
// 简单的五子棋前端页面，使用 Ajax 调用 api.php
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>在线五子棋</title>
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 20px;
        }
        .container {
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,.08);
        }
        h1 {
            margin-top: 0;
            font-size: 22px;
            text-align: center;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        input[type="text"] {
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid #ccc;
            font-size: 14px;
        }
        button {
            padding: 6px 12px;
            border-radius: 4px;
            border: none;
            background: #007bff;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        }
        button.secondary {
            background: #6c757d;
        }
        button:disabled {
            opacity: .6;
            cursor: not-allowed;
        }
        .status {
            margin: 8px 0;
            font-size: 14px;
        }
        #board {
            border-collapse: collapse;
            margin-top: 10px;
        }
        #board td {
            width: 26px;
            height: 26px;
            border: 1px solid #ccc;
            text-align: center;
            vertical-align: middle;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        }
        #board td.empty:hover {
            background: #f1f1f1;
        }
        .stone-black {
            color: #000;
        }
        .stone-white {
            color: #d9534f;
        }
        .small {
            font-size: 12px;
            color: #666;
        }
        .game-info {
            margin-top: 5px;
            font-size: 13px;
        }
    </style>
</head>
<body>
<div class="container">
    <h1>在线五子棋</h1>

    <div class="controls">
        <button id="btnCreate">创建房间</button>
        <input type="text" id="roomCodeInput" placeholder="输入房间号加入">
        <button id="btnJoin" class="secondary">加入房间</button>
    </div>

    <div class="status" id="statusText">请先创建或加入房间。</div>
    <div class="game-info" id="gameInfo"></div>

    <table id="board"></table>

    <div class="small">
        打开两个浏览器窗口：一个“创建房间”，另一个输入房间号“加入房间”，即可两人对战。<br>
        <!-- 如果表结构还没建好，可访问 `gomoku/api.php?action=init_db` 一次来初始化。 -->
    </div>
</div>

<script>
const apiUrl = 'api.php';

let roomCode = null;
let myRole = null; // 'B' / 'W' / 'spectator'
let myToken = null;
let currentTurn = null;
let status = null;
let winner = null;
let pollTimer = null;

function $(id) {
    return document.getElementById(id);
}

function renderBoard(boardStr) {
    const boardEl = $('board');
    boardEl.innerHTML = '';
    if (!boardStr || boardStr.length !== 225) {
        return;
    }
    for (let r = 0; r < 15; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < 15; c++) {
            const td = document.createElement('td');
            const ch = boardStr[r * 15 + c];
            if (ch === '.') {
                td.classList.add('empty');
                td.textContent = '';
            } else if (ch === 'B') {
                td.textContent = '●';
                td.classList.add('stone-black');
            } else if (ch === 'W') {
                td.textContent = '○';
                td.classList.add('stone-white');
            }
            td.dataset.row = r;
            td.dataset.col = c;
            td.addEventListener('click', onCellClick);
            tr.appendChild(td);
        }
        boardEl.appendChild(tr);
    }
}

function setStatus(text) {
    $('statusText').textContent = text;
}

function updateGameInfo() {
    if (!roomCode) {
        $('gameInfo').textContent = '';
        return;
    }
    let roleText = myRole === 'B' ? '你是：黑棋 (●)' :
                   myRole === 'W' ? '你是：白棋 (○)' :
                   myRole === 'spectator' ? '你是：观战者' : '';
    let turnText = currentTurn === 'B' ? '轮到黑棋' :
                   currentTurn === 'W' ? '轮到白棋' : '';
    let statusText = status === 'waiting' ? '等待另一位玩家加入…' :
                     status === 'playing' ? '对局进行中' :
                     status === 'finished' ? '对局已结束' : '';
    let winnerText = '';
    if (status === 'finished') {
        if (winner === 'B') winnerText = '结果：黑棋获胜';
        else if (winner === 'W') winnerText = '结果：白棋获胜';
        else if (winner === 'draw') winnerText = '结果：平局';
    }
    $('gameInfo').textContent =
        `房间号：${roomCode} ｜ ${roleText} ｜ ${turnText} ｜ ${statusText}${winnerText ? ' ｜ ' + winnerText : ''}`;
}

async function apiPost(action, data = {}) {
    const body = new URLSearchParams({action, ...data});
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body
    });
    return res.json();
}

async function apiGet(action, params = {}) {
    const usp = new URLSearchParams({action, ...params});
    const res = await fetch(apiUrl + '?' + usp.toString());
    return res.json();
}

async function createRoom() {
    try {
        setStatus('创建房间中...');
        const res = await apiPost('create_game');
        if (!res.ok) {
            // 如果房间已达到上限，询问是否清理旧房间
            if (res.code === 'ROOMS_LIMIT') {
                const confirmClean = window.confirm(
                    '当前五子棋房间数量已超过 10 个。\n是否删除所有旧房间后再创建新房间？'
                );
                if (confirmClean) {
                    setStatus('正在删除旧房间...');
                    const cleanRes = await apiPost('cleanup_games');
                    if (!cleanRes.ok) {
                        setStatus('删除旧房间失败：' + (cleanRes.error || '未知错误'));
                        return;
                    }
                    setStatus('旧房间已删除，正在重新创建房间...');
                    // 再次尝试创建
                    const retryRes = await apiPost('create_game');
                    if (!retryRes.ok) {
                        setStatus('创建失败：' + (retryRes.error || '未知错误'));
                        return;
                    }
                    handleCreateSuccess(retryRes);
                    return;
                } else {
                    setStatus('已取消创建新房间。');
                    return;
                }
            } else {
                setStatus('创建失败：' + (res.error || '未知错误'));
                return;
            }
        }
        handleCreateSuccess(res);
    } catch (e) {
        console.error(e);
        setStatus('请求失败：' + e);
    }
}

function handleCreateSuccess(res) {
    roomCode = res.code;
    myRole = res.role;
    myToken = res.token;
    currentTurn = 'B';
    status = 'waiting';
    setStatus('房间创建成功，等待对方加入。房间号：' + roomCode);
    updateGameInfo();
    startPolling();
}

async function joinRoom() {
    const code = $('roomCodeInput').value.trim().toUpperCase();
    if (!code) {
        alert('请输入房间号');
        return;
    }
    try {
        setStatus('加入房间中...');
        const res = await apiPost('join_game', {code});
        if (!res.ok) {
            setStatus('加入失败：' + (res.error || '未知错误'));
            return;
        }
        roomCode = res.code;
        myRole = res.role;
        myToken = res.token || null;
        status = res.status;
        setStatus('加入成功。');
        updateGameInfo();
        startPolling();
    } catch (e) {
        console.error(e);
        setStatus('请求失败：' + e);
    }
}

async function fetchState() {
    if (!roomCode) return;
    try {
        const res = await apiGet('get_state', {code: roomCode});
        if (!res.ok) {
            setStatus('同步失败：' + (res.error || '未知错误'));
            return;
        }
        renderBoard(res.board);
        currentTurn = res.current_turn;
        status = res.status;
        winner = res.winner;
        if (status === 'finished') {
            if (winner === 'B') {
                setStatus('游戏结束：黑棋获胜');
            } else if (winner === 'W') {
                setStatus('游戏结束：白棋获胜');
            } else {
                setStatus('游戏结束：平局');
            }
        } else {
            setStatus('同步成功');
        }
        updateGameInfo();
    } catch (e) {
        console.error(e);
        setStatus('同步出错：' + e);
    }
}

async function onCellClick(e) {
    if (!roomCode || !myRole || myRole === 'spectator') return;
    if (status !== 'playing' && status !== 'waiting') return; // waiting 只有一人时，允许先手下第一步

    const row = parseInt(this.dataset.row, 10);
    const col = parseInt(this.dataset.col, 10);

    if (!this.classList.contains('empty')) {
        return;
    }

    // 是否轮到我
    if (currentTurn && ((currentTurn === 'B' && myRole !== 'B') || (currentTurn === 'W' && myRole !== 'W'))) {
        return;
    }

    try {
        setStatus('落子中...');
        const res = await apiPost('make_move', {
            code: roomCode,
            token: myToken,
            row,
            col
        });
        if (!res.ok) {
            setStatus('落子失败：' + (res.error || '未知错误'));
            return;
        }
        renderBoard(res.board);
        currentTurn = res.current_turn;
        status = res.status;
        winner = res.winner;
        if (status === 'finished') {
            if (winner === 'B') {
                setStatus('游戏结束：黑棋获胜');
            } else if (winner === 'W') {
                setStatus('游戏结束：白棋获胜');
            } else {
                setStatus('游戏结束：平局');
            }
        } else {
            setStatus('落子成功');
        }
        updateGameInfo();
    } catch (e) {
        console.error(e);
        setStatus('请求失败：' + e);
    }
}

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchState, 1000);
}

// 初始化空棋盘
renderBoard('.'.repeat(225));

$('btnCreate').addEventListener('click', createRoom);
$('btnJoin').addEventListener('click', joinRoom);
</script>
</body>
</html>


