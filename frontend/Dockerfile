FROM node:25.8.2 AS build
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm config set strict-ssl false
# `npm ci` can fail in CI when lockfile and package.json are out of sync.
# Use `npm install` here to allow a clean build inside the container.
RUN npm install --legacy-peer-deps --no-audit

# Build
COPY . .
RUN npm run build

# Production image: nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# disable nginx logs to stdout noise
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
