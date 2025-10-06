### Frontend-only Dockerfile for static Vite build + serve
# 1️⃣ Build Stage
FROM node:18-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
# Install dependencies
RUN npm install --no-audit --no-fund
COPY . .

# 🔹 Pass backend URL from Railway (VITE_API_BASE)
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

# Build the Vite app
RUN npm run build

# 2️⃣ Runtime Stage
FROM node:18-alpine AS runtime

WORKDIR /app
# Copy build output and minimal runtime files
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

# Install lightweight static server
RUN npm install -g serve@14.1.2 --no-audit --no-fund

EXPOSE 8080
# For Docker deployments on Railway, bind to the fixed container port declared above.
CMD ["sh", "-c", "serve -s dist -l 0.0.0.0:8080"]

