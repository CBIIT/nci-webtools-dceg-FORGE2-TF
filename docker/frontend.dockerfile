# ---- build stage: compile the React app (build-only deps stay here) ----
FROM public.ecr.aws/amazonlinux/amazonlinux:2022 AS build

RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
    make \
    nodejs \
    npm \
 && dnf clean all

WORKDIR /client

COPY client/package*.json /client/

RUN npm install

COPY client /client/

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
