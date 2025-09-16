### Frontend-only Dockerfile for static build + nginx
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Use `npm install` in the Docker build to avoid `npm ci` failing if lockfile differs in remote
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
# copy package.json so runtime commands like `npm start` can read scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
# Install serve globally in runtime image so the container can run without network access
RUN npm install -g serve@14.1.2 --no-audit --no-fund
EXPOSE 8080
# Use a fallback port (8080) if $PORT is empty; POSIX shell parameter expansion provides the default
CMD ["sh", "-c", "serve -s dist -l 0.0.0.0:${PORT:-8080}"]
