#!/usr/bin/env python3
"""RICOS PRG TO LVLLVL / Oil's Well COPY SOFT / TEST01."""
import argparse
import base64
import json
import hashlib
import zipfile
from pathlib import Path

STUB = base64.b64decode("AQgLCAoAnjIwNjEAAAB42KkAjRHQqZWF+6kIhfypAIX9qWCF/iCCCKmVhfupDIX8qQCF/alwhf4gggiiAKkBnQDYnQDZnQDanQDb6NDxqQCNFdCNINCNIdCNItCNI9CtAt0JA40C3a0A3Sn8CQKNAN2pjI0Y0KkIjRbQqRuNEdBMfwiiBKAAsfuR/cjQ+eb85v7K0PJg")
C64 = [0x000000,0xffffff,0x68372b,0x70a4b2,0x6f3d86,0x588d43,
       0x352879,0xb8c76f,0x6f4f25,0x433900,0x9a6759,0x444444,
       0x6c6c6c,0x9ad284,0x6c5eb5,0x959595]

def decode(raw):
    if len(raw)<38405 or raw[:2]!=b"\x01\x08":
        raise ValueError("Oil's Well COPY SOFT PRG no reconocido")
    def block(addr,size):
        off=2+0x0900-0x0801+addr-0x8000
        out=raw[off:off+size]
        if len(out)!=size: raise ValueError("Bloque incompleto")
        return out
    if block(0x8004,5)!=bytes.fromhex("c3c2cd3830"):
        raise ValueError("Firma PETSCII CBM80 incorrecta")
    tiles=block(0x9a00,1024)
    maps=[block(0xa000+i*1024,1024) for i in range(8)]
    if any(max(m[:1000])>=128 for m in maps):
        raise ValueError("Índices fuera del charset de 128")
    return tiles,maps

def project(tiles,maps,mode="c64multicolor",name="OILS WELL - 8 LEVELS"):
    charset=tiles+bytes(1024)
    chars=[]
    for c in range(256):
        pixels=[(charset[c*8+(p//8)]>>(7-p%8))&1 for p in range(64)]
        chars.append({"data":[pixels]})
    frames=[]
    for m in maps:
        cells=[[{"t":m[y*40+x],"fc":(9 if mode=="c64multicolor" else 1),"bc":-1} for x in range(40)] for y in range(25)]
        frames.append({"data":cells,"bgColor":0,"borderColor":0,"c64Multi1Color":11,"c64Multi2Color":12})
    return {
      "version":1,
      "tileSet":{"id":1,"name":"Oil's Well 128 chars (padded 256)","version":1,
                 "width":8,"height":8,"type":"ascii","sortMethods":["index"],
                 "paletteLayouts":[],"tiles":chars},
      "colorPalette":{"id":2,"name":"C64 (preview only)","version":1,"data":C64,
                      "across":8,"down":2,"maps":[]},
      "tileMap":{"name":name,"frameRanges":[{"start":0,"end":len(maps)}],
        "frames":[{"duration":12} for m in maps],
        "layers":[{"id":3,"label":"Oil's Well level maps","gridWidth":40,"gridHeight":25,
                   "colorPerMode":"cell","screenMode":mode,"cellWidth":8,
                   "cellHeight":8,"tileSetId":1,"colorPaletteId":2,
                   "blockMode":False,"frames":frames}]},
      "ricoInfo":{"originalMode":"raster split bitmap hires + multicolor characters",
                  "colors":"PROVISIONAL multicolor: fc=9, hires: fc=1; not extracted",
                  "warning":"Static PRG viewers cannot reproduce original raster split."}
    }

def viewer(tiles,m):
    assert len(STUB)==150
    return STUB+m+tiles

def main():
    ap=argparse.ArgumentParser(description="Oil's Well PRG -> 8 frames in LVLLVL JSON")
    ap.add_argument("prg",type=Path,help="Oil's Well COPY SOFT PRG")
    ap.add_argument("--output",default="OILS_WELL_RICOS_LVLLVL_TEST01.zip")
    args=ap.parse_args()
    raw=args.prg.read_bytes()
    t,maps=decode(raw)
    files={}
    def add_json(name,obj):
        files[name]=json.dumps(obj,ensure_ascii=False,separators=(",",":")).encode()
    add_json("LVLLVL/OILS_WELL_8_NIVELES.json",project(t,maps))
    add_json("LVLLVL/OILS_WELL_8_NIVELES_HIRES.json",project(t,maps,"c64standard"))
    files["BIN/TILESET_ORIGINAL_128.bin"]=t
    files["BIN/TILESET_PAD_256.bin"]=t+bytes(1024)
    for i,m in enumerate(maps,1):
        n="LEVEL_%02d"%i
        files["BIN/"+n+"_MAP_1024_ORIGINAL.bin"]=m
        files["BIN/"+n+"_MAP_40x25.bin"]=m[:1000]
        files["BIN/"+n+"_COLOR_PREVIEW_NO_ORIGINAL.bin"]=bytes([1])*1000
        files["PRG/OILS_WELL_"+n+"_ESTATICO.prg"]=viewer(t,m)
        add_json("LVLLVL/"+n+".json",project(t,[m],name=n))
    files["README.txt"]=(
        "RICOS PRG TO LVLLVL - TEST01\n"
        "8 frame native-format LVLLVL JSON with original tileset and original maps.\n"
        "Color RAM NOT recovered; all white is PREVIEW ONLY.\n"
        "PRG files are static viewers, NOT original raster or entire game.\n"
    ).encode()
    add_json("MANIFEST.json",{"sha256_prg":hashlib.sha256(raw).hexdigest(),
                              "levels":8,"tilesetAddress":"$9A00",
                              "mapRange":"$A000-$BFFF","colorRamRecovered":False})
    with zipfile.ZipFile(args.output,"w",compression=zipfile.ZIP_DEFLATED) as z:
        for name,content in sorted(files.items()):z.writestr(name,content)
    print("PASS: exported 8 maps, 128 chars and 8 PRG viewers to",args.output)

if __name__=="__main__":
    main()
