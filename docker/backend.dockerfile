ARG BASE_IMAGE=forge2-tf:base

FROM ${BASE_IMAGE}

COPY server/ /deploy/server

WORKDIR /deploy/server

RUN npm install

CMD npm start