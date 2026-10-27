FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=1000:1000 app.js index.js ./

# Ejecuta como usuario sin privilegios de administrador.
USER 1000:1000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Evita depender de docker-entrypoint.sh de la imagen base; ejecuta Node directamente.
ENTRYPOINT ["node"]
CMD ["index.js"]
