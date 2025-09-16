### Frontend-only Dockerfile for static build + nginx
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
# Install serve globally in runtime image so the container can run without network access
RUN npm install -g serve@14.1.2 --no-audit --no-fund
EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "$PORT"]
