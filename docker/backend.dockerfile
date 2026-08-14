FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
    make \
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
    python3.13 \
    python3.13-pip \
    python3.13-devel \
    tar \
    cairo \
    libpng \
    fontconfig \
    nodejs24 \
 && dnf clean all

# AL2023 ships versioned Node packages; nodejs24 provides Node 24.x. The unversioned
# 'nodejs' package is Node 18, which is why the version is pinned in the name above.
# The `node -v` assertion guards a real trap: AL2023 registers every nodejs major in
# `alternatives` at the same priority, so if another nodejs package is ever installed
# alongside this one, /usr/bin/node keeps pointing at whichever was installed first.
# Assert before upgrading npm so a wrong Node fails the build loudly instead of
# silently building the app against the wrong major.
RUN node -v | grep -qE '^v24\.' \
 && npm install -g npm@latest \
 && npm update -g \
 && node -v \
 && npm -v

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

# Install Python packages into python3.13 (the app does not use the base python3.9,
# whose dev packages are dropped above). Running under a current Python clears the
# urllib3 CVEs (on 3.9 botocore caps urllib3<1.27). The app points python-shell at
# this interpreter via PYTHON_BIN below.
ENV PYTHON_BIN=python3.13
# pip is upgraded last: `pip install -U pip` installs the new pip under /usr/local but
# leaves the RPM-owned copy in /usr/lib, so both versions remain on disk. Removing the
# now-superseded RPM keeps only the upgraded pip, which stays fully usable.
RUN python3.13 -m pip install --no-cache-dir -U boto3 botocore urllib3 simplejson numpy scipy patsy pandas statsmodels \
 && python3.13 -m pip install --no-cache-dir -U pip \
 && dnf -y remove python3.13-pip \
 && dnf clean all \
 && python3.13 -m pip --version \
 && test ! -e /usr/lib/python3.13/site-packages/pip \
 && python3.13 -c "import boto3, botocore, urllib3, simplejson, numpy, scipy, patsy, pandas, statsmodels"

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
