"use strict";
/* TEST06: guided 1 KB level-map discovery using a trusted live VIC screen.
   This module never claims that nearby data are levels: every candidate
   must be previewed and explicitly selected. No PRG code is executed. */
const MapHunter=(()=>{
  const MAP_SIZE=1000;
  function validate(file,reference){
    if(!(file instanceof Uint8Array)||file.length<MAP_SIZE)throw Error("Falta PRG original o está demasiado corto");
    if(!(reference instanceof Uint8Array)||reference.length!==MAP_SIZE)throw Error("Falta un mapa de referencia 40x25 capturado del juego");
  }
  function samplePositions(){
    // Fair coverage of the 1000-cell screen, including central playfield.
    const positions=[];for(let i=0;i<125;i++)positions.push((i*137+53)%1000);
    return positions;
  }
  function similarity(file,offset,reference){
    let hits=0;for(let i=0;i<1000;i++)if(file[offset+i]===reference[i])hits++;
    return hits/1000;
  }
  function anchors(file,reference,max=8){
    validate(file,reference);
    const samples=samplePositions(),list=[];
    for(let offset=0;offset+MAP_SIZE<=file.length;offset++){
      let matches=0;
      for(let i=0;i<samples.length;i++)if(file[offset+samples[i]]===reference[samples[i]])matches++;
      if(matches<44)continue;
      const exact=similarity(file,offset,reference);
      if(exact>=0.52)list.push({offset,ratio:exact,sampleRatio:matches/samples.length});
    }
    list.sort((a,b)=>b.ratio-a.ratio || a.offset-b.offset);
    const unique=[];
    for(const a of list){
      if(unique.some(b=>Math.abs(b.offset-a.offset)<1000))continue;
      unique.push(a);
      if(unique.length>=max)break;
    }
    return unique;
  }
  function mapProfile(bytes,reference,offset){
    const freq=new Uint16Array(256),known=new Uint8Array(256);
    for(let i=0;i<1000;i++)known[reference[i]]=1;
    let similar=0,shared=0,adjacent=0,nonzero=0;
    for(let i=0;i<1000;i++){
      const c=bytes[i];freq[c]++;
      if(c===reference[i])similar++;
      if(known[c])shared++;
      if(c!==0)nonzero++;
      if(i%40!==0&&c===bytes[i-1])adjacent++;
    }
    let unique=0,max=0;
    for(let i=0;i<256;i++){if(freq[i])unique++;if(freq[i]>max)max=freq[i];}
    return {offset,bytes,exact:similar/1000,vocabulary:shared/1000,unique,mostCommon:max/1000,
      horizontalRepeats:adjacent/975,nonzero:nonzero/1000,
      // This is a hint, NOT proof of being a map.
      suggested:unique>=7&&max<850&&shared/1000>=0.48};
  }
  function neighborhood(file,reference,anchor,stride=1024,before=8,after=8){
    validate(file,reference);
    if(!Number.isInteger(anchor)||anchor<0||anchor+1000>file.length)throw Error("Offset del mapa inválido");
    if(![1000,1024,2048].includes(stride))throw Error("Stride de nivel no admitido");
    const out=[];
    for(let k=-before;k<=after;k++){
      let at=anchor+k*stride;
      if(at<0||at+1000>file.length)continue;
      let bytes=file.slice(at,at+1000);
      let data=mapProfile(bytes,reference,at);
      data.index=k;data.anchor=k===0;
      if(data.anchor)data.suggested=true;
      out.push(data);
    }
    return out;
  }
  return {anchors,neighborhood,mapProfile,similarity};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=MapHunter;