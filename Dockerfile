# Build from source: COPY . . and npm run build ensure the image runs latest code.
FROM node:20-bookworm

WORKDIR /app

# Install dependencies for Puppeteer + Xvfb (virtual display for headed mode)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    xvfb \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libasound2 \
    libatk1.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install Puppeteer Chrome
RUN npx puppeteer browsers install chrome

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user for security
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# So Xvfb can create display socket when running as pptruser (for docker:scrape / scheduler)
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Switch to non-root user
USER pptruser

# Expose port
EXPOSE 8080

# Start the API server
CMD ["npm", "run", "api:start"] 