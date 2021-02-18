# START BASE IMAGE

FROM centos:latest

RUN dnf -y update \
   && dnf -y install \
      dnf-plugins-core \
      epel-release \
      glibc-langpack-en \
   && dnf -y module enable nodejs:14 \
   && dnf -y install \
      gcc-c++ \
      make \
      nodejs \
      python3 \
   && dnf clean all

# END BASE IMAGE

COPY server/ /deploy/server

WORKDIR /deploy/server

RUN npm install

CMD npm start