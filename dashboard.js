const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const settingsFile = path.join(__dirname, 'settings.json');
const dmsFile = path.join(__dirname, 'dms.json');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Main settings API
app.get('/api/settings', (req, res) => {
    fs.readFile(settingsFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading settings file:', err);
            return res.status(500).json({ error: 'Failed to read settings.' });
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/settings', (req, res) => {
    const newSettings = req.body;
    fs.writeFile(settingsFile, JSON.stringify(newSettings, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing settings file:', err);
            return res.status(500).json({ error: 'Failed to save settings.' });
        }
        console.log("Settings updated successfully.");
        res.json({ success: true, message: "Settings updated successfully." });
    });
});

// DM log API
app.get('/api/dms', (req, res) => {
    fs.readFile(dmsFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading DM log file:', err);
            return res.status(500).json({ error: 'Failed to read DM log.' });
        }
        res.json(JSON.parse(data));
    });
});

app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
});