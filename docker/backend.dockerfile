FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# spal-release enables the AL2023 SPAL (Semi-Permanent Additional Libraries) repo,
# which carries htslib. The repo has to be enabled before htslib-tools can resolve,
# hence the second dnf install.
RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
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
    spal-release \
 && dnf -y install htslib-tools \
 && dnf clean all

# htslib-tools provides tabix (used by the query scripts, including `tabix -D` reads
# from S3) as a distro package instead of a source build. The `tabix` call below
# fails the build if the S3/HTTPS hfile plugins are missing (it would say
# "Protocol not supported"); with the plugins present it reports a credentials error.
RUN tabix --version | head -1 \
 && ! tabix -D s3://example-bucket/x.gz chr1:1-2 2>&1 | grep -q 'Protocol not supported'

# AL2023 ships versioned Node packages; nodejs24 provides Node 24.x. The unversioned
# 'nodejs' package is Node 18, which is why the version is pinned in the name above.
# The `node -v` assertion guards a real trap: AL2023 registers every nodejs major in
# `alternatives` at the same priority, so if another nodejs package is ever installed
# alongside this one, /usr/bin/node keeps pointing at whichever was installed first.
# npm is only used below to install the server's dependencies and is removed from the
# runtime image afterwards (see "remove npm"), so it is not upgraded here: the RPM's
# bundled npm is enough for `npm ci`, and upgrading it would just re-download a copy
# that gets deleted anyway.
RUN node -v | grep -qE '^v24\.' \
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
    && rm -f R-${R_VER}-1-1.${ARCH}.rpm \
    && dnf clean all

# Install Python packages into python3.13 (the app does not use the base python3.9,
# whose dev packages are dropped above). Running under a current Python clears the
# urllib3 CVEs (on 3.9 botocore caps urllib3<1.27). The app points python-shell at
# this interpreter via PYTHON_BIN below.
ENV PYTHON_BIN=python3.13
# pip is upgraded first: the python3.13-pip RPM pins an old pip (24.2) that image
# scanners flag; the packages themselves are installed with the current pip.
# --no-cache-dir keeps pip's download cache (~89 MB) out of the shipped image; it is
# only useful for repeat installs during the build, and each package is installed once.
# pip is then removed: nothing installs packages at runtime, and pip vendors its own
# copies of urllib3, setuptools and msgpack (pip/_vendor/vendor.txt) that image
# scanners report against the image even though the app never imports them.
RUN python3.13 -m pip install --no-cache-dir -U pip \
 && python3.13 -m pip install --no-cache-dir -U boto3 botocore urllib3 simplejson numpy scipy patsy pandas statsmodels \
 && python3.13 -m pip uninstall -y pip \
 && rm -rf /usr/lib/python3.13/site-packages/pip* \
           /usr/local/lib/python3.13/site-packages/pip* \
           /usr/lib/python3.13/ensurepip \
           /usr/bin/pip3.13 /usr/bin/pip-3.13 \
 && python3.13 -c "import boto3, numpy, scipy, pandas, statsmodels, simplejson" \
 && ! python3.13 -m pip --version 2>/dev/null

# Download and install pts_lbsearch
WORKDIR /tmp/pts-build
RUN git clone https://github.com/pts/pts-line-bisect.git \
   && gcc -s -O3 -Wall pts-line-bisect/pts_lbsearch.c -o /usr/local/bin/pts_lbsearch \
   && rm -rf /tmp/pts-build

# install R packages (from the Posit binary mirror configured above)
RUN Rscript -e "Sys.setenv(MAKEFLAGS = '-j2'); install.packages(c('optparse'))"

ARG DATA_FOLDER=/deploy/data
ARG TMP_FOLDER=/deploy/data/tmp
RUN mkdir -p /deploy/server "$DATA_FOLDER" "$TMP_FOLDER"

WORKDIR /deploy/server

# use build cache for npm packages
COPY server/package*.json /deploy/server/

# `npm ci` installs exactly what server/package-lock.json records, so the image
# matches the scanned lockfile instead of re-resolving semver ranges on every build.
RUN npm ci --omit=dev --ignore-scripts

# remove npm from the runtime image. The server starts with `node app.js` (see
# backend-entrypoint.sh) and never needs npm at runtime, but npm ships its own
# node_modules tree under /usr/lib/nodejs24 (undici, ip-address, brace-expansion,
# tar, ...) that no lockfile in this repo controls and that image scanners flag.
# Deleting it removes that whole class of finding.
RUN rm -rf /usr/lib/nodejs24/lib/node_modules/npm \
           /usr/lib/node_modules/npm \
           /usr/bin/npm /usr/bin/npx /usr/bin/npm-24 /usr/bin/npx-24 \
           /etc/alternatives/npm /etc/alternatives/npx \
 && ! command -v npm

# copy the rest of the application
COPY . /deploy/

COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint.sh
RUN chmod +x /usr/local/bin/backend-entrypoint.sh

# Run as a non-root user. uid/gid 1000 match the POSIX identity the EFS access
# points are created with (POSIX_UID / POSIX_GID in infrastructure/cdk.env), so the
# data and motif-logos mounts stay readable/writable on Fargate. The entrypoint
# writes config.json into /deploy/server and creates the tmp/data folders, so the
# app user owns /deploy.
RUN groupadd -g 1000 app && useradd -u 1000 -g 1000 -m -s /sbin/nologin app \
 && chown -R app:app /deploy
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://localhost:${SERVER_PORT:-8000}/api/ping" || exit 1

CMD ["/usr/local/bin/backend-entrypoint.sh"]
