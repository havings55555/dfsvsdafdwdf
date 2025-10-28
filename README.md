<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>간단한 HTML 리듬게임</title>
  <style>
    :root{--bg:#0b1020;--lane:#111827;--note:#22c55e;--hit:#60a5fa;--text:#e6eef8}
    html,body{height:100%;margin:0;font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial}
    body{background:linear-gradient(180deg,#071024 0%, #071832 60%);color:var(--text);display:flex;align-items:center;justify-content:center}
    .wrap{width:900px;max-width:95%;padding:18px}
    header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    h1{font-size:18px;margin:0}
    .controls{display:flex;gap:8px;align-items:center}
    button{background:#0f1724;border:1px solid rgba(255,255,255,0.06);color:var(--text);padding:8px 12px;border-radius:8px;cursor:pointer}
    #game{background:var(--bg);border-radius:12px;padding:12px;box-shadow:0 10px 30px rgba(2,6,23,0.7)}
    canvas{display:block;background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);border-radius:8px}
    .info{display:flex;gap:12px;margin-top:8px;align-items:center}
    .stat{background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:8px;font-size:14px}
    .legend{font-size:13px;color:#bcd3ff;opacity:0.9}
    footer{margin-top:10px;color:#9fb0d6;font-size:13px}
    /* 반응형 간단 처리 */
    @media (max-width:560px){.info{flex-direction:column;align-items:flex-start}}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>간단한 HTML 리듬게임</h1>
      <div class="controls">
        <button id="start">시작</button>
        <button id="restart">다시하기</button>
        <div class="legend">키: D F J K (왼쪽→오른쪽)</div>
      </div>
    </header>

    <div id="game">
      <canvas id="canvas" width="860" height="480"></canvas>
      <div class="info">
        <div class="stat">점수: <span id="score">0</span></div>
        <div class="stat">콤보: <span id="combo">0</span></div>
        <div class="stat">판정: <span id="judgement">-</span></div>
        <div class="stat">남은 노트: <span id="remaining">0</span></div>
      </div>
      <footer>음원은 내장 사운드로 대체되었습니다. (브라우저가 WebAudio를 지원해야 합니다.)</footer>
    </div>
  </div>

<script>
/*
  간단한 리듬게임 구현
  - 키: D F J K -> 레인 0..3
  - 노트는 시간(ms) 기준 chart 배열로 정의
  - 판정 윈도우: perfect 80ms, good 150ms
  - 오디오: WebAudio로 간단한 피드백 사운드 제공
*/

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const restartBtn = document.getElementById('restart');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const judgEl = document.getElementById('judgement');
const remainingEl = document.getElementById('remaining');

const W = canvas.width, H = canvas.height;
const laneCount = 4;
const laneWidth = Math.floor((W - 40) / laneCount);
const laneX = Array.from({length:laneCount}, (_,i)=>20 + i*laneWidth);
const receptorY = H - 120;
const noteSpeed = 0.4; // pixels per ms (초당 px = noteSpeed*1000)

// 판정 윈도우 (ms)
const PERFECT = 80;
const GOOD = 150;

// 키 매핑
const keyToLane = {
  'd':0,'D':0,
  'f':1,'F':1,
  'j':2,'J':2,
  'k':3,'K':3
};

let audioCtx = null;
function ensureAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playBeep(type='hit'){
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type==='hit' ? 'sine' : 'square';
  o.frequency.value = type==='hit' ? 880 : 120;
  g.gain.value = 0.0001;
  o.connect(g); g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.linearRampToValueAtTime(0.12, now+0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, now+0.15);
  o.start(now); o.stop(now+0.16);
}

// 샘플 차트: 시간(ms) 기준, 0은 시작 버튼 누른 시점
// 실사용: 이 배열을 편집하거나 외부 파일로 불러오면 됩니다.
const chart = [
  // lane 0..3
  {t:500, lane:0},{t:900,lane:1},{t:1300,lane:2},{t:1700,lane:3},
  {t:2100,lane:0},{t:2450,lane:1},{t:2800,lane:2},{t:3150,lane:3},
  {t:3600,lane:1},{t:3900,lane:2},{t:4200,lane:1},{t:4500,lane:2},
  {t:5200,lane:0},{t:5200,lane:3},{t:5800,lane:1},{t:6200,lane:2},
  {t:7000,lane:0},{t:7400,lane:1},{t:7800,lane:2},{t:8200,lane:3},
  {t:9000,lane:2},{t:9400,lane:1},{t:9800,lane:0},{t:10400,lane:3},
];

// 게임 상태
let startTime = null; // performance.now() at start
let paused = true;
let activeNotes = []; // 복사된 노트 객체들
let score = 0;
let combo = 0;
let judgement = '-';
let idxNext = 0; // 다음 생성할 노트 인덱스

function resetGame(){
  startTime = null;
  paused = true;
  activeNotes = [];
  score = 0; combo = 0; judgement = '-'; idxNext = 0;
  scoreEl.textContent = score; comboEl.textContent = combo; judgEl.textContent = judgement;
  remainingEl.textContent = chart.length;
}

function startGame(){
  resetGame();
  // 브라우저 사운드 정책 대응
  ensureAudio();
  startTime = performance.now();
  paused = false;
}

startBtn.addEventListener('click', ()=>{
  startGame();
});
restartBtn.addEventListener('click', ()=>{
  startGame();
});

// 노트 객체 구조: {t, lane, y, hit:false, judged:false}
function spawnNotes(now){
  // chart 기준 t is ms after start; spawn when note should appear above canvas
  while(idxNext < chart.length){
    const note = chart[idxNext];
    // 노트가 화면 위에서 보이기 시작할 시점을 미리 계산: receptorY - noteY = distance
    // 현재는 spawn instantly: we keep notes in chart and compute y from time
    // 그냥 복사해서 activeNotes에 넣고 idxNext++
    activeNotes.push({t:note.t, lane:note.lane, hit:false, judged:false});
    idxNext++;
  }
}

function timeSinceStart(now){
  return now - startTime;
}

function draw(){
  ctx.clearRect(0,0,W,H);
  // 배경 레인
  for(let i=0;i<laneCount;i++){
    const x = laneX[i];
    ctx.fillStyle = '#071126';
    ctx.fillRect(x,20,laneWidth-6,H-140);
    // 레인 구분선/키 라벨
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(x,20,laneWidth-6,6);
    ctx.fillStyle = '#bcd3ff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(['D','F','J','K'][i], x + (laneWidth-6)/2, H-90+24);
  }
  // receptor 표시
  for(let i=0;i<laneCount;i++){
    const x = laneX[i];
    ctx.fillStyle = 'rgba(96,165,250,0.12)';
    ctx.fillRect(x, receptorY, laneWidth-6, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeRect(x, receptorY, laneWidth-6, 12);
  }

  // 노트 그리기: y 위치는 note.t - time => 떨어진 거리
  const now = performance.now();
  if(startTime !== null){
    const t = timeSinceStart(now);
    // compute y for each active note based on time until hit (delta = note.t - t)
    activeNotes.forEach(n=>{
      const dt = n.t - t; // ms until perfect hit (negative => passed)
      // when dt==0 -> receptorY
      const y = receptorY - dt * noteSpeed; // linear
      n._y = y; // debug
    });
  }

  // draw notes sorted by y
  activeNotes.slice().sort((a,b)=>a._y-b._y).forEach(n=>{
    if(n.judged) return; // 이미 판정된 노트는 표시하지 않음
    const x = laneX[n.lane];
    const width = laneWidth-12;
    const height = 18;
    ctx.fillStyle = n.hit ? 'rgba(34,197,94,0.6)' : (n._y > receptorY+20 ? 'rgba(255,255,255,0.02)' : 'rgba(34,197,94,1)');
    ctx.fillRect(x+6, n._y - height/2, width, height);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x+6, n._y - height/2 + height - 3, width, 3);
  });

  // HUD (작게)
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(10,10,W-20,6);

}

// 판정 처리: 키 입력 시
function handleKey(lane){
  if(paused || startTime===null) return;
  const now = performance.now();
  const t = timeSinceStart(now);
  // 같은 레인에서 판정되지 않은 노트 중 가장 시간차가 작은 것 선택
  let candidates = activeNotes.filter(n=>!n.judged && n.lane===lane);
  if(candidates.length===0){
    // 노트가 없음 -> 가짜 노트(페널티 없음)
    judgement = 'Miss';
    judgEl.textContent = judgement;
    combo = 0; comboEl.textContent = combo;
    playBeep('miss');
    return;
  }
  let nearest = null; let bestAbs = Infinity;
  candidates.forEach(n=>{
    const absdt = Math.abs(n.t - t);
    if(absdt < bestAbs){ bestAbs = absdt; nearest = n; }
  });
  if(nearest){
    if(bestAbs <= PERFECT){
      // perfect
      nearest.judged = true; nearest.hit = true;
      score += 1000 + Math.floor(combo*5);
      combo += 1;
      judgement = 'Perfect';
      playBeep('hit');
    } else if(bestAbs <= GOOD){
      nearest.judged = true; nearest.hit = true;
      score += 500 + Math.floor(combo*2);
      combo += 1;
      judgement = 'Good';
      playBeep('hit');
    } else {
      // 시간 초과: Miss
      nearest.judged = true;
      combo = 0;
      judgement = 'Miss';
      playBeep('miss');
    }
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    judgEl.textContent = judgement;
    updateRemaining();
  }
}

// 자동 Miss 처리: 노트가 receptor를 많이 지나치면 Miss로 처리
function sweepMisses(){
  if(startTime===null) return;
  const now = performance.now();
  const t = timeSinceStart(now);
  activeNotes.forEach(n=>{
    if(n.judged) return;
    if(t - n.t > GOOD){ // note missed by more than GOOD window
      n.judged = true;
      n.hit = false;
      judgement = 'Miss';
      combo = 0;
      scoreEl.textContent = score; comboEl.textContent = combo; judgEl.textContent = judgement;
      updateRemaining();
    }
  });
}

function updateRemaining(){
  const rem = activeNotes.filter(n=>!n.judged).length;
  remainingEl.textContent = rem;
}

// 키 이벤트
window.addEventListener('keydown', (e)=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  const key = e.key;
  if(keyToLane.hasOwnProperty(key)){
    handleKey(keyToLane[key]);
  }
});

// 게임 루프
function loop(){
  if(!paused){
    // spawn (모든 노트를 activeNotes에 넣는 방식으로 간단화)
    if(startTime !== null && idxNext < chart.length){
      // spawnNotes 현재는 모든 노트를 한 번에 activeNotes에 넣음
      spawnNotes();
    }

    sweepMisses();
  }
  draw();
  requestAnimationFrame(loop);
}

// 초기화
resetGame();
loop();

</script>
</body>
</html>
