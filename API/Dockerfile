FROM node:17-alpine

RUN npm install -g nodemon

# Set the working directory in the container
WORKDIR /testtaker/src/api

# Install app dependencies
# Copy package.json and package-lock.json to the container
# This allows us to install dependencies before copying the rest of the application code
COPY package.json package-lock.json ./

# Install production dependencies only
# This is important to avoid installing devDependencies in production
# RUN npm install --production
RUN npm install

COPY ./ ./

# Expose the port the app runs on
EXPOSE 3002

CMD [ "npm", "run" , "dev" ]