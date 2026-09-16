/* Places have architecture, not just another palette. Every active surface
 * and moving actor is drawn from the physics state; rendering never wakes it. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const Art = global.LumenArt;
  const ready = new Set(['ride','escort','chain','river','ascent','rain']);
  const hash = n => { const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value); };
  const clamp01 = value => Math.max(0, Math.min(1, value));
  const random = hash;
  /** Mélange deux couleurs #rrggbb. Sert à faire GLISSER une palette avec le
   *  mouvement — ici, le ciel qui s'ouvre au fur et à mesure de l'ascension. */
  function mix(from, to, amount) {
    const parse = value => [1,3,5].map(i => parseInt(value.slice(i,i+2),16));
    const a=parse(from), b=parse(to), k=clamp01(amount);
    return '#' + a.map((channel,i)=>Math.round(channel+(b[i]-channel)*k).toString(16).padStart(2,'0')).join('');
  }
  function oval(c,x,y,rx,ry,color,rotation=0) { c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rotation,0,TAU);c.fillStyle=color;c.fill(); }
  function stroke(c,points,color,width=2) { c.beginPath();points.forEach((point,index)=>index?c.lineTo(...point):c.moveTo(...point));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke(); }
  function star(c,x,y,r,color) { c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.2,y-r*.2,x+r,y);c.quadraticCurveTo(x+r*.2,y+r*.2,x,y+r);c.quadraticCurveTo(x-r*.2,y+r*.2,x-r,y);c.quadraticCurveTo(x-r*.2,y-r*.2,x,y-r);c.fillStyle=color;c.fill(); }
  function petal(c,x,y,length,angle,color) { Art.leaf(c,x,y,length,angle,color); }
  function ring(c,x,y,r,color,width=1) { c.beginPath();c.arc(x,y,r,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke(); }
  const kind = game => game.level?.place?.kind;

  function sky(renderer,p,top=p.sky[0],bottom=p.sky[2]) {
    const c=renderer.ctx,w=renderer.width,h=renderer.height;
    const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
    c.fillStyle=gradient;c.fillRect(0,0,w,h);
    return {c,w,h};
  }
  function canopy(renderer,game,p,t) {
    const {c,w,h}=sky(renderer,p),cam=game.camera?.x||0;
    // A leaf-height journey: trunks and a high canopy replace the usual sea.
    for(let layer=0;layer<2;layer++) {
      c.save();c.globalAlpha=layer ? .24:.14;
      const step=layer?390:530,offset=cam*(layer?.16:.06);
      for(let i=Math.floor(offset/step)-1;i<(offset+w)/step+2;i++) {
        const x=i*step-offset+hash(i+20)*110,root=h*1.1,crown=h*(.06+hash(i+17)*.25);
        c.strokeStyle=p.middle;c.lineWidth=layer?24:39;c.lineCap='round';c.beginPath();c.moveTo(x,root);c.bezierCurveTo(x-60,h*.7,x+80,h*.43,x+20,crown);c.stroke();
        for(let branch=0;branch<3;branch++) {
          const y=crown+branch*h*.14,side=branch%2?1:-1;
          stroke(c,[[x+15,y+60],[x+side*80,y+22],[x+side*150,y]],p.middle,7);
          for(let leaf=0;leaf<3;leaf++)petal(c,x+side*(65+leaf*37),y+leaf*6,46+leaf*14,side*.7+Math.sin(t*.15+i)*.015,p.lightLeaf);
        }
      }
      c.restore();
    }
    // The bright opening behind the creature gives its low silhouette room.
    c.save();c.globalAlpha=.15;oval(c,w*.62,h*.62,w*.37,h*.23,p.rim);c.restore();
  }
  function nursery(renderer,game,p,t) {
    const {c,w,h}=sky(renderer,p),cam=game.camera?.x||0;
    c.save();c.globalAlpha=.13;
    const step=270,offset=cam*.12;
    for(let i=Math.floor(offset/step)-1;i<(offset+w)/step+2;i++) {
      const x=i*step-offset,y=h*(.24+hash(i+122)*.38),size=55+hash(i+60)*38;
      c.strokeStyle=p.middle;c.lineWidth=6;c.beginPath();c.moveTo(x+24,h+20);c.bezierCurveTo(x-30,h*.7,x+16,y+80,x,y);c.stroke();
      for(let leaf=0;leaf<5;leaf++)petal(c,x,y,size,(-2+leaf)*.42,p.facet);
      oval(c,x,y+3,size*.25,12,p.rim);
      petal(c,x+8,h*.75,62,-1.2,p.lightLeaf);
    }
    c.restore();
    // A quiet, empty central band keeps the escorted star and its beacons legible.
    c.save();c.globalAlpha=.12;stroke(c,[[0,h*.73],[w,h*.73]],p.rim,30);c.restore();
  }
  function background(renderer,game,p,t) {
    if(!ready.has(kind(game)))return false;
    const c=renderer.ctx;c.save();
    if(kind(game)==='ride')canopy(renderer,game,p,t);
    if(kind(game)==='escort')nursery(renderer,game,p,t);
    if(kind(game)==='chain')ruins(renderer,game,p,t);
    if(kind(game)==='river')riverSky(renderer,game,p,t);
    if(kind(game)==='ascent')rootShaft(renderer,game,p,t);
    if(kind(game)==='rain')rainSky(renderer,game,p,t);
    c.restore();return true;
  }
  function rootShaft(renderer,game,p,t) {
    // La colonne est le seul lieu vraiment vertical du jeu. Tout ici sert une
    // seule chose : qu'on SENTE qu'on monte. Le ciel s'ouvre avec l'altitude,
    // les parois se resserrent en bas, et les strates d'écorce défilent.
    const h0=game.level?.height||2100,view=renderer.height;
    const camY=game.camera?.y||0,span=Math.max(1,h0-view);
    // 0 au fond du puits, 1 sous la couronne.
    const rise=clamp01(1-camY/span);
    const c=renderer.ctx,w=renderer.width,h=view;
    const gradient=c.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,mix(p.sky[1],p.sky[0],rise));
    gradient.addColorStop(.55,mix(p.sky[2],p.sky[1],rise*.85));
    gradient.addColorStop(1,mix(p.shade,p.sky[2],rise*.6));
    c.fillStyle=gradient;c.fillRect(0,0,w,h);

    // Les parois. Elles se referment vers le fond et s'écartent vers le haut :
    // l'ouverture du cadrage raconte l'ascension autant que la couleur.
    const close=.10+(1-rise)*.11;
    c.save();c.globalAlpha=.88;
    for(const side of [-1,1]) {
      c.save();c.translate(side<0?0:w,0);c.scale(side<0?1:-1,1);
      c.fillStyle=p.middle;
      c.beginPath();c.moveTo(0,0);c.lineTo(w*close*.78,0);
      c.bezierCurveTo(w*(close+.09),h*.27,w*(close-.04),h*.5,w*(close+.06),h*.75);
      c.lineTo(w*close,h);c.lineTo(0,h);c.fill();
      // L'écorce : des nervures qui montent, plus serrées près du bord.
      for(let ridge=0;ridge<5;ridge++) {
        const x=16+ridge*Math.max(18,w*close/5.5);
        c.strokeStyle=ridge%2?p.facet:p.shade;c.globalAlpha=.55-ridge*.07;
        c.lineWidth=3+ridge*.9;c.beginPath();c.moveTo(x,-10);
        c.bezierCurveTo(x+22,h*.33,x-8,h*.7,x+15,h+10);c.stroke();
      }
      c.globalAlpha=.88;
      // Le liseré mousseux qui sépare la paroi du vide : c'est lui qui donne
      // le bord franc, et qui défile visiblement quand on grimpe.
      c.strokeStyle=p.lightLeaf;c.globalAlpha=.5;c.lineWidth=3;
      c.beginPath();c.moveTo(w*close*.78,0);
      c.bezierCurveTo(w*(close+.09),h*.27,w*(close-.04),h*.5,w*(close+.06),h*.75);
      c.lineTo(w*close,h);c.stroke();
      c.restore();
    }
    c.restore();

    // Les strates. Elles défilent avec la caméra — c'est la preuve du mouvement.
    const offset=camY*.62,step=168;
    c.save();
    for(let i=Math.floor(offset/step)-1;i<(offset+h)/step+1;i++) {
      const y=i*step-offset,side=i%2?1:-1;
      const depth=clamp01(1-Math.abs(y-h*.5)/(h*.75));
      c.globalAlpha=.30+depth*.22;
      c.strokeStyle=p.facet;c.lineWidth=13;
      c.beginPath();c.moveTo(side<0?0:w,y-30);
      c.bezierCurveTo(w*.35,y-70,w*.55,y+120,side<0?w:0,y+90);c.stroke();
      c.globalAlpha=.42+depth*.28;
      for(let leaf=0;leaf<3;leaf++) petal(c,w*(.24+leaf*.21),y+leaf*22,24+leaf*10,side*.7,p.lightLeaf);
    }
    c.restore();

    // Des motes qui descendent : lentes, discrètes, et toujours dans le même
    // sens. Sans elles, un joueur immobile ne voit pas que le lieu est vertical.
    if(!game.progress?.settings?.reducedEffects) {
      c.save();c.globalAlpha=.30;c.fillStyle=p.rim;
      for(let i=0;i<26;i++) {
        const seed=random(i*7.3),x=seed*w;
        const y=((random(i*3.1)*h)+t*(14+seed*22)+camY*.25)%(h+40)-20;
        c.beginPath();c.arc(x,y,1+seed*1.6,0,TAU);c.fill();
      }
      c.restore();
    }

    // La couronne : elle n'apparaît qu'en haut, et elle est la récompense.
    if(rise>.55) {
      const open=(rise-.55)/.45;
      c.save();c.globalAlpha=.34*open;
      oval(c,w*.5,-40+open*70,w*(.22+open*.14),h*(.2+open*.1),p.rim);
      c.globalAlpha=.5*open;c.strokeStyle=p.rim;c.lineWidth=2;
      for(let ray=0;ray<7;ray++) {
        const angle=-Math.PI/2+(ray-3)*.26;
        c.beginPath();c.moveTo(w*.5,-10+open*40);
        c.lineTo(w*.5+Math.cos(angle)*w*.34,-10+open*40+Math.sin(angle)*h*.4+h*.34);c.stroke();
      }
      c.restore();
    }
  }

  function rainSky(renderer,game,p,t) {
    const {c,w,h}=sky(renderer,p),cam=game.camera?.x||0;
    // Long, low weather banks and open air below. Only the playable cloud
    // emits falling strokes; the scenery never suggests a second rain source.
    const step=420,offset=cam*.05+t*.8;
    c.save();c.globalAlpha=.16;
    for(let i=Math.floor(offset/step)-1;i<(offset+w)/step+2;i++) {
      const x=i*step-offset,y=h*(.13+hash(i+200)*.15);
      oval(c,x,y,160,28,p.rim);oval(c,x-76,y-19,78,29,p.rim);oval(c,x+40,y-22,91,41,p.rim);
    }
    c.restore();
    c.save();c.globalAlpha=.1;stroke(c,[[0,h*.45],[w,h*.45]],p.rim,1);stroke(c,[[0,h*.47],[w,h*.47]],p.rim,1);c.restore();
  }
  function rainStep(c,object,p,t) {
    const {x,y,w}=object,charge=Math.min(1,(object.charge||0)/.55),active=object.active!==false;
    c.save();
    if(!active) {
      // A small closed bud and separated dashes promise a surface, never a
      // solid ledge. Growth below the line follows the actual charge value.
      c.globalAlpha=.6;c.setLineDash([3,11]);stroke(c,[[x+9,y+2],[x+w-9,y+2]],p.middle,1.5);c.setLineDash([]);
      for(let i=20;i<w;i+=40) {
        stroke(c,[[x+i,y+38],[x+i,y+20-charge*14]],p.lightLeaf,2);
        petal(c,x+i,y+24,7+charge*7,-.2,p.lightLeaf);petal(c,x+i,y+24,7+charge*7,.2,p.lightLeaf);
      }
      c.restore();return;
    }
    const curl=object.warning?8:0;
    for(let i=0;i<4;i++) {
      const center=x+w*(.14+i*.24);
      c.fillStyle=i%2?p.lightLeaf:p.grass;c.beginPath();c.moveTo(center-29,y+8);
      c.quadraticCurveTo(center-22,y+50+curl,center,y+53+curl);c.quadraticCurveTo(center+23,y+31,center+30,y+8);c.fill();
      stroke(c,[[center,y+15],[center,y+41+curl]],p.middle,1.4);
    }
    c.fillStyle=p.grass;c.beginPath();c.roundRect(x,y,w,14,5);c.fill();
    stroke(c,[[x,y],[x+w,y]],p.rim,4);stroke(c,[[x,y+4],[x+w,y+4]],p.shade,2);
    Art.platformMarks(c,object,p,t);c.restore();
  }
  function rainCloud(c,game,p,t) {
    const cloud=game.place?.cloud;if(!cloud)return;
    const beds=(game.platforms||[]).filter(platform=>platform.placeRole==='rain-step'&&Math.abs(platform.x+platform.w/2-cloud.x)<112);
    const y=cloud.y,x=cloud.x;
    c.save();
    // Nine discrete streams mark the real 224 px rain footprint. The clear
    // landing rim is painted afterwards and is never hidden by weather.
    c.strokeStyle=p.rim;c.lineWidth=1.6;
    for(let i=0;i<9;i++) {
      const xx=x-96+i*24,end=beds.find(bed=>xx>=bed.x&&xx<=bed.x+bed.w)?.y||610;
      const shift=((t*130+i*43)%74);
      c.globalAlpha=.46;
      for(let yy=y+40+shift;yy<end-10;yy+=74)stroke(c,[[xx,yy],[xx,Math.min(end-8,yy+19)]],p.rim,1.6);
    }
    c.globalAlpha=1;
    oval(c,x,y,112,27,p.facet);oval(c,x-51,y-19,52,36,p.facet);oval(c,x+23,y-32,59,43,p.facet);
    oval(c,x-13,y-5,82,19,p.grass);oval(c,x-45,y-23,37,24,p.grass);oval(c,x+24,y-33,42,31,p.grass);
    stroke(c,[[x-83,y+15],[x-18,y+23],[x+75,y+16]],p.rim,2);
    // The small sail leans towards the chosen target; no cosmetic motion can
    // claim that the cloud has reached a bed before the physics says so.
    const direction=Math.sign(cloud.targetX-cloud.x);
    star(c,x+direction*20,y-39,8,p.rim);
    c.restore();
  }
  function ruins(renderer,game,p) {
    const {c,w,h}=sky(renderer,p),cam=game.camera?.x||0;
    const step=550,offset=cam*.1;
    c.save();c.globalAlpha=.18;c.strokeStyle=p.middle;c.lineWidth=36;
    for(let i=Math.floor(offset/step)-1;i<(offset+w)/step+2;i++) {
      const x=i*step-offset,r=160+hash(i+14)*55,top=h*.23;
      c.beginPath();c.moveTo(x-r,h+30);c.lineTo(x-r,top+r);c.arc(x,top+r,r,Math.PI,TAU);c.lineTo(x+r,h+30);c.stroke();
      // Separate open arches make a viaduct, not another floating-island sea.
      c.save();c.globalAlpha=.55;c.lineWidth=2;c.beginPath();c.arc(x,top+r,r-26,Math.PI,TAU);c.stroke();c.restore();
      for(let seam=0;seam<3;seam++)stroke(c,[[x-r-15,h*.62+seam*74],[x-r+12,h*.62+seam*74-7]],p.shade,2);
    }
    c.restore();
    c.save();c.globalAlpha=.11;oval(c,w*.49,h*.43,w*.13,h*.24,p.rim);c.restore();
  }
  function riverSky(renderer,game,p,t) {
    const {c,w,h}=sky(renderer,p,p.night?'#14292f':'#314f57',p.night?'#416663':'#789789');
    const cam=game.camera?.x||0,light=game.place?.light||0;
    // A missing reflection is the composition's empty centre. Its return is
    // tied to the three real beacons, not to elapsed decorative animation.
    if(light>0) {
      c.save();c.globalAlpha=.7*light;oval(c,w*.72-cam*.01,h*.2,Math.min(w,h)*.075,Math.min(w,h)*.075,p.rim);c.restore();
    }
    const offset=cam*.08,step=205;
    c.save();c.globalAlpha=.18;
    for(let i=Math.floor(offset/step)-1;i<(offset+w)/step+2;i++) {
      const x=i*step-offset,height=h*(.22+hash(i+24)*.4);
      stroke(c,[[x,h],[x+15,h-height*.5],[x+8,h-height]],p.shade,3);
      oval(c,x+8,h-height-12,5,20,p.shade,.06);
      petal(c,x+12,h-height*.38,height*.17,-.8,p.middle);
    }
    c.restore();
    c.save();c.globalAlpha=.1;
    for(let i=0;i<5;i++)stroke(c,[[0,h*(.39+i*.072)],[w,h*(.39+i*.072)]],p.rim,1);
    c.restore();
  }
  function livingBridge(c,object,p,t) {
    const {x,y,w}=object,awake=object.active!==false;
    c.save();
    if(!awake) {
      c.globalAlpha=.4;for(let i=14;i<w;i+=34)oval(c,x+i,y+28,10,7,p.middle);
      c.setLineDash([3,9]);stroke(c,[[x,y+3],[x+w,y+3]],p.middle,1.5);c.restore();return;
    }
    const droop=object.warning?7:0;
    c.strokeStyle=p.middle;c.lineWidth=8;c.beginPath();c.moveTo(x+8,y+12);c.quadraticCurveTo(x+w*.5,y+73+droop,x+w-8,y+12);c.stroke();
    for(let i=0;i<w;i+=28) {
      c.fillStyle=i%56?p.grass:p.lightLeaf;c.beginPath();c.roundRect(x+i,y+4,Math.min(30,w-i),17,7);c.fill();
      if(i%84===0)petal(c,x+i+12,y+27,13,.5,p.lightLeaf);
    }
    stroke(c,[[x,y],[x+w,y]],p.rim,4);stroke(c,[[x,y+4],[x+w,y+4]],p.shade,2);
    Art.platformMarks(c,object,p,t);c.restore();
  }
  function keepers(c,game,p,t) {
    const state=game.place;if(!state)return;
    for(const keeper of state.keepers||[]) {
      const awake=keeper.remaining>0,warning=awake&&keeper.remaining<1.5,x=keeper.x,y=keeper.y;
      c.save();
      // A closed squat bud opens into an upright pair of listening ears.
      oval(c,x,y+(awake?25:34),28,awake?25:15,p.middle);oval(c,x,y+(awake?19:27),19,awake?18:11,p.grass);
      for(const side of [-1,1]) {
        petal(c,x+side*17,y+22,awake?24:14,side*(awake?.3:.95),p.lightLeaf);
        if(awake)oval(c,x+side*7,y+22,2.4,warning?2:4,p.shade);
        else stroke(c,[[x+side*7-3,y+28],[x+side*7,y+30],[x+side*7+3,y+28]],p.shade,1.5);
      }
      if(awake) {star(c,x,y-12,6,p.rim);ring(c,x,y-12,12,p.rim+'88');}
      stroke(c,[[x-17,y+49],[x-11,y+50],[x-5,y+48]],p.shade,2);
      stroke(c,[[x+5,y+48],[x+11,y+50],[x+17,y+49]],p.shade,2);
      c.restore();
    }
  }
  function river(c,game,p,t,renderer) {
    const left=renderer.cameraX-50,right=left+renderer.worldWidth+100,light=game.place?.light||0;
    c.save();
    const water=c.createLinearGradient(0,670,0,900);water.addColorStop(0,p.night?'#325c62':'#5b8685');water.addColorStop(1,p.shade);
    c.fillStyle=water;c.fillRect(left,670,right-left,260);
    for(let i=Math.floor(left/140);i<right/140+1;i++) {
      const x=i*140+Math.sin(t*.3+i)*8,y=690+hash(i+210)*115;
      stroke(c,[[x,y],[x+35+hash(i)*60,y]],p.rim+(light>.5?'60':'25'),1.4);
    }
    const ids=game.level.place.beacons||[];
    // The closed door shows the three flowers it needs, not the optional shards.
    if (!game.exit.open) {
      const x=game.exit.x+game.exit.w/2,y=game.exit.y-38;
      ids.forEach((id,index)=>{
        const lit=game.wokenOnce.has(id),cx=x+(index-1)*23;
        for(let petal=0;petal<5;petal++) {
          const a=petal*Math.PI*2/5;
          oval(c,cx+Math.cos(a)*5,y+Math.sin(a)*5,4,4,lit?p.coral:p.shade);
        }
        oval(c,cx,y,3,3,lit?'#fff0aa':p.rim);
      });
      stroke(c,[[x-5,y+19],[x-13,y+25],[x-5,y+31]],p.rim,2.5);
      stroke(c,[[x-13,y+25],[x+12,y+25]],p.rim,2.5);
    }
    for(const beacon of game.wakeables.filter(w=>ids.includes(w.id))) {
      if(!game.wokenOnce.has(beacon.id))continue;
      for(let row=0;row<7;row++) {
        c.globalAlpha=(.34-row*.035);const width=15+row*7;
        stroke(c,[[beacon.x-width,686+row*24],[beacon.x+width,686+row*24]],p.rim,3-row*.25);
      }
    }
    c.restore();
  }
  function mount(c,deck,p,t,game) {
    const moving=(game.place?.mount?.calmTime||0)>0;
    const direction=game.place?.direction||1,x=deck.x,y=deck.y,w=deck.w;
    c.save();
    // A soft creature hangs BELOW the exact horizontal collision surface.
    // Neither its ears nor its head pretend to be an extra landing platform.
    c.translate(x+w/2,y);c.scale(direction,1);
    oval(c,-8,69,w*.48,55,p.middle);oval(c,-9,80,w*.35,31,p.facet);
    for(let i=0;i<4;i++) {
      const sway=moving?Math.sin(t*3+i*Math.PI)*6:0,foot=-w*.34+i*w*.22;
      oval(c,foot+sway,112,15,18,p.middle,.13);oval(c,foot+sway+3,122,13,5,p.lightLeaf);
    }
    c.beginPath();c.moveTo(-w*.38,72);c.quadraticCurveTo(-w*.7,101,-w*.73,50);c.quadraticCurveTo(-w*.62,75,-w*.39,47);c.fillStyle=p.middle;c.fill();
    oval(c,w*.39,63,42,34,p.middle);oval(c,w*.49,73,22,16,p.lightLeaf);
    petal(c,w*.32,42,21,-.22,p.lightLeaf);petal(c,w*.48,41,18,.38,p.lightLeaf);
    c.beginPath();c.arc(w*.43,62,7,.12,Math.PI-.1);c.strokeStyle=p.shade;c.lineWidth=3;c.stroke();
    stroke(c,[[w*.52,79],[w*.57,77]],p.shade,2);
    for(let i=0;i<7;i++) {const px=-w*.43+i*w*.13;petal(c,px,15,10+(i%3)*4,(i-3)*.1,p.grass);}
    c.restore();
    // La surface d'atterrissage EST le dos de la bête : une carapace mousseuse,
    // dans ses couleurs à elle, et non une dalle d'herbe posée dessus. La boîte
    // de collision ne bouge pas d'un pixel ; seul le dessin change.
    c.save();
    c.fillStyle=p.facet;c.beginPath();c.roundRect(x,y,w,18,7);c.fill();
    // Les écailles du dos, plus serrées vers la tête : elles donnent le sens
    // de la monture sans qu'aucun texte ne l'explique.
    c.save();c.beginPath();c.roundRect(x,y,w,18,7);c.clip();
    for(let plate=0;plate<7;plate++) {
      const px=x+w*(.06+plate*.145),radius=13-plate*.7;
      c.globalAlpha=.5;oval(c,px,y+15,radius,9,p.middle);
      c.globalAlpha=.32;oval(c,px-2,y+13,radius*.62,5,p.lightLeaf);
    }
    c.restore();
    // La mousse du dos : le liseré clair devient la ligne où la mousse rencontre
    // l'air. Il reste le repère d'atterrissage le plus net de l'image.
    stroke(c,[[x,y],[x+w,y]],p.rim,4);
    c.save();c.globalAlpha=.85;
    for(let tuft=0;tuft<9;tuft++) {
      const tx=x+4+tuft*((w-8)/8),lean=((tuft%3)-1)*.42;
      petal(c,tx,y-1,8+(tuft%3)*3,lean-Math.PI/2,p.grass);
    }
    c.restore();
    stroke(c,[[x+2,y+5],[x+w-2,y+5]],p.shade,1.5);
    Art.platformMarks(c,deck,p,t);c.restore();
  }
  function platform(c,object,p,t,game) {
    if(kind(game)==='ride'&&object.placeRole==='mount') { mount(c,object,p,t,game);return true; }
    if(kind(game)==='chain'&&object.placeRole==='living-bridge') { livingBridge(c,object,p,t);return true; }
    if(kind(game)==='rain'&&object.placeRole==='rain-step') { rainStep(c,object,p,t);return true; }
    return false;
  }
  function beforePlatforms(c,game,p,t,renderer) {
    if(kind(game)==='river')river(c,game,p,t,renderer);
    if(kind(game)==='rain')rainCloud(c,game,p,t);
  }
  function escort(c,game,p,t) {
    const state=game.place;if(!state)return;
    for(const flower of state.flowers||[]) {
      const awake=flower.state==='awake';
      if(!awake)continue;
      const centerY=flower.y-33;
      c.save();c.globalAlpha=.13;
      const glow=c.createRadialGradient(flower.x,centerY,2,flower.x,centerY,90);glow.addColorStop(0,p.rim);glow.addColorStop(1,p.rim+'00');
      c.fillStyle=glow;c.fillRect(flower.x-90,centerY-90,180,180);c.restore();
      ring(c,flower.x,centerY,14,p.rim,1.4);star(c,flower.x,centerY,6,p.rim);
      stroke(c,[[flower.x,centerY+15],[flower.x,flower.y]],p.lightLeaf,2);
    }
    const astre=state.astre;if(!astre)return;
    const x=astre.x,y=astre.y-7+Math.sin(t*2.1)*2;
    c.save();
    if(astre.moving) {
      c.globalAlpha=.28;oval(c,x-21,y,26,7,p.rim);c.globalAlpha=1;
      stroke(c,[[x-31,y],[x-17,y]],p.rim,2);
    }
    star(c,x,y,21,p.rim);c.strokeStyle=p.shade;c.lineWidth=1.8;c.stroke();oval(c,x,y,10,10,p.rim);
    oval(c,x-4,y-2,1.7,2.7,p.shade);oval(c,x+4,y-2,1.7,2.7,p.shade);ring(c,x,y,27,p.rim+'88');
    if(!astre.moving&&!astre.arrived) { ring(c,x,y,31,p.rim+'55');stroke(c,[[x-5,y+26],[x,y+31],[x+5,y+26]],p.rim,2); }
    c.restore();
  }
  function afterPlatforms(c,game,p,t) {
    if(kind(game)==='escort')escort(c,game,p,t);
    if(kind(game)==='chain')keepers(c,game,p,t);
  }
  global.LumenPlaceArt={background,beforePlatforms,platform,afterPlatforms};
})(typeof window!=='undefined'?window:globalThis);
