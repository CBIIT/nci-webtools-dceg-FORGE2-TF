FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
    make \
    nodejs \
    npm \
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
    cairo \
    libpng \
    fontconfig \
 && dnf clean all

# Install R from the Posit RPM. AL2023 does not ship a usable 'R' dnf package, so
# (matching Spatial Power) install R from cdn.posit.co and point CRAN at the Posit
# binary mirror so package installs don't need to compile from source.
ENV R_VER="4.5.3"
ENV PATH="/opt/R/${R_VER}/bin:${PATH}"
RUN ARCH=$(uname -m) \
    && curl -O https://cdn.posit.co/r/rhel-9/pkgs/R-${R_VER}-1-1.${ARCH}.rpm \
    && dnf install -y R-${R_VER}-1-1.${ARCH}.rpm \
    && echo 'options(repos = c(CRAN = sprintf("https://packagemanager.posit.co/cran/latest/bin/linux/rhel9-%s/%s", R.version["arch"], substr(getRversion(), 1, 3))))' \
       >> /opt/R/${R_VER}/lib/R/etc/Rprofile.site \
    && rm -f R-${R_VER}-1-1.${ARCH}.rpm

# Install Python packages. -U pulls patched releases (urllib3, boto3/botocore, etc.)
# to clear known CVEs. pip itself is rpm-managed (no RECORD), so it is not in the -U
# list — upgrading it here fails with "Cannot uninstall pip ... RECORD file not found".
RUN pip3 install -U boto3 botocore urllib3 simplejson numpy scipy patsy pandas statsmodels

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

# install R packages (from the Posit binary mirror configured above)
RUN Rscript -e "Sys.setenv(MAKEFLAGS = '-j2'); install.packages(c('optparse'))"

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
