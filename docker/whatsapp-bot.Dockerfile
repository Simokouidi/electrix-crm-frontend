FROM node:18-slim
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

COPY scripts ./scripts

ENV PORT=3002
EXPOSE 3002

CMD ["node", "./scripts/whatsapp-bot.js"]
