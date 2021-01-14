#!/bin/bash
module add ImageMagick


for i in {1..146}
do
    /home/ehaugen/meme/bin/ceqlogo -i /home/nasi4/proj/motif-logos/memes/jaspar-CORE.vertebrate-1.meme -m $i -f EPS -o motif${i}.eps
done


mogrify -format png *.eps
