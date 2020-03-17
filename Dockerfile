# Making the file based on the node base file
FROM node:current-slim

# Setting the working directory
WORKDIR /usr/share/scrum-master-bot/

# Copying the package.json
COPY package.json .

# Installing all dependencies
RUN npm install

# Copying all files
COPY . .

# Exposing the port 8080
EXPOSE 8080

# Defining how to run this project
CMD ["npm", "start"]

