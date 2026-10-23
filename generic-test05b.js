"use strict";
// RICOS PRG TO LVLLVL | Generic extractor TEST05B.
// Heuristic candidates are NOT proof of graphics format. No game code is executed.
// Supported: C64 PRG direct load, 64 KiB raw RAM image, arbitrary raw BIN with manual base.
// Extra inputs: standalone charset, screen and Color RAM BIN.
const C64COLORS=[0x000000,0xffffff,0x68372b,0x70a4b2,0x6f3d86,0x588d43,0x352879,0xb8c76f,0x6f4f25,0x433900,0x9a6759,0x444444,0x6c6c6c,0x9ad284,0x6c5eb5,0x959595];
const utf=new TextEncoder();
let state=null,extraCharset=null,extraMap=null,extraColors=null,frames=[];
const $=id=>document.getElementById(id);
const hex=n=>"$"+n.toString(16).toUpperCase().padStart(4,"0");
function number(v){v=String(v).trim(); if(/^\$[0-9a-f]+$/i.test(v))return parseInt(v.slice(1),16);if(/^0x[0-9a-f]+$/i.test(v))return parseInt(v,16);if(/^[0-9]+$/.test(v))return Number(v);throw Error("Direccion no valida: "+v);}
function loadSource(bytes,name,base=0){
  const mem=new Uint8Array(65536),used=new Uint8Array(65536);let start,end,kind;
  if(name.toLowerCase().endsWith(".prg")){
    if(bytes.length<3)throw Error("PRG incompleto");
    start=bytes[0]|(bytes[1]<<8);end=start+bytes.length-2;kind="PRG";
    if(end>65536)throw Error("PRG excede $FFFF; no se interpreta automaticamente un archivo encadenado");
    mem.set(bytes.subarray(2),start);used.fill(1,start,end);
  }else if(bytes.length===65536){
    mem.set(bytes);used.fill(1);start=0;end=65536;kind="RAM 64K";
  }else {
    start=base;end=start+bytes.length;kind="BIN RAW";
    if(!Number.isInteger(start)||start<0||end>65536||end===start)throw Error("Direccion base BIN invalida");
    mem.set(bytes,start);used.fill(1,start,end);
  }
  return {mem,used,start,end,kind,size:bytes.length};
}
function present(st,addr,length){
  if(!st||!Number.isInteger(addr)||addr<0||addr+length>65536)return false;
  for(let i=addr;i<addr+length;i++)if(!st.used[i])return false;
  return true;
}
function read(st,addr,length){if(!present(st,addr,length))throw Error("Faltan "+length+" bytes en "+hex(addr)+". Necesitas un volcado RAM o archivo BIN.");return st.mem.slice(addr,addr+length);}
function rankCharset(b){
  let nonzero=0,unique=new Set(),interesting=0;
  for(let c=0;c<256;c++){
    const a=b.subarray(c*8,c*8+8);let filled=0,has0=false,has255=false;
    for(const x of a){filled+=x!==0;has0 ||= x===0;has255 ||= x===255;}
    if(filled)nonzero++;
    if(filled&&filled<8)interesting++;
    unique.add(Array.from(a).join("."));
  }
  return Math.round(unique.size*.22+interesting*.2+nonzero*.08);
}
function rankScreen(b){
  const hist=new Uint16Array(256);for(let i=0;i<1000;i++)hist[b[i]]++;
  const distinct=hist.reduce((n,x)=>n+(x>0),0);
  let neighbor=0;for(let y=0;y<25;y++)for(let x=1;x<40;x++)neighbor+=b[y*40+x]===b[y*40+x-1];
  return Math.round(Math.min(100,distinct)*.55+neighbor/975*35);
}
function findCandidates(st,step,length,rank,max){
  const matches=[];
  for(let a=0;a+length<=65536;a+=step)if(present(st,a,length))matches.push({addr:a,score:rank(read(st,a,length))});
  matches.sort((a,b)=>b.score-a.score||a.addr-b.addr);
  return matches.slice(0,max||64);
}
function glyphsFor(tiles){
  return Array.from({length:256},(_,id)=>({data:[Array.from({length:64},(_,p)=>(tiles[id*8+(p>>3)]>>(7-(p&7)))&1)]}));
}
function makeProject(tiles,records,mode,name){
  if(tiles.length!==2048||!records.length)throw Error("Faltan tileset o frames");
  const multicolor=mode==="c64multicolor";
  const fs=records.map(r=>({
    bgColor:r.palette.bg,borderColor:r.palette.border,
    c64Multi1Color:r.palette.multi1,c64Multi2Color:r.palette.multi2,
    data:Array.from({length:25},(_,y)=>Array.from({length:40},(_,x)=>{
      const pos=y*40+x;
      return {t:r.map[pos],fc:r.colors? r.colors[pos]&15:(multicolor?9:1),bc:-1};
    }))
  }));
  return {
    version:1,
    tileSet:{id:1,name:"Recovered C64 8x8 charset",version:1,width:8,height:8,type:"ascii",
      sortMethods:["index"],paletteLayouts:[],tiles:glyphsFor(tiles)},
    colorPalette:{id:2,name:"Commodore 64",version:1,data:C64COLORS,across:8,down:2,maps:[]},
    tileMap:{name:name,frameRanges:[{start:0,end:records.length}],frames:records.map(()=>({duration:12})),
      layers:[{id:3,label:"C64 recovered screens",gridWidth:40,gridHeight:25,colorPerMode:"cell",
      screenMode:mode,cellWidth:8,cellHeight:8,tileSetId:1,colorPaletteId:2,blockMode:false,frames:fs}]},
    ricoInfo:{exporter:"RICOS GENERIC TEST04",sourceKind:state?state.kind:"unknown",
      confidence:"heuristic/manual; code not executed",colorRam:records.every(r=>!!r.colors)?"provided":"PROVISIONAL for frames without color.bin",
      charsets:"one shared 256-character tileset for all frames",limitations:"No automatic decompression, sprites, bitmap/raster reconstruction or collision logic"}
  };
}
function status(msg,kind){$("status").textContent=msg;$("status").className=kind||"";}
function tableOptions(id,list){
  $(id).innerHTML="";
  for(const c of list){let option=document.createElement("option");option.value=c.addr;option.textContent=hex(c.addr)+" (indicador "+c.score+")";$(id).appendChild(option);}
}
function curAddress(selectId,inputId){return $(inputId).value.trim()?number($(inputId).value):Number($(selectId).value);}
function currentCharset(){
  if(extraCharset){
    if(extraCharset.length!==2048&&extraCharset.length!==1024)throw Error("Charset BIN: 1024 o 2048 bytes");
    let a=new Uint8Array(2048);a.set(extraCharset);return a;
  }
  return read(state,curAddress("charCandidates","charAddr"),2048);
}
function currentMap(){
  if(extraMap){
    if(extraMap.length!==1000&&extraMap.length!==1024)throw Error("MAP BIN: 1000 o 1024 bytes");
    return extraMap.slice(0,1000);
  }
  return read(state,curAddress("mapCandidates","mapAddr"),1000);
}
function colorData(){
  if(extraColors){
    if(extraColors.length!==1000&&extraColors.length!==1024)throw Error("COLOR BIN: 1000 o 1024 bytes");
    return extraColors.slice(0,1000);
  }
  if($("ramColor").checked && state && present(state,0xD800,1000)){
    return read(state,0xD800,1000).map(x=>x&15);
  }
  return null;
}
function palette(){
  return {border:number($("border").value)&15,bg:number($("bg").value)&15,
    multi1:number($("multi1").value)&15,multi2:number($("multi2").value)&15};
}
function drawMap(canvas,map,tiles,colors,pal,mode){
  let ctx=canvas.getContext("2d");let img=ctx.createImageData(320,200);
  for(let y=0;y<200;y++)for(let x=0;x<320;x++){
    let cell=(y>>3)*40+(x>>3),c=map[cell],bits=tiles[c*8+(y&7)];
    let col=colors?colors[cell]&15:mode==="c64multicolor"?9:1;
    let idx;
    if(mode==="c64multicolor"&&col>=8){
      const pair=(bits>>(6-2*((x&7)>>1)))&3;
      idx=[pal.bg,pal.multi1,pal.multi2,col&7][pair];
    }else idx=(bits&(0x80>>(x&7)))?col:pal.bg;
    const rgb=C64COLORS[idx&15],p=(y*320+x)*4;
    img.data[p]=rgb>>>16;img.data[p+1]=(rgb>>>8)&255;img.data[p+2]=rgb&255;img.data[p+3]=255;
  }
  ctx.putImageData(img,0,0);
}
function drawCharset(canvas,tiles){
  const ctx=canvas.getContext("2d"),img=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const c=(y>>3)*16+(x>>3),p=(y*128+x)*4,v=(tiles[c*8+(y&7)]&(128>>(x&7)))?255:0;
    img.data[p]=v;img.data[p+1]=v;img.data[p+2]=v;img.data[p+3]=255;
  }
  ctx.putImageData(img,0,0);
}
function preview(){
  if(!state)return;
  try {
    const tiles=currentCharset(),map=currentMap(),colors=colorData(),pal=palette();
    drawMap($("mapView"),map,tiles,colors,pal,$("mode").value);
    drawCharset($("charsetView"),tiles);
    $("detail").textContent="MAP: "+(extraMap?"BIN externo":hex(curAddress("mapCandidates","mapAddr")))+
      " | TILESET: "+(extraCharset?"BIN externo":hex(curAddress("charCandidates","charAddr")))+
      " | COLOR: "+(colors?"BIN externo":"PROVISIONAL");
  }catch(e){$("detail").textContent="Vista no disponible: "+e.message;}
}
function addFrame(){
  if(!state)return;
  try{
    const charset=currentCharset();
    if(frames.length&&frames[0].charset.some((v,i)=>v!==charset[i]))throw Error("El charset cambió entre capturas. Para mantener todos los gráficos, exportá el JSON actual y empezá un proyecto nuevo. La unión de tilesets será otra prueba.");
    if(frames.length&&frames[0].mode!==$("mode").value)throw Error("Los frames del mismo proyecto deben usar un único modo gráfico.");
    const m=currentMap(),c=colorData(),p=palette(),where=extraMap?"BIN":hex(curAddress("mapCandidates","mapAddr"));
    frames.push({map:m,colors:c,palette:p,charset,where,mode:$("mode").value});
    $("frameList").textContent=frames.map((f,i)=>"Frame "+(i+1)+": "+f.where+(f.colors?" · Color BIN":" · Color provisional")).join("\n");
    status("Frame "+frames.length+" añadido. Puedes cambiar la direccion de MAP y agregar otro.");
    $("exportJson").disabled=false;$("exportZip").disabled=false;
  }catch(e){status("FAIL: "+e.message,"error");}
}
function clearFrames(){frames=[];$("frameList").textContent="Sin frames";$("exportJson").disabled=true;$("exportZip").disabled=true;}
function getExport(){
  if(!frames.length)throw Error("No hay frames");
  const mode=frames[0].mode,name=$("projectName").value.trim()||"C64 RECOVERED SCREENS";
  const project=makeProject(frames[0].charset,frames,mode,name);
  return {project,json:JSON.stringify(project)};
}
function send(name,bytes,mime="application/octet-stream"){
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob([bytes],{type:mime}));
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function exportJson(){try{const x=getExport();send("RICOS_GENERIC_LVLLVL.json",x.json,"application/json");}catch(e){status(e.message,"error");}}
function exportZip(){
  try{
    const x=getExport(),list=[["LVLLVL/RICOS_GENERIC_LVLLVL.json",utf.encode(x.json)],
      ["BIN/TILESET_256.bin",frames[0].charset]];
    frames.forEach((r,i)=>{const p="BIN/FRAME_"+String(i+1).padStart(2,"0");
      list.push([p+"_MAP_1000.bin",r.map]);
      if(r.colors)list.push([p+"_COLOR_1000.bin",r.colors]);
    });
    list.push(["README.txt",utf.encode("RICOS Generic TEST05. VSF capture uses VIC registers; standalone PRG search is heuristic. If COLOR_BIN is absent, color preview is provisional. A static JSON cannot recreate sprites, raster changes or unpacked content.\n")]);
    send("RICOS_GENERIC_TEST05.zip",zip(list),"application/zip");
  }catch(e){status(e.message,"error");}
}
async function fileBytes(id){
  const f=$(id).files[0];return f?new Uint8Array(await f.arrayBuffer()):null;
}
async function applySnapshot(bytes,filename){
  if(typeof ViceCapture==="undefined")throw Error("TEST05B: falta cargar vice-capture-test05b.js");
  const capture=ViceCapture.parse(bytes);
  if(capture.bitmap)throw Error("Esta captura usa bitmap VIC. TEST05 recupera por ahora solo mapas de caracteres.");
  if(capture.ecm)throw Error("Esta captura usa ECM; la conversion ECM requiere una rutina diferente.");
  // Preserve existing captured frames; use 'Borrar frames' to reset.
  state=loadSource(capture.ram,"CAPTURE.RAM");
  extraCharset=capture.tiles;
  extraMap=capture.map;
  extraColors=capture.colors;
  const charCandidates=[{addr:capture.charAddr,score:100}];
  const mapCandidates=[{addr:capture.screenAddr,score:100}];
  tableOptions("charCandidates",charCandidates);
  tableOptions("mapCandidates",mapCandidates);
  $("charAddr").value="";
  $("mapAddr").value="";
  $("bg").value=capture.palette.bg;
  $("border").value=capture.palette.border;
  $("multi1").value=capture.palette.multi1;
  $("multi2").value=capture.palette.multi2;
  $("mode").value=capture.mode;
  $("addFrame").disabled=false;
  status("TEST05B CAPTURA VIC: "+filename+" | MAP "+hex(capture.screenAddr)+
    " | CHARSET "+hex(capture.charAddr)+" ("+capture.charSource+")"+
    " | Color RAM real | "+capture.mode+
    (capture.notes.length?" | ATENCIÓN: "+capture.notes.join("; "):""));
  preview();
  return capture;
}
async function analyze(){
  try{
    const file=$("source").files[0];if(!file)throw Error("Selecciona un archivo PRG o BIN");
    const data=new Uint8Array(await file.arrayBuffer());
    if(file.name.toLowerCase().endsWith(".vsf")){await applySnapshot(data,file.name);return;}
    state=loadSource(data,file.name,number($("rawBase").value));
    extraCharset=await fileBytes("charOverride");extraMap=await fileBytes("mapOverride");extraColors=await fileBytes("colorOverride");
    const charCandidates=findCandidates(state,0x800,2048,rankCharset,32);
    const mapCandidates=findCandidates(state,0x400,1000,rankScreen,64);
    tableOptions("charCandidates",charCandidates);tableOptions("mapCandidates",mapCandidates);
    $("charAddr").value="";$("mapAddr").value="";
    if(!charCandidates.length&&!extraCharset)throw Error("No hay 2 KB continuos de charset en el rango cargado. Agrega CHARSET BIN o un dump RAM.");
    if(!mapCandidates.length&&!extraMap)throw Error("No hay mapa completo en el rango cargado. Agrega MAP BIN o un dump RAM.");
    clearFrames();
    $("addFrame").disabled=false;
    status("Análisis "+state.kind+" "+hex(state.start)+"–"+hex(state.end-1)+
      ". Encontrados "+charCandidates.length+" candidatos de charset y "+mapCandidates.length+
      " de pantalla. Revisá las vistas antes de aceptar.");
    preview();
  }catch(e){status("FAIL: "+e.message,"error");}
}
// Minimal ZIP writer using method STORE. Fully offline.
const crcTab=Array.from({length:256},(_,v)=>{for(let j=0;j<8;j++)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);return v>>>0;});
function crc32(a){let c=0xffffffff;for(let b of a)c=crcTab[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zip(files){
  const parts=[],central=[];let offset=0;
  for(const [name,bytes] of files){
    const nameBytes=utf.encode(name),data=typeof bytes==="string"?utf.encode(bytes):bytes;
    const crc=crc32(data);
    const lh=new Uint8Array(30+nameBytes.length),l=new DataView(lh.buffer);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x0800,true);
    l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);
    l.setUint16(26,nameBytes.length,true);lh.set(nameBytes,30);
    parts.push(lh,data);
    const ch=new Uint8Array(46+nameBytes.length),v=new DataView(ch.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);
    v.setUint16(8,0x0800,true);v.setUint32(16,crc,true);
    v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);
    v.setUint16(28,nameBytes.length,true);v.setUint32(42,offset,true);ch.set(nameBytes,46);
    central.push(ch);offset+=lh.length+data.length;
  }
  const dlen=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);
  v.setUint32(12,dlen,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:"application/zip"});
}

if(typeof module!=="undefined"&&module.exports){
  module.exports={loadSource,present,read,findCandidates,rankCharset,rankScreen,glyphsFor,makeProject,number};
}else{
  $("analyze").addEventListener("click",analyze);
  $("addFrame").addEventListener("click",addFrame);
  $("clearFrames").addEventListener("click",clearFrames);
  $("exportJson").addEventListener("click",exportJson);
  $("exportZip").addEventListener("click",exportZip);
  ["charCandidates","mapCandidates","charAddr","mapAddr","bg","border","multi1","multi2","mode"].forEach(id=>$(id).addEventListener("change",preview));
  ["charOverride","mapOverride","colorOverride"].forEach((id,index)=>{
    $(id).addEventListener("change",async()=>{
      const data=await fileBytes(id);
      if(index===0)extraCharset=data;
      else if(index===1)extraMap=data;
      else extraColors=data;
      preview();
    });
  });
  $("ramColor").addEventListener("change",preview);
}
