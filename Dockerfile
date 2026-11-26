FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (including sqlite3)
COPY package.json .
RUN npm install --production

# Bundle app source
COPY src/ ./src/
COPY data/ ./data/

# Expose the port the app runs on
EXPOSE 8080

# Start the app
CMD ["node", "src/app.js"]

