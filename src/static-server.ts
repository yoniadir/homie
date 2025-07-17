import express from 'express';
import path from 'path';

const app = express();
const port = 3001;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the HTML file at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log(`📱 Static server running on http://localhost:${port}`);
  console.log(`🎮 Open your browser to access the API client`);
});
