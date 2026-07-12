# Build context is the repo root (see docker-compose.yml) so this stage can
# reach frontend/ to build the static site.
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty by default — config.js falls back to the page's own origin in
# production, which is correct since this same Nginx serves both. Override
# only if the API will live on a different domain than the site.
ARG VITE_BACKEND_URL=
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
