# ---- build stage: compile the React app (build-only deps stay here) ----
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS build

RUN dnf -y update \
 && dnf -y install gcc-c++ make nodejs24 \
 && dnf clean all

# AL2023 ships versioned Node packages; nodejs24 provides Node 24.x. The unversioned
# 'nodejs' package is Node 18, which is why the version is pinned in the name above.
# The `node -v` assertion guards a real trap: AL2023 registers every nodejs major in
# `alternatives` at the same priority, so if another nodejs package is ever installed
# alongside this one, /usr/bin/node keeps pointing at whichever was installed first.
# npm is upgraded here only to keep the build toolchain current and symmetric with
# backend.dockerfile — unlike the backend, npm never reaches the runtime stage below,
# so this has no effect on the shipped image's CVE surface.
RUN node -v | grep -qE '^v24\.' \
 && npm install -g npm@latest \
 && npm update -g \
 && node -v \
 && npm -v

WORKDIR /client

COPY client/package*.json /client/

RUN npm install

COPY client /client/

# GA4 Measurement ID, injected by the deploy pipeline from SSM (prod only).
# Baked into the static build via CRA's %REACT_APP_GTAG% substitution; empty/unset
# leaves analytics disabled (see client/public/index.html).
ARG REACT_APP_GTAG
ENV REACT_APP_GTAG=${REACT_APP_GTAG}

RUN npm run build

# ---- runtime stage: httpd serving the static build only (no node_modules/npm) ----
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

RUN dnf -y update \
 && dnf -y install httpd \
 && dnf clean all

# Copy only the compiled static assets — build tooling never reaches the runtime image,
# which removes every build-time npm CVE (rollup, webpack, babel, etc.) from the shipped image.
COPY --from=build /client/build /var/www/html/forge2-tf
RUN chmod -R a+rX /var/www/html/forge2-tf

# Add custom httpd configuration
COPY docker/httpd-forge2-tf.conf /etc/httpd/conf.d/httpd-forge2-tf.conf

WORKDIR /var/www/html

# In the single-task Fargate topology the backend runs as a sibling container in
# the same task, reachable over the shared network namespace at localhost:8000.
# The task definition may override API_HOST; this is the default.
ENV API_HOST=http://localhost:8000

EXPOSE 80
EXPOSE 443

CMD rm -rf /run/httpd/* /tmp/httpd* \
 && exec /usr/sbin/httpd -DFOREGROUND
