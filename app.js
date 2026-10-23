"use strict";
// RICOS PRG TO LVLLVL · TEST01 · Only Oil's Well COPY SOFT edition.
// The source PRG never leaves the user's browser.
const STUB="AQgLCAoAnjIwNjEAAAB42KkAjRHQqZWF+6kIhfypAIX9qWCF/iCCCKmVhfupDIX8qQCF/alwhf4gggiiAKkBnQDYnQDZnQDanQDb6NDxqQCNFdCNINCNIdCNItCNI9CtAt0JA40C3a0A3Sn8CQKNAN2pjI0Y0KkIjRbQqRuNEdBMfwiiBKAAsfuR/cjQ+eb85v7K0PJg";
const COLORS=[0x000000,0xffffff,0x68372b,0x70a4b2,0x6f3d86,0x588d43,0x352879,0xb8c76f,0x6f4f25,0x433900,0x9a6759,0x444444,0x6c6c6c,0x9ad284,0x6c5eb5,0x959595];
const $=s=>document.getElementById(s),utf=new TextEncoder();
let raw=null,tiles=null,levels=null;
function readBlock(addr,size){
  const p=2+0x0900-0x0801+addr-0x8000;
  if(p<0||p+size>raw.length)throw Error("Fuera del archivo: "+addr.toString(16));
  return raw.slice(p,p+size);
}
function decodePRG(buf){
  raw=buf;
  if(raw.length<38405||raw[0]!==1||raw[1]!==8)throw Error("Formato desconocido: se espera Oil's Well COPY SOFT.");
  if(Array.from(readBlock(0x8004,5)).join(",")!=="195,194,205,56,48")throw Error("No se reconoce la firma CBM80 PETSCII.");
  tiles=readBlock(0x9a00,1024);
  levels=Array.from({length:8},(_,i)=>readBlock(0xa000+1024*i,1024));
  if(levels.some(m=>m.slice(0,1000).some(c=>c>=128)))throw Error("Los indices no coinciden con el tileset de 128 caracteres.");
}
function project(maps,mode,label){
  const full=new Uint8Array(2048);full.set(tiles);
  const glyphs=Array.from({length:256},(_,t)=>({
    data:[Array.from({length:64},(_,p)=>(full[t*8+(p>>3)]>>(7-(p&7)))&1)]
  }));
  const frames=maps.map(m=>({
    bgColor:0,borderColor:0,
    data:Array.from({length:25},(_,y)=>Array.from({length:40},(_,x)=>({
      t:m[y*40+x],fc:1,bc:-1
    })))
  }));
  return {
    version:1,
    tileSet:{id:1,name:"Oil's Well original 128 chars",version:1,width:8,height:8,type:"ascii",sortMethods:["index"],paletteLayouts:[],tiles:glyphs},
    colorPalette:{id:2,name:"C64 preview palette",version:1,data:COLORS,across:8,down:2,maps:[]},
    tileMap:{name:label,frameRanges:[{start:0,end:maps.length}],frames:maps.map(()=>({duration:12})),layers:[{
      id:3,label:"Oil's Well levels",gridWidth:40,gridHeight:25,colorPerMode:"cell",
      screenMode:mode,cellWidth:8,cellHeight:8,tileSetId:1,colorPaletteId:2,
      blockMode:false,frames:frames
    }]},
    ricoInfo:{modeOriginal:"Raster split bitmap hires + multicolor chars",colorRam:"not recovered",warning:"WHITE PREVIEW: original raster and sprites are not reproduced"}
  };
}
function label(n){return "LEVEL_"+String(n+1).padStart(2,"0");}
function getJSON(maps,name){return utf.encode(JSON.stringify(project(maps,$("mode").value,name)));}
function getPRG(m){
  const a=new Uint8Array(2198);
  a.set(Uint8Array.from(atob(STUB),c=>c.charCodeAt(0)));
  a.set(m,150);a.set(tiles,1174);return a;
}
function image(canvas,m,isTiles){
  const ctx=canvas.getContext("2d");
  const im=ctx.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const c=isTiles?Math.floor(y/8)*16+Math.floor(x/8):m[Math.floor(y/8)*40+Math.floor(x/8)];
    const b=tiles[c*8+(y%8)]&(128>>(x%8));
    const v=b?255:0,p=(y*canvas.width+x)*4;
    im.data[p]=v;im.data[p+1]=v;im.data[p+2]=v;im.data[p+3]=255;
  }
  ctx.putImageData(im,0,0);
}
function preview(){
  const n=Number($("level").value);
  image($("map"),levels[n],false);image($("tileset"),levels[n],true);
}
function download(filename,data,mime="application/octet-stream"){
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
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
function bundle(){
  const files=[];
  files.push(["LVLLVL/OILS_WELL_8_NIVELES.json",getJSON(levels,"OILS WELL - 8 LEVELS")]);
  files.push(["LVLLVL/OILS_WELL_8_NIVELES_HIRES.json",utf.encode(JSON.stringify(project(levels,"c64standard","OILS WELL - 8 LEVELS")))]);
  files.push(["BIN/TILESET_ORIGINAL_128.bin",tiles]);
  const padded=new Uint8Array(2048);padded.set(tiles);files.push(["BIN/TILESET_PAD_256.bin",padded]);
  levels.forEach((m,i)=>{
    const n=label(i);
    files.push(["BIN/"+n+"_MAP_1024_ORIGINAL.bin",m]);
    files.push(["BIN/"+n+"_MAP_40x25.bin",m.slice(0,1000)]);
    files.push(["BIN/"+n+"_COLOR_PREVIEW_NO_ORIGINAL.bin",new Uint8Array(1000).fill(1)]);
    files.push(["PRG/OILS_WELL_"+n+"_ESTATICO.prg",getPRG(m)]);
    files.push(["LVLLVL/"+n+".json",getJSON([m],n)]);
  });
  files.push(["README.txt","OIL'S WELL TEST01\n8 frames LVLLVL with original 8x8 character data, unchanged map indices.\nCOLOR RAM IS PROVISIONAL WHITE.\nViewer PRGs do not recreate the bitmap/character raster split.\n"]);
  download("OILS_WELL_RICOS_LVLLVL_TEST01.zip",zip(files),"application/zip");
}
$("source").addEventListener("change",async e=>{
  try{
    const file=e.target.files[0];if(!file)return;
    decodePRG(new Uint8Array(await file.arrayBuffer()));
    $("filename").textContent=file.name;
    $("level").innerHTML=levels.map((_,i)=>"<option value='"+i+"'>Nivel "+(i+1)+"</option>").join("");
    ["level","bundle","alljson","onejson","oneprg","tiles"].forEach(id=>$(id).disabled=false);
    $("status").textContent="Extraccion RAW OK: 8 mapas de 1024 B, charset original 1024 B, 128 caracteres. Color RAM provisional.";
    preview();
  }catch(ex){levels=null;$("status").textContent="FAIL: "+ex.message;}
});
$("level").addEventListener("change",preview);
$("bundle").addEventListener("click",bundle);
$("alljson").addEventListener("click",()=>download("OILS_WELL_8_NIVELES.json",getJSON(levels,"OILS WELL - 8 LEVELS"),"application/json"));
$("onejson").addEventListener("click",()=>{const n=Number($("level").value);download(label(n)+".json",getJSON([levels[n]],label(n)),"application/json");});
$("oneprg").addEventListener("click",()=>{const n=Number($("level").value);download("OILS_WELL_"+label(n)+"_ESTATICO.prg",getPRG(levels[n]));});
$("tiles").addEventListener("click",()=>download("OILS_WELL_TILESET_128.bin",tiles));