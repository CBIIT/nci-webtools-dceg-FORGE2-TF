FROM public.ecr.aws/amazonlinux/amazonlinux:2022

RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
    make \
    nodejs \
    npm \
    R \
    bzip2 \
    bzip2-devel \
    libcurl-devel \
    openssl-devel \
    zlib-devel \
    xz-devel \
    git \
    gcc \
    libffi-devel \    
    sqlite \
    sqlite-devel \
    python3 \
    python3-devel \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    tar \
 && dnf clean all

# Upgrade the globally-installed npm so its bundled deps (tar, minimatch,
# brace-expansion, etc.) pick up security fixes from the dnf-provided npm.
RUN npm install -g npm@latest

# Install latest version of SQLite
# RUN curl https://www.sqlite.org/2021/sqlite-autoconf-3350500.tar.gz -o /tmp/sqlite-autoconf-3350500.tar.gz \
#    && cd /tmp \
#    && tar xvfz sqlite-autoconf-3350500.tar.gz \
#    && cd sqlite-autoconf-3350500 \
#    && LD_RUN_PATH=/usr/local/lib ./configure \
#    && make && make install 

# # Install Python 
# RUN curl https://www.python.org/ftp/python/3.6.8/Python-3.6.8.tgz -o /tmp/Python-3.6.8.tgz \
#    && cd /tmp \
#    && tar xvfz Python-3.6.8.tgz \
#    && cd Python-3.6.8 \
#    && LD_RUN_PATH=/usr/local/lib  ./configure --prefix=/usr --enable-optimizations \
#    && LD_RUN_PATH=/usr/local/lib make \
#    && LD_RUN_PATH=/usr/local/lib make install

# Install Python packages
# -U pulls patched releases (urllib3, pip, boto3/botocore) to clear known CVEs.
RUN pip3 install -U pip boto3 botocore urllib3 simplejson numpy scipy patsy pandas statsmodels

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

ARG DATA_FOLDER=/deploy/data
ARG TMP_FOLDER=/deploy/data/tmp
RUN mkdir -p /deploy/server "$DATA_FOLDER" "$TMP_FOLDER"

WORKDIR /deploy/server

# use build cache for npm packages
COPY server/package*.json /deploy/server/

RUN npm install

# copy the rest of the application
COPY . /deploy/

COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint.sh
RUN chmod +x /usr/local/bin/backend-entrypoint.sh

EXPOSE 8000

CMD ["/usr/local/bin/backend-entrypoint.sh"]
