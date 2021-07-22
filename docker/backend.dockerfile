
FROM ncidockerhub.nci.nih.gov/docker-linux-poc/centos-base-image:1.0

RUN dnf -y update \
   && dnf -y install \
      dnf-plugins-core \
      epel-release \
      glibc-langpack-en \
   && dnf config-manager --set-enabled powertools \
   && dnf -y module enable nodejs:14 \
   && dnf -y install \
      gcc-c++ \
      make \
      nodejs \
      R \
      # python3 \
      bzip2 \
      bzip2-devel \
      libcurl-devel \
      openssl-devel \
      zlib-devel \
      xz-devel \
      git \
      gcc \
      libffi-devel \
   && dnf clean all

# Install latest version of SQLite
RUN curl https://www.sqlite.org/2021/sqlite-autoconf-3350500.tar.gz -o /tmp/sqlite-autoconf-3350500.tar.gz \
   && cd /tmp \
   && tar xvfz sqlite-autoconf-3350500.tar.gz \
   && cd sqlite-autoconf-3350500 \
   && LD_RUN_PATH=/usr/local/lib ./configure \
   && make && make install 

# Install Python 
RUN curl https://www.python.org/ftp/python/3.6.8/Python-3.6.8.tgz -o /tmp/Python-3.6.8.tgz \
   && cd /tmp \
   && tar xvfz Python-3.6.8.tgz \
   && cd Python-3.6.8 \
   && LD_RUN_PATH=/usr/local/lib  ./configure --prefix=/usr --enable-optimizations \
   && LD_RUN_PATH=/usr/local/lib make \
   && LD_RUN_PATH=/usr/local/lib make install

# Install Python packages
RUN pip3 install boto3 simplejson numpy scipy patsy pandas statsmodels

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

# install R packages
RUN Rscript -e "Sys.setenv(MAKEFLAGS = '-j2'); install.packages(c('optparse'), repos='https://cloud.r-project.org/')"

RUN mkdir -p /deploy/server /deploy/logs

WORKDIR /deploy/server

# use build cache for npm packages
COPY server/package*.json /deploy/server/

RUN npm install

# copy the rest of the application
COPY . /deploy/

CMD npm start
