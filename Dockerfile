FROM node:18-bookworm-slim
WORKDIR /app
COPY web-server.js index.html package.json ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=9090 STATE_FILE=/app/data/state.json
EXPOSE 9090
CMD ["node", "web-server.js"]
