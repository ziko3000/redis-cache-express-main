import express from 'express';
import fs from 'fs';
import { createClient } from 'redis';

const app = express();
const PORT = 3000;

const client = createClient();

(async () => {
  await client.connect();
})();
client.on('connect', function() {
  console.log('Redis client is connected!'); // Connected!
});
client.on('ready', () => {
  console.log('Redis client is ready');
});
client.on('error', (err) => {
  console.error('Redis error:', err);
});

// Middleware to read JSON files
const readJSONFile = (filename) => {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
};

const cacheMiddleware = (topic, idKeyExtractor) => {
  return (req, res, next) => {
    try {
      const id = idKeyExtractor(req);
      const cacheKey = `${topic}:${id}`;
      console.log(`Cache key: ${cacheKey}`);
      client.get(cacheKey).then((data) => {
        console.log(`Data: ${data}`);
        if (data !== null) {
          res.send(JSON.parse(data));
        } else {
          next();
        }
      });
    } catch (error) {
      console.error('Cached Middleware Error:', error);
      res.status(500).send('Internal Server Error');
    }
  }; 
};

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error'); 
})

/*
 * http://localhost:3000/v1/structure?projectId=b8g7h2&locationType=building
 */
app.get('/v1/structure', cacheMiddleware('Buildings', req => {
    return `${req.query.projectId}`; 
  }), async (req, res) => {
  try {
    const { projectId, locationType } = req.query;
    if (locationType === 'building') {
        const buildings = readJSONFile('./buildings.json').buildings;
        const building = buildings.find(b => b.id === projectId);
        if (building) {
          const cacheKey = `Buildings:${req.query.projectId}`;
          client.setEx(cacheKey, 36, JSON.stringify(building)); // TTL set to 1 hour (3600 seconds) as an example
          return res.json(building);
        }
        return res.status(404).json({ error: 'Building not found' });
    }
    res.status(400).json({ error: 'Invalid location type' });
  } catch (error) {
    console.error('Structure Endpoint Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/v2/Checklists', (req, res) => {
    const { projectId } = req.query;
    const checklists = readJSONFile('./checklists.json').checklists;
    const checklist = checklists.find(c => c.id === projectId);
    if (checklist) {
        return res.json(checklist);
    }
    return res.status(404).json({ error: 'Checklist not found' });
});

app.get('/v1/project/:projectId', (req, res) => {
    const fields = req.query.fields ? JSON.parse(req.query.fields) : [];
    if (fields.includes('members')) {
        const members = readJSONFile('./members.json').members;
        const member = members.find(m => m.id === req.params.projectId);
        if (member) {
            return res.json(member);
        }
        return res.status(404).json({ error: 'Member not found' });
    }
    res.status(400).json({ error: 'Invalid field' });
});

app.get('/v1/configurations', (req, res) => {
    const { projectId } = req.query;
    const configurations = readJSONFile('./configurations.json').configurations;
    // Assuming configurations are structured by projectId
    const config = configurations[projectId];
    if (config) {
        return res.json(config);
    }
    return res.status(404).json({ error: 'Configuration not found' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
