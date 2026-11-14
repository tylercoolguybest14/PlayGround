(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const slots = [
    { x: 379, base: 493 }, { x: 480, base: 493 }, { x: 581, base: 493 },
    { x: 429, base: 407 }, { x: 531, base: 407 }, { x: 480, base: 321 }
  ];
  const palette = [
    { body: '#f16e58', label: '#fff3d4', name: 'FIZZ' },
    { body: '#43b9bd', label: '#f8f2d9', name: 'POP!' },
    { body: '#e9b847', label: '#fff7df', name: 'ZING' },
    { body: '#7889c4', label: '#fff3d4', name: 'BUBBLES' }
  ];
  let game = { mode: 'intro', placed: [], spills: 0, round: 0, startedAt: 0, lastSplash: 0, particles: [], pointer: null, holding: false, bonusCash: 0, bonusTickets: 0 };
  let wallet = { cash: 0, tickets: 0, plush: 0 };
  try { wallet = { ...wallet, ...JSON.parse(localStorage.getItem('highTideWallet') || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem('highTideWallet', JSON.stringify(wallet)); } catch {} };

  function updateWallet() {
    $('cashCount').textContent = '$' + wallet.cash;
    $('ticketCount').textContent = wallet.tickets;
    $('shopTicketCount').textContent = wallet.tickets;
  }
  function updateStats() {
    $('progressText').innerHTML = `${game.placed.length} <i>/ 6</i>`;
    $('progressFill').style.width = `${game.placed.length / 6 * 100}%`;
    $('spillCount').textContent = game.spills;
  }
  updateWallet(); updateStats();

  function makeItem(index) {
    const seed = Math.sin((game.round + 2) * 89 + index * 17) * 10000;
    const rand = seed - Math.floor(seed);
    return { type: rand > .47 ? 'bottle' : 'can', color: palette[Math.floor(rand * 100) % palette.length], fill: .42 + ((rand * 7.13) % .48), id: index };
  }
  function beginRound() {
    game = { ...game, mode: 'playing', placed: [], spills: 0, round: game.round + 1, startedAt: performance.now(), lastSplash: 0, particles: [], pointer: null, holding: false, bonusCash: 0, bonusTickets: 0 };
    $('gameOverlay').classList.add('hidden');
    $('steadyButton').classList.remove('active');
    $('steadyButton').setAttribute('aria-pressed', 'false');
    updateStats();
  }
  function setOverlay(mode) {
    game.mode = mode;
    const content = {
      intro: ['✦ BOARDWALK FAVORITE ✦', '🥫', 'Ready to<br><em>ride the tide?</em>', 'Stack all 6 cans & bottles. Drop when the needle hits mint—too much wobble and the fizzy stuff goes flying!', "LET'S PLAY", '6 DROPS · 3 SPLASHES MAX'],
      won: ['✦ YOU NAILED IT ✦', '🎉', 'A perfect<br><em>pyramid!</em>', `Not a drop out of place! You won <b>$5 cash</b>, <b>15 tickets</b> & a Block Buddy plush.`, 'PLAY AGAIN', 'THE PIER PROS KNOW THEIR STUFF'],
      lost: ['✦ OH, THE HUMANITY ✦', '💦', 'The tide<br><em>got you.</em>', 'That last splash sent the whole stack tumbling. Take a breath, steady your hand, and give it another go!', 'TRY AGAIN', 'EVERY CHAMPION GETS A LITTLE WET']
    }[mode];
    $('overlayStamp').textContent = content[0]; $('overlayEmoji').textContent = content[1];
    $('overlayTitle').innerHTML = content[2]; $('overlayText').innerHTML = content[3];
    $('overlayButton').innerHTML = `${content[4]} <span>→</span>`; $('overlayFoot').textContent = content[5];
    $('gameOverlay').classList.remove('hidden');
    $('steadyButton').classList.remove('active');
    $('steadyButton').setAttribute('aria-pressed', 'false');
  }
  $('overlayButton').addEventListener('click', () => {
    if (game.mode === 'intro' || game.mode === 'lost' || game.mode === 'won') beginRound();
  });

  function swayValue(now) {
    const t = (now - game.startedAt) / 1000;
    const item = makeItem(game.placed.length);
    const fillFactor = item.fill;
    return Math.sin(t * 2.45 + game.round * .73) * (.77 + fillFactor * .2) * (game.holding ? .2 : 1);
  }
  function nearestSlot(point) {
    if (!point || game.mode !== 'playing') return false;
    const p = slots[game.placed.length];
    if (!p) return false;
    return Math.hypot(point.x - p.x, point.y - (p.base - 40)) < 62;
  }
  function drop(now) {
    if (game.mode !== 'playing' || game.placed.length >= 6) return;
    const p = slots[game.placed.length];
    if (!nearestSlot(game.pointer)) return;
    const sway = swayValue(now);
    const safeLimit = game.holding ? .48 : .31;
    if (Math.abs(sway) > safeLimit) {
      game.spills++;
      game.lastSplash = now;
      game.particles.push({ x: p.x, y: p.base - 45, time: now, color: '#67d4e4' });
      updateStats();
      if (game.spills >= 3) setOverlay('lost');
      return;
    }
    game.placed.push(makeItem(game.placed.length));
    game.bonusCash += Math.max(0, Math.round((1 - Math.abs(sway) / safeLimit) * 2));
    game.bonusTickets += Math.abs(sway) < .13 ? 1 : 0;
    updateStats();
    if (game.placed.length === 6) {
      wallet.cash += 5 + game.bonusCash;
      wallet.tickets += 15 + game.bonusTickets;
      wallet.plush++;
      save(); updateWallet(); setOverlay('won');
    }
  }

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    game.pointer = { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height };
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (game.mode !== 'playing') return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    game.pointer = { x: (event.clientX - rect.left) / rect.width * canvas.width, y: (event.clientY - rect.top) / rect.height * canvas.height };
    drop(performance.now());
  });
  canvas.addEventListener('pointerleave', () => { game.pointer = null; });
  function holdDown(event) { event.preventDefault(); game.holding = true; $('steadyButton').classList.add('active'); $('steadyButton').setAttribute('aria-pressed', 'true'); }
  function holdUp() { game.holding = false; $('steadyButton').classList.remove('active'); $('steadyButton').setAttribute('aria-pressed', 'false'); }
  const steady = $('steadyButton');
  steady.addEventListener('pointerdown', holdDown); steady.addEventListener('pointerup', holdUp); steady.addEventListener('pointerleave', holdUp); steady.addEventListener('pointercancel', holdUp);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat && game.mode === 'playing') { event.preventDefault(); game.holding = true; steady.classList.add('active'); steady.setAttribute('aria-pressed', 'true'); }
    if ((event.code === 'Enter' || event.code === 'ArrowDown') && game.mode === 'playing' && game.pointer) { event.preventDefault(); drop(performance.now()); }
  });
  window.addEventListener('keyup', (event) => { if (event.code === 'Space') holdUp(); });
  window.addEventListener('blur', holdUp);

  const shop = $('shopModal');
  $('shopOpen').addEventListener('click', () => { $('shopMessage').textContent = wallet.plush ? `You've won ${wallet.plush} Block Buddy plush${wallet.plush === 1 ? '' : 'es'}! Spend tickets on another.` : 'Win a round to fill your ticket stash!'; updateWallet(); shop.hidden = false; });
  $('shopClose').addEventListener('click', () => { shop.hidden = true; });
  shop.addEventListener('click', (event) => { if (event.target === shop) shop.hidden = true; });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') shop.hidden = true; });
  document.querySelectorAll('.redeem-button').forEach((button) => button.addEventListener('click', () => {
    const cost = Number(button.dataset.cost), prize = button.dataset.prize;
    if (wallet.tickets < cost) { $('shopMessage').textContent = `You need ${cost - wallet.tickets} more tickets for that one. Keep stacking!`; return; }
    wallet.tickets -= cost;
    if (prize === 'Block Buddy Plush') wallet.plush++;
    else wallet.cash += 5;
    save(); updateWallet();
    $('shopMessage').textContent = `Sweet! ${prize} is yours. Thanks for visiting the shack!`;
  }));

  function roundedRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function drawCloud(x, y, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = '#fff8e9a8';
    ctx.beginPath(); ctx.arc(0, 7, 18, 0, Math.PI * 2); ctx.arc(21, 0, 24, 0, Math.PI * 2); ctx.arc(46, 8, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function drawTent(x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = '#f9ead0'; ctx.beginPath(); ctx.moveTo(-92, 0); ctx.lineTo(0, -89); ctx.lineTo(92, 0); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#f5bc63' : color; ctx.beginPath(); ctx.moveTo(-90 + i * 26, 0); ctx.lineTo(-13 + i * 4.3, -75); ctx.lineTo(13 + i * 26, 0); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = '#fff4db'; ctx.fillRect(-94, -4, 188, 12); ctx.fillStyle = '#e27760'; ctx.beginPath(); ctx.moveTo(-95, 8); for (let i=0;i<8;i++){const xx=-95+i*27;ctx.lineTo(xx+13.5,17);ctx.lineTo(xx+27,8)}ctx.fill();
    ctx.restore();
  }
  function drawCan(item, x, base, angle = 0, alpha = 1, scale = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, base); ctx.rotate(angle); ctx.scale(scale, scale);
    if (item.type === 'bottle') {
      const w = 45, h = 88;
      ctx.fillStyle = '#17364c'; roundedRect(ctx, -w/2 + 2, -h + 3, w, h, 12); ctx.fill();
      ctx.fillStyle = item.color.body; ctx.beginPath(); ctx.moveTo(-15,-h+16);ctx.lineTo(-12,-h+31);ctx.lineTo(-21,-h+39);ctx.lineTo(-21,-13);ctx.quadraticCurveTo(-21,-5,-12,-5);ctx.lineTo(12,-5);ctx.quadraticCurveTo(21,-5,21,-13);ctx.lineTo(21,-h+39);ctx.lineTo(12,-h+31);ctx.lineTo(15,-h+16);ctx.closePath();ctx.fill();
      ctx.fillStyle = '#d9a64a'; roundedRect(ctx,-11,-h+1,22,12,4);ctx.fill();ctx.fillStyle='#ffefa9';ctx.fillRect(-9,-h+2,18,3);
      ctx.fillStyle=item.color.label; roundedRect(ctx,-17,-h+45,34,25,7);ctx.fill();
      ctx.fillStyle=item.color.body;ctx.font='bold 8px "DM Sans"';ctx.textAlign='center';ctx.fillText(item.color.name,0,-h+57);
      ctx.fillStyle='#e7faf3'; ctx.fillRect(-12,-18,24,7);
      ctx.fillStyle='#fff9d6'; ctx.globalAlpha *= .7; ctx.fillRect(-14,-h+18,5,24);
      ctx.restore(); return;
    }
    const w=57,h=77;
    ctx.fillStyle='#17364c';roundedRect(ctx,-w/2+2,-h+3,w,h,10);ctx.fill();
    ctx.fillStyle=item.color.body;roundedRect(ctx,-w/2,-h,w,h,10);ctx.fill();
    ctx.fillStyle='#f6d985';ctx.beginPath();ctx.ellipse(0,-h+3,w/2,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=item.color.label;roundedRect(ctx,-w/2+3,-h+28,w-6,29,6);ctx.fill();
    ctx.fillStyle=item.color.body;ctx.textAlign='center';ctx.font='bold 9px "DM Sans"';ctx.fillText(item.color.name,0,-h+40);
    ctx.fillStyle='#fff';ctx.font='bold 6px "DM Sans"';ctx.fillText('SODA',0,-h+51);
    ctx.fillStyle='#ffffff88';roundedRect(ctx,-w/2+7,-h+8,5,15,3);ctx.fill();
    ctx.fillStyle='#d5a548';ctx.fillRect(-w/2+3,-3,w-6,3);
    ctx.restore();
  }
  function drawPlush(x,y) {
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#e8a84a';ctx.beginPath();ctx.arc(-17,-34,11,0,Math.PI*2);ctx.arc(17,-34,11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffd16a';ctx.beginPath();ctx.roundRect(-27,-43,54,49,15);ctx.fill();ctx.fillStyle='#f1b94e';ctx.beginPath();ctx.roundRect(-27,-9,54,15,[0,0,12,12]);ctx.fill();
    ctx.fillStyle='#604d45';ctx.beginPath();ctx.arc(-9,-24,2.4,0,Math.PI*2);ctx.arc(9,-24,2.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#604d45';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-17,5,.15,Math.PI-.15);ctx.stroke();
    ctx.fillStyle='#f58a72';ctx.beginPath();ctx.arc(-22,-15,4,0,Math.PI*2);ctx.arc(22,-15,4,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function drawScene(now) {
    const W=960,H=580;
    const sky=ctx.createLinearGradient(0,0,0,510);sky.addColorStop(0,'#83cfd1');sky.addColorStop(.58,'#b8e3d2');sky.addColorStop(1,'#ffdea0');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Distant boardwalk and sea
    ctx.fillStyle='#5fbfc4';ctx.fillRect(0,321,W,92);
    ctx.fillStyle='#7ed0c8';for(let i=0;i<9;i++){ctx.beginPath();ctx.ellipse((i*139+45)%1000,347+(i%3)*16,29,3,0,0,Math.PI*2);ctx.fill();}
    drawCloud(154,93,.7);drawCloud(789,117,.8);
    drawTent(94,321,.88,'#ed7963');drawTent(865,321,.82,'#e97761');
    // distant ferris wheel
    ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle='#fff9e7';ctx.lineWidth=5;ctx.beginPath();ctx.arc(750,208,65,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(750,143);ctx.lineTo(750,273);ctx.moveTo(685,208);ctx.lineTo(815,208);ctx.moveTo(704,162);ctx.lineTo(796,254);ctx.moveTo(796,162);ctx.lineTo(704,254);ctx.stroke();ctx.restore();
    // Stall awnings at edges
    ctx.fillStyle='#f9eed4';ctx.fillRect(0,270,211,38);ctx.fillStyle='#ec7c63';for(let i=0;i<8;i++)ctx.fillRect(i*30,270,15,38);
    ctx.fillStyle='#f9eed4';ctx.fillRect(748,273,212,37);ctx.fillStyle='#eab74d';for(let i=0;i<8;i++)ctx.fillRect(748+i*30,273,15,37);
    ctx.fillStyle='#17384e';ctx.font='bold 12px "Paytone One"';ctx.textAlign='center';ctx.fillText('PRIZE SHACK',105,260);ctx.fillText('FIZZ & POP',851,263);
    drawPlush(103,316);
    // Bottles at the concession counter
    const displayItems=[{type:'bottle',color:palette[1]},{type:'can',color:palette[0]},{type:'bottle',color:palette[2]}];
    displayItems.forEach((it,i)=>drawCan(it,812+i*37,306,0,.92,.52));
    // Carnival string bunting
    ctx.strokeStyle='#fff8e8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(206,72);ctx.quadraticCurveTo(480,128,754,72);ctx.stroke();
    const flags=['#f16e58','#f7c351','#fff4d8','#56c5bb','#f16e58','#f7c351','#fff4d8','#56c5bb','#f16e58'];
    flags.forEach((color,i)=>{const x=222+i*65,y=77+Math.sin(i/8*Math.PI)*34;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+19,y+3);ctx.lineTo(x+9,y+22);ctx.closePath();ctx.fill();});
    // Header sign
    ctx.fillStyle='#17384e';roundedRect(ctx,348,24,264,40,11);ctx.fill();ctx.fillStyle='#ffe18a';ctx.textAlign='center';ctx.font='14px "Paytone One"';ctx.fillText('HIGH TIDE!  •  STACK-OFF',480,50);
    // Swing meter
    const active=game.mode==='playing';const sway=active?swayValue(now):0;const meterX=354,meterY=88,meterW=252;
    ctx.fillStyle='#17384edc';roundedRect(ctx,meterX,meterY,meterW,42,12);ctx.fill();
    ctx.fillStyle='#d6e8d7';ctx.textAlign='center';ctx.font='bold 8px "DM Sans"';ctx.letterSpacing='1px';ctx.fillText(active?(game.holding?'STEADY... DROP WHEN READY':'WAIT FOR THE MINT ZONE'):'THE SWEET SPOT',480,102);ctx.letterSpacing='0px';
    const trackX=377,trackY=113,trackW=206;
    ctx.fillStyle='#425f6c';roundedRect(ctx,trackX,trackY,trackW,6,4);ctx.fill();
    ctx.fillStyle='#55d5ae';roundedRect(ctx,trackX+trackW*.37,trackY,trackW*.26,6,4);ctx.fill();
    const needleX=trackX+(sway+1)/2*trackW;
    ctx.fillStyle='#fff4c2';ctx.beginPath();ctx.arc(needleX,trackY+3,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#17384e';ctx.lineWidth=2;ctx.stroke();
    // Deck and planks
    ctx.fillStyle='#b5734e';ctx.fillRect(0,493,960,87);
    ctx.fillStyle='#cf9360';ctx.fillRect(0,493,960,12);
    for(let i=0;i<7;i++){ctx.strokeStyle=i%2?'#9e6649':'#a9704d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,512+i*12);ctx.lineTo(960,512+i*12);ctx.stroke();}
    for(let i=0;i<12;i++){ctx.strokeStyle='#a66d4c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(i*86,506);ctx.lineTo(i*86-8,580);ctx.stroke();}
    // Counter lip
    ctx.fillStyle='#f5cb79';ctx.fillRect(0,488,960,7);ctx.fillStyle='#e8ad5a';ctx.fillRect(0,495,960,5);
    // Landing circles
    slots.forEach((p,i)=>{
      const occupied=i<game.placed.length;const target=active&&i===game.placed.length;
      if(occupied)return;
      ctx.save();ctx.globalAlpha=target?.9:.30;
      ctx.fillStyle=target?'#f8ffdc':'#fff7dd';ctx.beginPath();ctx.ellipse(p.x,p.base-2,target?39:28,7,0,0,Math.PI*2);ctx.fill();
      if(target){ctx.strokeStyle='#fffbea';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.ellipse(p.x,p.base-2,41,9,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      ctx.restore();
    });
    // Placed items
    game.placed.forEach((item,i)=>{
      const p=slots[i];let wobble=0;
      if(game.mode==='playing'&&i>=Math.max(0,game.placed.length-2))wobble=Math.sin(now/150+i*1.3)*.016;
      if(game.mode==='lost')wobble=(i%2?.28:-.24);
      if(now-game.lastSplash<380)wobble+=Math.sin(now/22+i)*.09;
      drawCan(item,p.x,p.base,wobble,1,1);
    });
    // Current drink, glowing target and hand cursor
    if(active&&game.placed.length<6){
      const p=slots[game.placed.length],item=makeItem(game.placed.length),valid=nearestSlot(game.pointer);
      const wobble=sway*.13;
      ctx.save();ctx.globalAlpha=.24+Math.sin(now/180)*.08;ctx.fillStyle='#fff5cf';ctx.beginPath();ctx.ellipse(p.x,p.base-3,49,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
      drawCan(item,p.x,p.base-5,wobble,.80,1);
      if(valid){ctx.fillStyle=Math.abs(sway)<(game.holding?.48:.31)?'#48c993':'#ef896f';ctx.font='bold 12px "DM Sans"';ctx.textAlign='center';ctx.fillText(Math.abs(sway)<(game.holding?.48:.31)?'DROP!':'WAIT…',p.x,p.base-111);}
    }
    // Spill sparkles
    game.particles=game.particles.filter(p=>now-p.time<560);
    game.particles.forEach(p=>{const t=(now-p.time)/560;ctx.globalAlpha=1-t;ctx.fillStyle=p.color;for(let i=0;i<5;i++){const a=i*1.26;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*t*54,p.y+Math.sin(a)*t*39,3*(1-t),0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;});
    // Round badge
    ctx.fillStyle='#17384eaa';roundedRect(ctx,22,31,104,27,8);ctx.fill();ctx.fillStyle='#fff5d4';ctx.textAlign='left';ctx.font='bold 9px "DM Sans"';ctx.fillText(`ROUND ${Math.max(game.round,1)}   •   ${game.placed.length}/6`,34,48);
    if(active){ctx.fillStyle='#17384e99';roundedRect(ctx,727,36,207,24,8);ctx.fill();ctx.fillStyle='#fff7e2';ctx.textAlign='center';ctx.font='bold 8px "DM Sans"';ctx.fillText(game.pointer&&nearestSlot(game.pointer)?'NICE AIM — WATCH THE NEEDLE':'TAP THE GLOWING LANDING SPOT',830,51);}
  }
  function frame(now){ctx.clearRect(0,0,canvas.width,canvas.height);drawScene(now);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
