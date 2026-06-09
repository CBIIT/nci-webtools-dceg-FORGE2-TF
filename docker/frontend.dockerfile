FROM public.ecr.aws/amazonlinux/amazonlinux:2022

RUN dnf -y update \
 && dnf -y install \
    gcc-c++ \
    httpd \
    make \
    nodejs \
    npm \
 && dnf clean all

RUN mkdir /client

WORKDIR /client

COPY client/package*.json /client/

RUN npm install

COPY client /client/

RUN npm run build \
    && mv /client/build /var/www/html/forge2-tf \
    && chmod -R a+rX /var/www/html/forge2-tf

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