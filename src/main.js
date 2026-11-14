import './style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const $ = (id) => document.getElementById(id);
const stage = $('stage-inner');
const frame = stage.parentElement;
const COUNT = 6;
const surface = 0.25;
const pieceHeight = 0.86;
const radius = 0.43;
const slots = [
  {x:-0.91,z:0}, {x:0,z:0}, {x:0.91,z:0},
  {x:-0.455,z:0,y:pieceHeight}, {x:0.455,z:0,y:pieceHeight},
  {x:0,z:0,y:pieceHeight*2},
];
const palette = [0xff7659,0x68c6a5,0xffcb55,0xa88de0,0x68bad7,0xe889b2];
let renderer, scene, camera, world, lastTime=0, pieces=[], count=0, phase='ready', holding=false;
let spillClock=0, stableClock=0, toastClock=0, soundOn=false, audioCtx=null, windTime=0;

function initScene(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x9a5960); scene.fog=new THREE.Fog(0x9a5960,12,25);
  camera=new THREE.PerspectiveCamera(36,1,.1,80); camera.position.set(0,4.1,10.8); camera.lookAt(0,1.55,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25; stage.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffdfc1,0x392136,2.1));
  const key=new THREE.DirectionalLight(0xffe6c6,3.2); key.position.set(-4,8,7); scene.add(key);
  const rim=new THREE.PointLight(0xffb257,85,13); rim.position.set(2,5,-2); scene.add(rim);
  const pink=new THREE.PointLight(0xff6473,45,11); pink.position.set(-4,3,1); scene.add(pink);
  buildBackdrop(); buildPhysics(); resize();
  window.addEventListener('resize',resize); renderer.setAnimationLoop(animate);
}
function mat(color,roughness=.55,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function box(name, size, pos, material, parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),material);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function buildBackdrop(){
  const wall=mat(0x9f5b5c); box('back wall',[14,8,.28],[0,2.1,-3.3],wall);
  // Painted stripes and the little light bulbs make the stall read like a real midway booth.
  for(let i=0;i<9;i++){
    const x=-4+i*1; const stripe=box('awning stripe',[.82,.12,.08],[x,4.45,-2.95],mat(i%2?0xffd26a:0xffe4bd)); stripe.rotation.z=-.09;
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.055,12,10),new THREE.MeshBasicMaterial({color:i%2?0xffd45e:0xfff0ce}));bulb.position.set(x,4.25,-2.86);scene.add(bulb);
  }
  for(let i=0;i<7;i++){
    const x=-3.3+i*1.1; const pennant=new THREE.Mesh(new THREE.ConeGeometry(.22,.46,3),mat([0xffcf61,0xff6e58,0xffedcd][i%3])); pennant.rotation.z=Math.PI; pennant.position.set(x,3.91,-2.8);scene.add(pennant);
  }
  // Warm side rails, stage lip and brass corner posts.
  box('counter-front',[6.5,.3,.48],[0,.02,.22],mat(0x53263b));
  box('counter-top',[6.5,.12,3.25],[0,.17,-.55],mat(0xefa65f,.4));
  box('counter-edge',[6.54,.12,.14],[0,.26,1.08],mat(0xffd071,.3,.3));
  for(const x of [-3.1,3.1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.065,.085,3.3,12),mat(0xffcf6a,.28,.55));post.position.set(x,1.85,-1.92);scene.add(post);
    for(const y of [.5,3.18]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.11,12,10),mat(0xffd777,.25,.5));cap.position.set(x,y,-1.92);scene.add(cap);}
  }
  // Little prize silhouettes decorate the back ledge.
  for(let i=0;i<5;i++){
    const x=-2.5+i*1.25, c=[0xff8e82,0x7ed7b2,0xffd45e,0xb69ce8,0x76c7df][i];
    const body=new THREE.Mesh(new THREE.SphereGeometry(.3,18,14),mat(c));body.scale.y=1.12;body.position.set(x,3.05,-2.58);scene.add(body);
    const earMat=mat(c);for(const dx of [-.19,.19]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.12,12,10),earMat);ear.position.set(x+dx,3.38,-2.58);scene.add(ear);}
    const eyeMat=new THREE.MeshBasicMaterial({color:0x382038});for(const dx of [-.09,.09]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.027,8,8),eyeMat);eye.position.set(x+dx,3.1,-2.29);scene.add(eye);}
  }
  // Counter's scattered star decals.
  const starMat=new THREE.MeshBasicMaterial({color:0xffe0a1,transparent:true,opacity:.72});
  for(let i=0;i<17;i++){const star=new THREE.Mesh(new THREE.CircleGeometry(.035+(i%3)*.016,5),starMat);star.position.set(-3+(i*1.73)%6,.246,-1.8+(i*.69)%2.9);star.rotation.z=i*.75;scene.add(star);}
  // A soft floor plane under the counter.
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),mat(0x4a2d43));floor.rotation.x=-Math.PI/2;floor.position.y=-.23;scene.add(floor);
}
function buildPhysics(){
  world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)});world.allowSleep=true;world.broadphase=new CANNON.SAPBroadphase(world);world.solver.iterations=18;world.solver.tolerance=.001;
  const material=new CANNON.Material('painted wood');
  world.defaultContactMaterial.friction=.68;world.defaultContactMaterial.restitution=.025;
  const ground=new CANNON.Body({mass:0,material,shape:new CANNON.Box(new CANNON.Vec3(3.2,.09,1.62)),position:new CANNON.Vec3(0,.12,-.55)});world.addBody(ground);
  // broad raised surface hides the collision box and gives the pieces a clean starting shelf.
}
function resize(){if(!renderer||!frame)return;const r=frame.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function makeCanTexture(color,label){
  const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');
  g.fillStyle='#'+color.toString(16).padStart(6,'0');g.fillRect(0,0,256,512);
  g.fillStyle='rgba(255,255,255,.16)';g.fillRect(17,0,19,512);g.fillStyle='rgba(36,18,42,.14)';g.fillRect(215,0,24,512);
  g.fillStyle='#fff0d6';g.beginPath();g.ellipse(128,255,106,131,0,0,Math.PI*2);g.fill();
  g.fillStyle='#49233b';g.textAlign='center';g.font='900 48px sans-serif';g.fillText('POP!',128,246);
  g.font='700 18px sans-serif';g.fillText(label.toUpperCase(),128,280);
  g.fillStyle='#ff7659';g.font='bold 24px sans-serif';g.fillText('✦',128,205);
  g.fillStyle='rgba(255,255,255,.7)';g.fillRect(0,29,256,10);g.fillRect(0,473,256,10);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function buildCan(color,label){
  const group=new THREE.Group(), canMat=new THREE.MeshStandardMaterial({map:makeCanTexture(color,label),roughness:.27,metalness:.28});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(radius*.92,radius*.92,.75,40,1,false),canMat);body.position.y=0;body.castShadow=true;group.add(body);
  const silver=mat(0xc9d2cd,.22,.78), top=new THREE.Mesh(new THREE.CylinderGeometry(radius*.9,radius*.9,.055,40),silver);top.position.y=.4;group.add(top);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(radius*.88,radius*.88,.04,40),silver);bottom.position.y=-.395;group.add(bottom);
  const ringMat=mat(0xe5ddd0,.24,.68);for(const y of [-.34,.34]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius*.88,.025,8,36),ringMat);ring.rotation.x=Math.PI/2;ring.position.y=y;group.add(ring);}
  const tab=new THREE.Mesh(new THREE.TorusGeometry(.09,.025,8,18),mat(0x6d7773,.24,.65));tab.rotation.x=Math.PI/2;tab.position.set(.03,.432,0);group.add(tab);
  return group;
}
function buildBottle(color,label){
  const group=new THREE.Group();const glass=new THREE.MeshStandardMaterial({color,roughness:.23,metalness:.1,transparent:true,opacity:.94});
  const points=[new THREE.Vector2(.13,-.43),new THREE.Vector2(.3,-.4),new THREE.Vector2(.37,-.31),new THREE.Vector2(.38,.05),new THREE.Vector2(.34,.18),new THREE.Vector2(.2,.3),new THREE.Vector2(.15,.37),new THREE.Vector2(.15,.45),new THREE.Vector2(.19,.46),new THREE.Vector2(.19,.51),new THREE.Vector2(.13,.53),new THREE.Vector2(.13,.36),new THREE.Vector2(.19,.23),new THREE.Vector2(.3,.1),new THREE.Vector2(.3,-.22),new THREE.Vector2(.23,-.32),new THREE.Vector2(.13,-.34)];
  const bottle=new THREE.Mesh(new THREE.LatheGeometry(points,36),glass);bottle.castShadow=true;group.add(bottle);
  const liquid=new THREE.Mesh(new THREE.CylinderGeometry(.28,.29,.27,32),mat(0xf6b64e,.24));liquid.position.y=-.07;group.add(liquid);
  const wrap=new THREE.Mesh(new THREE.CylinderGeometry(.379,.379,.2,36,1,true),new THREE.MeshStandardMaterial({map:makeCanTexture(color,label),roughness:.4,side:THREE.DoubleSide}));wrap.position.y=-.04;group.add(wrap);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.09,24),mat(0xf0d67e,.3,.22));cap.position.y=.54;group.add(cap);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.165,.18,.07,24),mat(0xf5dfaa,.3,.14));collar.position.y=.44;group.add(collar);
  const shine=new THREE.Mesh(new THREE.BoxGeometry(.035,.36,.025),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.38}));shine.position.set(-.24,-.05,.24);shine.rotation.z=-.12;group.add(shine);
  return group;
}
function pieceInfo(index){const bottle=index===2||index===4;const names=bottle?['Cherry fizz','Lemon pop']:['Lucky can','Carnival cola','Peach pop','Star soda'];return{bottle,name:names[index%names.length],color:bottle?(index===2?0x54a884:0x45a6a4):palette[index%palette.length]};}
function updateNext(){const info=pieceInfo(count%COUNT);$('piece-name').textContent=info.name;$('piece-note').textContent=info.bottle?'Sloshy! Hold steady':'Nice and steady';$('piece-badge').classList.toggle('bottle',info.bottle);$('piece-badge').querySelector('span').textContent=info.bottle?'🍾':'🥫';$('stack-count').innerHTML=`${count}<span class="count-total"> / ${COUNT}</span>`;$('stack-pips').innerHTML=Array.from({length:COUNT},(_,i)=>`<span class="pip ${i<count?'filled':''}"></span>`).join('');}
function playTone(freq=440,duration=.12,type='sine'){if(!soundOn)return;try{audioCtx ||= new AudioContext();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.055,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function announce(text,ms=1700){const el=$('toast');el.textContent=text;el.classList.add('show');toastClock=ms/1000;}
function dropPiece(){
  if(phase!=='ready'||count>=COUNT)return;
  const info=pieceInfo(count),slot=slots[count],isBottle=info.bottle;
  const group=isBottle?buildBottle(info.color,info.name):buildCan(info.color,info.name);scene.add(group);
  const shape=new CANNON.Cylinder(radius,radius,pieceHeight,16);
  const body=new CANNON.Body({mass:isBottle?1.32:1.04,shape,position:new CANNON.Vec3(slot.x+(Math.random()-.5)*.045,surface+pieceHeight/2+1.4,slot.z),linearDamping:.28,angularDamping:.52,allowSleep:true,sleepSpeedLimit:.11,sleepTimeLimit:.7});
  body.quaternion.setFromEuler((Math.random()-.5)*(isBottle?.12:.055),0,(Math.random()-.5)*(isBottle?.12:.055));body.userData={bottle:isBottle,spill:0,slot:count};
  world.addBody(body);const piece={body,mesh:group,info,index:count,landed:false};pieces.push(piece);
  // A little carnival breeze gives each drop a different wobble to tame.
  body.angularVelocity.set((Math.random()-.5)*(isBottle?.46:.2),0,(Math.random()-.5)*(isBottle?.46:.2));body.velocity.x=(Math.random()-.5)*.14;
  count++;phase='dropping';stableClock=0;spillClock=0;$('drop-btn').disabled=true;$('drop-label').textContent='IN THE AIR…';$('canvas-hint').textContent='STEADY YOUR STACK!';updateNext();playTone(360,.12,'triangle');
}
function resetGame(show=true){
  for(const p of pieces){world.removeBody(p.body);scene.remove(p.mesh);disposeObject(p.mesh);}pieces=[];count=0;phase='ready';stableClock=0;spillClock=0;holding=false;$('steady-btn').classList.remove('is-active');$('drop-btn').disabled=false;$('drop-label').textContent='DROP PIECE';$('canvas-hint').textContent='YOUR PYRAMID STARTS HERE';$('stability-fill').style.width='0%';$('status-text').textContent='READY WHEN YOU ARE';$('win-overlay').classList.remove('visible');$('win-overlay').setAttribute('aria-hidden','true');updateNext();if(show)announce('Fresh stack! You’ve got this.');
}
function disposeObject(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
function tiltOf(body){const up=body.quaternion.vmult(new CANNON.Vec3(0,1,0));return Math.acos(Math.max(-1,Math.min(1,up.y)));}
function stabilize(dt){
  if(!holding)return;
  for(const p of pieces){const b=p.body;if(b.sleepState===CANNON.Body.SLEEPING)b.wakeUp();const up=b.quaternion.vmult(new CANNON.Vec3(0,1,0));b.angularVelocity.scale(Math.max(0,1-5.8*dt),b.angularVelocity);b.applyTorque(new CANNON.Vec3(up.z*13,0,-up.x*13));b.velocity.x*=Math.max(0,1-2.6*dt);b.velocity.z*=Math.max(0,1-2.6*dt);}
}
function spill(piece){
  piece.info.spilled=true;announce('SPLASH! That bottle got away!',1900);playTone(145,.35,'sawtooth');
  // A brief liquid glint and a playful knock send the whole pyramid tumbling.
  const drops=new THREE.Group();const dropMat=new THREE.MeshBasicMaterial({color:0xffd168});
  for(let i=0;i<12;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.045+Math.random()*.04,8,7),dropMat);d.position.set(piece.body.position.x+(Math.random()-.5)*.3,piece.body.position.y+.25+Math.random()*.25,piece.body.position.z+(Math.random()-.5)*.3);scene.add(d);drops.add(d);}
  setTimeout(()=>{scene.remove(drops);disposeObject(drops);},1000);
  for(const p of pieces){p.body.wakeUp();p.body.applyImpulse(new CANNON.Vec3((Math.random()-.5)*1.8,.2,(Math.random()-.5)*.7),p.body.position);}
  phase='lost';$('drop-btn').disabled=true;$('status-text').textContent='SPILL! THE STACK IS DOWN';setTimeout(()=>resetGame(false),2400);
}
function checkWin(){phase='won';$('drop-btn').disabled=true;$('drop-label').textContent='STACK COMPLETE';$('canvas-hint').textContent='A PERFECT PYRAMID!';$('status-text').textContent='STACK-TACULAR! PRIZE UNLOCKED';$('stability-fill').style.width='100%';$('win-overlay').classList.add('visible');$('win-overlay').setAttribute('aria-hidden','false');playTone(660,.22,'triangle');setTimeout(()=>playTone(880,.3,'triangle'),170);}
function animate(now){
  const dt=Math.min(.033,lastTime?(now-lastTime)/1000:.016);lastTime=now;windTime+=dt;if(!world)return;
  // Gentle moving breeze, almost invisible until an unsteady stack is left alone.
  const breeze=Math.sin(windTime*1.7)*.0015;
  for(const p of pieces){if(p.body.sleepState!==CANNON.Body.SLEEPING)p.body.applyForce(new CANNON.Vec3(breeze*p.body.mass,0,0),p.body.position);}
  stabilize(dt);world.step(1/60,dt,4);
  let danger=0, fallen=false, active=null;
  for(const p of pieces){const b=p.body;p.mesh.position.set(b.position.x,b.position.y,b.position.z);p.mesh.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
    const tilt=tiltOf(b),spin=b.angularVelocity.length();danger=Math.max(danger,Math.min(1,tilt/.78,spin/2));
    if(p===pieces[pieces.length-1])active=p;
    if(b.position.y<surface-.2||Math.abs(b.position.x)>2.7||tilt>1.18)fallen=true;
  }
  if(phase==='dropping'&&active){
    const landed=active.body.position.y<surface+pieceHeight/2+.24&&Math.abs(active.body.velocity.y)<.8;
    if(landed){active.landed=true;phase='settling';$('drop-label').textContent='SETTLING…';playTone(510,.08,'sine');}
  }
  if(phase==='settling'&&active){
    const t=tiltOf(active.body),spin=active.body.angularVelocity.length();
    if(active.info.bottle&&t>.78&&!holding)spillClock+=dt;else spillClock=Math.max(0,spillClock-dt*.8);
    if(spillClock>.48){spill(active);}
    if(fallen){phase='lost';$('status-text').textContent='TIMBER! THE STACK IS DOWN';$('drop-btn').disabled=true;announce('Timber! Let’s give it another go.',1800);setTimeout(()=>resetGame(false),1800);}
    else if(phase==='settling'){
      const calm=t<.18&&spin<.42&&Math.abs(active.body.velocity.y)<.2;
      if(calm)stableClock+=dt;else stableClock=Math.max(0,stableClock-dt*1.8);
      if(holding){$('status-text').textContent='NICE! KEEP IT STEADY';}else if(t>.36||spin>.85){$('status-text').textContent='WOBBLY! HOLD TO STEADY';}else{$('status-text').textContent='LET IT SETTLE…';}
      $('stability-fill').style.width=`${Math.max(5,Math.min(98,stableClock/1.05*100))}%`;
      if(stableClock>1.05){if(count>=COUNT){checkWin();}else{phase='ready';$('drop-btn').disabled=false;$('drop-label').textContent='DROP PIECE';$('canvas-hint').textContent='NICE! NEXT PIECE IS READY';$('status-text').textContent='GOOD STACK — KEEP GOING!';announce(count===3?'Halfway there! Bottle coming up!':'Piece locked in! Nice work.',1450);playTone(600,.09,'triangle');}}
    }
  }
  if(phase==='ready'&&pieces.length){const worst=Math.max(...pieces.map(p=>tiltOf(p.body)));$('stability-fill').style.width=`${Math.max(12,100-worst*70)}%`;}
  if(toastClock>0){toastClock-=dt;if(toastClock<=0)$('toast').classList.remove('show');}
  renderer.render(scene,camera);
}

initScene();updateNext();
$('drop-btn').addEventListener('click',dropPiece);
const steady=$('steady-btn');
function startSteady(e){if(e)e.preventDefault();holding=true;steady.classList.add('is-active');if(e?.pointerId!==undefined)steady.setPointerCapture?.(e.pointerId);}
function stopSteady(){holding=false;steady.classList.remove('is-active');}
steady.addEventListener('pointerdown',startSteady);steady.addEventListener('pointerup',stopSteady);steady.addEventListener('pointercancel',stopSteady);steady.addEventListener('lostpointercapture',stopSteady);
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();startSteady();}});window.addEventListener('keyup',e=>{if(e.code==='Space')stopSteady();});window.addEventListener('blur',stopSteady);
$('reset-btn').addEventListener('click',()=>resetGame(true));$('play-again').addEventListener('click',()=>resetGame(true));
$('sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;$('sound-state').textContent=soundOn?'ON':'OFF';if(soundOn)playTone(520,.1,'sine');});
document.querySelectorAll('.prize-choice').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.prize-choice').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');$('prize-name').textContent=button.dataset.prize==='Plush pal'?'★ Plush pal':'$50 cash';playTone(740,.12,'triangle');}));
