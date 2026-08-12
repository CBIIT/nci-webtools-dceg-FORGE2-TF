# ---- build stage: compile the React app (build-only deps stay here) ----
FROM public.ecr.aws/amazonlinux/amazonlinux:2023 AS build

RUN dnf -y update \
 && dnf -y install gcc-c++ make \
 && dnf clean all

# AL2023's own nodejs package doesn't track current majors, so pull Node 24
# from NodeSource directly to guarantee the version regardless of AL2023's repo state.
# The `node -v` assertion is required: AL2023's dnf.conf sets skip_if_unavailable=True
# and the NodeSource setup script itself doesn't fail loudly if its repo is unreachable,
# so without this check a transient NodeSource outage could silently fall back to
# whatever (wrong) nodejs version AL2023's own repo happens to offer.
RUN curl -fsSL https://rpm.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh \
 && bash /tmp/nodesource_setup.sh \
 && dnf -y install nodejs \
 && dnf clean all \
 && rm -f /tmp/nodesource_setup.sh \
 && node -v | grep -qE '^v24\.' \
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
