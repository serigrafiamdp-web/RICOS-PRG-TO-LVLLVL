"use strict";
// RICOS PRG TO LVLLVL / TEST05 experimental VICE .vsf capture.
// Independent parser. Based on documented VICE snapshot modules:
// https://github.com/VICE-Team/svn-mirror/blob/main/vice/src/snapshot.c
// https://github.com/VICE-Team/svn-mirror/blob/main/vice/src/vicii/vicii-snapshot.c
// Recognizes VIC-II v1.x registers/color layout; unsupported versions fail closed.
const ViceCapture=(()=>{
  function fail(msg){throw Error("VSF: "+msg);}
  function ascii(bytes,start,count){return Array.from(bytes.subarray(start,start+count)).map(x=>x===0?"":String.fromCharCode(x)).join("");}
  function parse(bytes){
    if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
    if(bytes.length<80||ascii(bytes,0,18)!=="VICE Snapshot File"||bytes[18]!==26)fail("cabecera VICE inválida");
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const machine=ascii(bytes,21,16);
    if(machine!=="C64" && machine!=="C64SC")fail("snapshot de otra máquina: "+machine);
    let off=37;
    if(ascii(bytes,off,12)==="VICE Version"){off+=13+8;}
    const modules={};
    while(off<bytes.length){
      if(off+22>bytes.length)fail("módulo truncado");
      const name=ascii(bytes,off,16),major=bytes[off+16],minor=bytes[off+17],size=view.getUint32(off+18,true);
      if(size<22||off+size>bytes.length)fail("tamaño inválido en módulo "+name);
      if(!modules[name])modules[name]={major,minor,start:off+22,len:size-22};
      off+=size;
    }
    const mem=modules.C64MEM,vic=modules["VIC-II"],cia=modules.CIA2;
    if(!mem||!vic||!cia)fail("faltan módulos C64MEM, VIC-II o CIA2");
    if(mem.len<65540)fail("C64MEM incompleto, faltan 64 KB");
    const ram=bytes.slice(mem.start+4,mem.start+4+65536);
    if(vic.major!==1||vic.minor>3)fail("VIC-II versión "+vic.major+"."+vic.minor+" no validada");
    const vicBase=vic.start;
    // VIC-II v1.x (modern layout): AllowBadLines, BadLine, Blank, cbuf[40],
    // colorram[1024], idle/LP[4], matrix[40], DMA[1], rambase DW[4],
    // rastercycle[1], rasterline W[2], regs[64].
    const colorStart=vicBase+43,regsStart=vicBase+1119;
    if(vic.len<1119+64)fail("VIC-II sin registros o Color RAM completos");
    const regs=bytes.slice(regsStart,regsStart+64);
    const col=bytes.slice(colorStart,colorStart+1000).map(x=>x&15);
    const pra=bytes[cia.start],vicBank=(3-(pra&3))*16384;
    const d011=regs[0x11],d016=regs[0x16],d018=regs[0x18];
    const screen=vicBank+((d018>>4)&15)*1024;
    const charset=vicBank+((d018>>1)&7)*2048;
    const bitmap=!!(d011&0x20),multicolor=!!(d016&0x10),ecm=!!(d011&0x40);
    if(screen+1000>65536||charset+2048>65536)fail("direcciones VIC inválidas");
    const notes=[];
    if(bitmap)notes.push("modo BITMAP: los datos de pantalla/charset no representan correctamente la imagen visible");
    if(ecm)notes.push("modo ECM: índices de mapa necesitan decodificar sus 2 bits superiores");
    const romAt=(((vicBank===0||vicBank===0x8000)&&((charset&0x3fff)>=0x1000)&&((charset&0x3fff)<0x2000)));
    let charsetBytes=ram.slice(charset,charset+2048);
    let charsetSource="RAM";
    if(romAt){
      const rom=modules.C64ROM;
      if(rom&&rom.len>=0x5000){
        // C64ROM: 8K KERNAL + 8K BASIC + 4K CHARGEN
        const offset=rom.start+16384+((charset&0x3fff)-0x1000);
        if(offset+2048<=rom.start+rom.len){
          charsetBytes=bytes.slice(offset,offset+2048);
          charsetSource="C64ROM CHARGEN";
        }else notes.push("charset VIC en ROM, snapshot ROM incompleto");
      }else{
        notes.push("charset VIC apunta al ROM de caracteres; sin C64ROM el charset de RAM puede ser incorrecto");
      }
    }
    const p={border:regs[0x20]&15,bg:regs[0x21]&15,multi1:regs[0x22]&15,multi2:regs[0x23]&15};
    return {ram,tiles:charsetBytes,map:ram.slice(screen,screen+1000),colors:col,
      palette:p,screenAddr:screen,charAddr:charset,charSource:charsetSource,
      mode:multicolor?"c64multicolor":"c64standard",bitmap,ecm,multicolor,
      machine,snapshotVersion:bytes[19]+"."+bytes[20],vicVersion:vic.major+"."+vic.minor,notes,
      registers:{d011,d016,d018,cia2pra:pra}};
  }
  return {parse};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ViceCapture;