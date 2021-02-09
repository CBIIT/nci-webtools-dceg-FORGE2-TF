# Stage 0 - Build Client
FROM node:latest

COPY client/ /client

WORKDIR /client

RUN npm install \
    && npm run build

# Stage 1 - Copy static assets
FROM centos:latest

RUN dnf -y update \
    && dnf -y install httpd \
    && dnf clean all

# Add custom httpd configuration
COPY docker/forge2-tf.conf /etc/httpd/conf.d/forge2-tf.conf

COPY --chown=apache:apache --from=0 /client/build /var/www/html/forge2-tf

WORKDIR /var/www/html

RUN touch index.html && chown apache:apache index.html

EXPOSE 80
EXPOSE 443

CMD rm -rf /run/httpd/* /tmp/httpd* \
    && exec /usr/sbin/apachectl -DFOREGROUND