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
# Ensure 'serve' is available; using npx at runtime works without adding to image dependencies.
EXPOSE 80
CMD ["sh", "-c", "npx serve -s dist -l $PORT"]
