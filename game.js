// game.js
// 전역 요소
const songSelect = document.getElementById('songSelect');
const difficultySelect = document.getElementById('difficulty');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const noteContainer = document.getElementById('noteContainer');
const countdownEl = document.getElementById('countdown');
const hitLine = document.getElementById('hitLine');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const lastJudgementEl = document.getElementById('lastJudgement');
const messageEl = document.getElementById('message');

let currentSongKey = null;
let currentSong = null;
let audio = null;
let currentNotes = [];
let noteIndex = 0;
let running = false;
let score = 0;
let combo = 0;
let lastJudgement = '-';

// 판정값(초 단위)
const PERFECT = 0.12;
const GOOD = 0.25;

// 노트 스폰 앞당김(sec)
const PRELOAD = 2.0;

// 픽셀 계산 (음악 시간 → 화면 y)
const HIT_Y = 500 + 20; // style hitLine bottom:120px + border(approx)
const SPAWN_Y = -40; // 화면 위
const TRAVEL_TIME = 2.0; // 스폰에서 히트라인까지 걸리는 시간(초)
const PIXELS_PER_SEC = (HIT_Y - SPAWN_Y) / TRAVEL_TIME; // 약 80..260

// 키맵
const KEY_MAP = { 'd':0,'f':1,'j':2,'k':3 };

// 초기: songSelect에 SONGS 추가
function initSongList(){
  Object.keys(SONGS).forEach(key=>{
    const s = SONGS[key];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = s.title;
    songSelect.appendChild(opt);
  });
  // 기본값
  currentSongKey = songSelect.value;
  currentSong = SONGS[currentSongKey];
}
initSongList();

songSelect.addEventListener('change', ()=>{
  currentSongKey = songSelect.value;
  currentSong = SONGS[currentSongKey];
});

// 시작 버튼 이벤트 (3초 카운트 후 재생)
startBtn.addEventListener('click', async ()=>{
  if(!currentSong) return alert('곡을 선택해 주세요.');
  // audio 준비
  if(audio){
    audio.pause(); audio=null;
  }
  audio = new Audio(currentSong.audio);
  audio.preload = 'auto';
  try{
    await audio.load();
  }catch(e){
    // 일부 브라우저에서 load() 에러 발생 가능, 무시
  }

  // 난이도 선택
  const diff = difficultySelect.value;
  currentNotes = currentSong[diff] || [];
  noteIndex = 0;
  score = 0; combo = 0; lastJudgement = '-';
  updateHUD();
  noteContainer.innerHTML = '';
  messageEl.textContent = '';

  // 3초 카운트다운
  countdownEl.style.display = 'block';
  await countdown(3);

  // 재생 & 루프 시작
  running = true;
  try{ audio.play(); }catch(e){ /* autoplay 정책에 걸릴 수 있음 */ }
  requestAnimationFrame(update);
});

// 정지 버튼
stopBtn.addEventListener('click', ()=>{
  stopGame();
});

function stopGame(){
  running = false;
  if(audio){ audio.pause(); audio.currentTime = 0; }
  noteContainer.innerHTML = '';
  countdownEl.style.display = 'none';
}

// 카운트다운(초) - Promise로 대기
function countdown(sec){
  return new Promise(resolve=>{
    let t = sec;
    countdownEl.textContent = t;
    const iv = setInterval(()=>{
      t--;
      if(t<=0){
        clearInterval(iv);
        countdownEl.style.display = 'none';
        resolve();
      } else {
        countdownEl.textContent = t;
      }
    },1000);
  });
}

// 노트 생성: note = {time:sec, lane:0..3}
function spawnNoteDOM(note){
  const el = document.createElement('div');
  el.className = 'note';
  el.dataset.time = String(note.time);
  el.dataset.lane = String(note.lane);
  // lane 위치: 0..3 -> left percent (10%~90% 범위)
  const laneLeft = 25 * note.lane; // left percent
  el.style.left = `calc(${laneLeft}% + 2%)`; // 약간 내측
  el.style.top = `${SPAWN_Y}px`;
  noteContainer.appendChild(el);
}

// 프레임 업데이트
function update(ts){
  if(!running) return;
  if(!audio) return;
  const currentTime = audio.currentTime; // 초 단위
  // 1) 스폰: 미리 PRELOAD 초 범위 안의 노트들을 스폰
  while(noteIndex < currentNotes.length && currentNotes[noteIndex].time <= currentTime + PRELOAD){
    spawnNoteDOM(currentNotes[noteIndex]);
    noteIndex++;
  }

  // 2) 위치 갱신 & 자동 MISS 처리
  const nodes = Array.from(noteContainer.getElementsByClassName('note'));
  nodes.forEach(node=>{
    const noteTime = parseFloat(node.dataset.time);
    const timeToHit = noteTime - currentTime; // positive => 아직 위, negative => 이미 지남
    const y = HIT_Y - timeToHit * PIXELS_PER_SEC;
    node.style.top = `${y}px`;

    // 자동 MISS: 노트가 히트라인 아래로 지나가고 판정 안된 경우
    if(timeToHit < -GOOD){ // 히트라인에서 이미 많이 지났으면 MISS 처리
      // remove and mark miss
      node.remove();
      combo = 0;
      lastJudgement = 'MISS';
      score = Math.max(0, score - 50);
      showHitText('MISS','#ff4444');
      updateHUD();
    }
  });

  // 3) 종료 체크: 오디오 종료 또는 currentTime > duration
  if(audio.ended || currentTime >= (currentSong.duration || audio.duration || 9999)){
    // 곡 끝 처리
    running = false;
    setTimeout(()=>{ // 잠깐 대기 후 종료 UI
      endGame();
    }, 200);
    return;
  }

  // 계속 루프
  requestAnimationFrame(update);
}

// 키 입력 처리: DFJK
document.addEventListener('keydown', (e)=>{
  if(!running) return;
  const key = e.key.toLowerCase();
  if(!(key in KEY_MAP)) return;
  const lane = KEY_MAP[key];
  const now = audio.currentTime;
  // 같은 lane의 노트들 중 가장 시간차가 작은 노트 찾기
  const candidates = Array.from(noteContainer.getElementsByClassName('note'))
    .filter(n => Number(n.dataset.lane) === lane);
  if(candidates.length === 0) return;
  let best = null; let bestDiff = Infinity;
  candidates.forEach(n=>{
    const t = Number(n.dataset.time);
    const diff = Math.abs(t - now);
    if(diff < bestDiff){ bestDiff = diff; best = n; }
  });

  // 판정: PERFECT / GOOD / (아무 반응) — MISS는 자동처리로만 발생
  if(best && bestDiff <= GOOD){
    if(bestDiff <= PERFECT){
      // PERFECT
      score += 300;
      combo += 1;
      lastJudgement = 'PERFECT';
      showHitText('PERFECT!','#00ffff');
    } else {
      // GOOD
      score += 100;
      combo += 1;
      lastJudgement = 'GOOD';
      showHitText('GOOD','#88ff00');
    }
    best.remove();
    updateHUD();
  } else {
    // 판정범위 밖이면 "아무 반응" — 점수/콤보 변동 없음
    // (원하면 여기에 작은 피드백 넣을 수 있습니다)
  }
});

// HUD 갱신
function updateHUD(){
  scoreEl.textContent = String(score);
  comboEl.textContent = String(combo);
  lastJudgementEl.textContent = lastJudgement;
}

// 히트 텍스트 표시
function showHitText(text, color){
  const el = document.createElement('div');
  el.className = 'hit-text';
  el.style.color = color;
  el.textContent = text;
  document.querySelector('#game-area').appendChild(el);
  setTimeout(()=>el.remove(), 500);
}

// 종료 처리
function endGame(){
  // 정리
  running = false;
  if(audio){ audio.pause(); }
  noteContainer.innerHTML = '';
  // 메시지: "수고하셨습니다(\n)당신의 점수는 ~~입니다"
  messageEl.textContent = `수고하셨습니다\n당신의 점수는 ${score} 입니다`;
  // HUD에도 마지막 상태 반영
  updateHUD();
}
