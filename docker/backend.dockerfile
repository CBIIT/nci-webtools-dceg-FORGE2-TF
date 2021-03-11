
FROM centos:8.3.2011

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
      bzip2 \
      bzip2-devel \
      libcurl-devel \
      openssl-devel \
      zlib-devel \
      xz-devel \
      git \
   && dnf clean all

# Install Python packages
RUN pip3 install boto3

# Download and install htslib-1.11 (tabix)
RUN cd /tmp \
   && curl -L https://github.com/samtools/htslib/releases/download/1.11/htslib-1.11.tar.bz2 | tar xj \
   && cd htslib-1.11 \
   && ./configure --enable-libcurl --prefix=/tmp/htslib-1.11 \
   && make && make install \
   && cd ./bin && mv * /usr/local/bin

# Download and install pts_lbsearch
RUN cd /tmp \
   && git clone https://github.com/pts/pts-line-bisect.git \
   && cd pts-line-bisect \
   && gcc -s -O3 -Wall pts_lbsearch.c -o pts_lbsearch \
   && mv pts_lbsearch /usr/local/bin

RUN mkdir -p /deploy/server /deploy/logs

WORKDIR /deploy/server

# use build cache for npm packages
COPY server/package*.json /deploy/server/

RUN npm install

# copy the rest of the application
COPY . /deploy/

CMD npm start
