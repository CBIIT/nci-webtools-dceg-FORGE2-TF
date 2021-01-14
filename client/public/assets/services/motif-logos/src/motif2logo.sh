#!/bin/bash

module add ImageMagick

meme=$1

mc=`awk '{if($1 == "MOTIF") print}' $meme | wc -l`

motifs=`awk '{if($1 == "MOTIF") print $2}' $meme`
motif=( $motifs )



for i in {1..146};
do
	convert motif${i}.png -gravity North -draw "text 0,5 '${motif[${i}-1]}' " ${motif[${i}-1]}.png
done

mkdir -p old.pngs
mv motif*.png old.pngs

#convert *.png CTCF_upstream.pdf
