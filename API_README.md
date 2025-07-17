# Homie API Server

A REST API server for the Homie real estate scraper, built with Express.js and TypeScript.

## Features

- **Job-based scraping**: Submit scraping jobs and track their progress
- **Real-time status updates**: Monitor scraping progress in real-time
- **Database integration**: Results are saved to MySQL database
- **Export functionality**: Export scraped data to CSV files
- **Health monitoring**: Server health and performance metrics

## Quick Start

### Local Development

```bash
# Start the API server
npm run api:dev

# OR start the built version
npm run build && npm run api:start
```

- **API Server**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001

### Test the API

```bash
# Check server status
curl http://localhost:3001/

# Health check
curl http://localhost:3001/health
```

## API Endpoints

### 1. Start Scraping Job

```bash
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520",
    "enhanced": true,
    "saveToDatabase": true,
    "exportToCsv": true
  }'
```

**Response:**
```json
{
  "message": "Scraping job started",
  "jobId": "job_1704123456789_abc123",
  "status": "pending"
}
```

### 2. Get Job Status

```bash
curl http://localhost:3001/scrape/job_1704123456789_abc123
```

**Response:**
```json
{
  "id": "job_1704123456789_abc123",
  "status": "running",
  "progress": "Scraping page 1 of 2..."
}
```

### 3. Get All Jobs

```bash
curl http://localhost:3001/scrape
```

### 4. Database Statistics

```bash
curl http://localhost:3001/stats
```

### 5. Get Properties

```bash
curl http://localhost:3001/properties
```

### 6. Export Data

```bash
curl -X POST http://localhost:3001/export
```

### 7. Delete Job

```bash
curl -X DELETE http://localhost:3001/jobs/job_1704123456789_abc123
```

### 8. Delete All Jobs

```bash
curl -X DELETE http://localhost:3001/jobs
```

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function startScraping() {
  try {
    const response = await axios.post('http://localhost:3001/scrape', {
      url: 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520',
      enhanced: true,
      saveToDatabase: true,
      exportToCsv: true
    });
    
    const jobId = response.data.jobId;
    console.log('Job started:', jobId);
    
    // Check status
    const statusResponse = await axios.get(`http://localhost:3001/scrape/${jobId}`);
    console.log('Status:', statusResponse.data.status);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

startScraping();
```

### Python

```python
import requests
import json
import time

def start_scraping():
    url = "http://localhost:3001/scrape"
    data = {
        "url": "https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520",
        "enhanced": True,
        "saveToDatabase": True,
        "exportToCsv": True
    }
    
    response = requests.post(url, json=data)
    job_id = response.json()["jobId"]
    print(f"Job started: {job_id}")
    
    # Check status
    status_response = requests.get(f'http://localhost:3001/scrape/{job_id}')
    print(f"Status: {status_response.json()['status']}")

start_scraping()
```

### Bash Script

```bash
#!/bin/bash

# Start scraping job
JOB_RESPONSE=$(curl -s -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520",
    "enhanced": true,
    "saveToDatabase": true,
    "exportToCsv": true
  }')

JOB_ID=$(echo $JOB_RESPONSE | jq -r '.jobId')
echo "Job started: $JOB_ID"

# Check status
STATUS_RESPONSE=$(curl -s http://localhost:3001/scrape/$JOB_ID)
echo "Status: $(echo $STATUS_RESPONSE | jq -r '.status')"
```

## Docker Setup

### Environment Variables

```env
NODE_ENV=production
DOCKER_ENV=true
PORT=8080
DB_HOST=mysql
DB_PORT=3306
DB_USER=homie_user
DB_PASSWORD=homie_pass
DB_NAME=homie_db
```

### Using Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:8080"
    environment:
      - NODE_ENV=production
      - DOCKER_ENV=true
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=homie_user
      - DB_PASSWORD=homie_pass
      - DB_NAME=homie_db
    depends_on:
      - mysql
    
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: homie_db
      MYSQL_USER: homie_user
      MYSQL_PASSWORD: homie_pass
    ports:
      - "3306:3306"
```

### Commands

```bash
# Build and start
docker-compose up -d --build

# Test the API
curl http://localhost:3001/health

# View logs
curl http://localhost:3001/stats
```

## Configuration

### Port Configuration

The API server runs on port 3001 externally (host port) but port 8080 internally (container port). You can change this by:

1. **Environment Variable**: `PORT=8080` (internal container port)
2. **Docker**: Update the port mapping in `docker-compose.yml` (external:internal)
3. **Code**: Modify `src/api-server.ts`

### Database Configuration

The server connects to MySQL with these default settings:
- Host: `localhost` (or `mysql` in Docker)
- Port: `3306`
- Database: `homie_db`
- User: `homie_user`
- Password: `homie_pass`

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": {...}
}
```

## Job Status Types

- `pending`: Job is queued
- `running`: Job is currently executing
- `completed`: Job finished successfully
- `failed`: Job encountered an error

## Troubleshooting

### Common Issues

1. **Port already in use**
   - Change the port in `docker-compose.yml` or set `PORT` environment variable

2. **Database connection failed**
   - Ensure MySQL is running and accessible
   - Check database credentials in environment variables

3. **Bot protection detected**
   - The scraper may be detected by anti-bot systems
   - Try running in non-headless mode or from a different IP

### Error Messages

- `Failed to launch the browser process`: Puppeteer/Chrome installation issue
- `Bot protection detected`: Website is blocking the scraper
- `Database connection failed`: MySQL connection issue

## Development

### Project Structure

```
src/
├── api-server.ts          # Main API server
├── services/
│   ├── enhanced-puppeteer-scraper.service.ts
│   ├── database.service.ts
│   └── csv-export.service.ts
└── interfaces/
    └── property.interface.ts
```

### Adding New Endpoints

1. Add the route in `src/api-server.ts`
2. Implement the service logic
3. Update this documentation
4. Add tests if needed

### Testing

```bash
# Test the API endpoints
npm run api:test

# Test individual components
npm run test:enhanced
npm run test:database
``` 