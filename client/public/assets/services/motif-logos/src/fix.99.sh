#!/bin/bash

b=`echo nsites= 1`
cat transfac.human.meme.old | sed  "s/nsites= 0.999/'$b'/g" - | sed  "s/nsites= 0.99/'$b'/g" - > transfac.human.meme.rounded
