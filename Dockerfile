# Use official Node.js 16 on Debian Bullseye
FROM node:16.20.2-bullseye-slim

# Set working directory
WORKDIR /usr/src/app

# Copy server package metadata and install dependencies
COPY server/package*.json ./
RUN npm install

# Install Python and analytics dependencies
RUN apt-get update \
    && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Copy analytics scripts and requirements from repo root
COPY analytics ./analytics
RUN python3 -m pip install --upgrade pip setuptools wheel \
    && python3 -m pip install --no-cache-dir -r analytics/requirements.txt

ENV PYTHON_PATH=/usr/bin/python3
ENV ANALYTICS_PATH=/usr/src/app/analytics
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Copy the rest of the server code
COPY server/. .

# Expose port 3000 for the server
EXPOSE 3000

# Default command to start the application
CMD ["npm", "start"]
