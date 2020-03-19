# Making the file based on the node base file
FROM node:current-slim

# Setting the working directory
WORKDIR /usr/share/scrum-master-bot/

# Copying the package.json
COPY package.json .

# Installing all dependencies
RUN npm install

# Exposing the port 8080
EXPOSE 8080

# Changing the environment
ENV NODE_ENV=production

# Defining how to run this project
CMD ["npm", "start"]

# Copying all files
COPY . .

# Making the wait for it script as an executable 
RUN chmod +x ./wait-for-it/wait-for-it.sh
