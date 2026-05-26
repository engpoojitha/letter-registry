FROM node:22-alpine

WORKDIR /app
COPY apps/backend/package.json ./
COPY apps/backend/server.mjs ./

ENV PORT=3003
ENV DATA_FILE=/data/data.json
EXPOSE 3003

CMD ["node", "server.mjs"]
