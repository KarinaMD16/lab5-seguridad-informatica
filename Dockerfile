# UNA Chat en Docker (parte 3 del laboratorio)
# Imagen oficial de Node.js 24 (la misma version mayor que usa Render)
FROM node:24-alpine

WORKDIR /app

# instalar solo dependencias de produccion, segun package-lock.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# copiar el codigo de la aplicacion (.dockerignore excluye .env y pruebas)
COPY . .

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000

# usuario sin privilegios
USER node

# comando de inicio definido en package.json
CMD ["npm", "start"]
