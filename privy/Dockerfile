FROM node:22-slim
WORKDIR /app
# root package.json carries the shared deps (web3.js, bs58) so shared/ resolves them
COPY package.json ./
RUN npm install --omit=dev
COPY shared ./shared
COPY relayer ./relayer
RUN cd relayer && npm install --omit=dev
ENV PORT=8080
EXPOSE 8080
CMD ["node", "relayer/server.js"]
