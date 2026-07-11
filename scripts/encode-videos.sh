#!/bin/bash
set -e
RAW=scripts/.tile-cache/videos_raw
OUT=public/video
enc () {
  local IN=$1 S=$2 B=$3 F=$4 W=$5 NAME=$6 GRADE=$7
  local FC="[0:v]trim=${S}:$(echo "$S+$B"|bc),setpts=PTS-STARTPTS[body];[0:v]trim=$(echo "$S+$B"|bc):$(echo "$S+$B+$F"|bc),setpts=PTS-STARTPTS[end];[end][body]xfade=transition=fade:duration=${F}:offset=0,scale=${W}:-2${GRADE}[v]"
  [ -f "$OUT/${NAME}.av1.mp4" ] || ffmpeg -hide_banner -loglevel error -y -i "$RAW/$IN" -filter_complex "$FC" -map "[v]" -an \
    -c:v libsvtav1 -crf 36 -preset 5 -pix_fmt yuv420p10le -svtav1-params tune=0 "$OUT/${NAME}.av1.mp4"
  [ -f "$OUT/${NAME}.h264.mp4" ] || ffmpeg -hide_banner -loglevel error -y -i "$RAW/$IN" -filter_complex "$FC" -map "[v]" -an \
    -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/${NAME}.h264.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/${NAME}.h264.mp4" -frames:v 1 "$OUT/${NAME}-poster.png"
}
DUSK=",eq=brightness=-0.02:saturation=0.92,colorbalance=rh=0.05:bh=-0.03:rs=-0.02:bs=0.05"
enc hero-amadablam.mp4    16 14 2 2560 hero-amadablam "$DUSK"
enc night-stars.mp4        2 14 2 1920 night-stars ""
enc cloud-drift.mp4        1  9 2 1920 cloud-drift "$DUSK"
enc alpenglow-sunrise.mp4  1 11 2 1920 alpenglow-sunrise ""
node -e "
const sharp=require('sharp'),fs=require('fs');
(async()=>{for(const f of fs.readdirSync('public/video').filter(f=>f.endsWith('-poster.png'))){
  await sharp('public/video/'+f).webp({quality:78}).toFile('public/video/'+f.replace('.png','.webp'));
  fs.unlinkSync('public/video/'+f);
}console.log('posters done')})();
"
echo DONE; ls -lh $OUT
