#FROM node:18-alpine3.18
FROM mcr.microsoft.com/cbl-mariner/base/nodejs:18
#RUN apk add --no-cache libc6-compat
#RUN apk add --no-cache libstdc++ gcompat
#RUN apk add --no-cache onnxruntime
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV production
RUN npm install -g npm@10.5.0
COPY --chown=root:root . /app
WORKDIR /app

RUN npm ci --only=production
RUN npm run build
CMD npm start