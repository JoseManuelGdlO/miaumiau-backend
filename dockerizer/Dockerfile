# Base image
FROM node:20

# Create app directory
WORKDIR /app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

# Start the server using the production build
CMD [ "node", "src/app.js" ]

# Exposing server port
EXPOSE 3000

