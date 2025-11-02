// songs.js
const SONGS = {
  song_end_of_the_world: {
    id: "song_end_of_the_world",
    title: "그 피의 기억 ~End of the World~",
    bpm: 140,
    duration: 264.0,
    audio: "assets/end_of_the_world.mp3",
    // 샘플 자동생성: 전체 264초 기준으로 난이도별 채보 생성(근사)
    easy: (function(){
      const beat = 60/110;
      const total = 264;
      const notes = [];
      let lane = 0;
      for(let t=1.0; t<total; t += beat*1.5){
        notes.push({time: Number(t.toFixed(3)), lane: lane});
        lane = (lane+1)%4;
      }
      return notes;
    })(),
    normal: (function(){
      const beat = 60/110;
      const total = 264;
      const notes = [];
      const pattern = [0,1,2,3,2,1,0,3];
      for(let t=0; t<total; t += beat){
        const i = Math.floor((t/beat) % pattern.length);
        notes.push({time: Number(t.toFixed(3)), lane: pattern[i]});
        if(i%4===0) notes.push({time: Number((t+beat/2).toFixed(3)), lane: (pattern[i]+1)%4});
      }
      return notes.sort((a,b)=>a.time-b.time);
    })(),
    hard: (function(){
      const beat = 60/110;
      const total = 264;
      const notes = [];
      for(let t=0; t<total; t += beat/2){
        const lane = Math.floor((t*2) % 4);
        notes.push({time: Number(t.toFixed(3)), lane});
        if(Math.floor(t*4) % 6 === 0){
          notes.push({time: Number((t+beat/4).toFixed(3)), lane: (lane+2)%4});
        }
      }
      return notes.sort((a,b)=>a.time-b.time);
    })()
  },

  // 예시로 사용자 추가할 수 있는 템플릿
  song_sample: {
    id: "song_sample",
    title: "Sample Song (예시)",
    bpm: 120,
    duration: 60,
    audio: "assets/sample.mp3",
    easy: [{time:1.0,lane:0},{time:2.0,lane:1}],
    normal: [{time:1.0,lane:0},{time:1.5,lane:2},{time:2.0,lane:1}],
    hard: [{time:0.5,lane:3},{time:1.0,lane:0},{time:1.25,lane:1},{time:1.5,lane:2}]
  }
};
