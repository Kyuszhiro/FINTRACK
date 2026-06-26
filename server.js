// Backend server for Finance Tracker
// Run with: node server.js
// Uses: PostgreSQL (Supabase)

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool - uses Supabase connection string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Supabase
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize database tables
async function initDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);

        // Create entries table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS entries (
                id SERIAL PRIMARY KEY,
                entry_id VARCHAR(255) UNIQUE NOT NULL,
                type VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                category VARCHAR(255),
                description TEXT,
                date VARCHAR(50),
                timestamp BIGINT
            )
        `);

        // Insert default user if not exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            ['Kurth']
        );

        if (userExists.rows.length === 0) {
            await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2)',
                ['Kurth', 'Einzbern']
            );
            console.log('Default user created');
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error.message);
    }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        
        const user = result.rows[0];
        
        if (user) {
            const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
            res.json({ success: true, token, username: user.username, message: "Login successful" });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get all entries
app.get('/api/entries', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM entries ORDER BY timestamp DESC');
        res.json({ success: true, entries: result.rows });
    } catch (error) {
        console.error('Get entries error:', error);
        res.status(500).json({ success: false, message: "Error reading entries" });
    }
});

// Add new entry
app.post('/api/entries', async (req, res) => {
    try {
        const { type, amount, category, description, date } = req.body;
        
        const entryId = Date.now().toString();
        
        await pool.query(
            `INSERT INTO entries (entry_id, type, amount, category, description, date, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [entryId, type, parseFloat(amount), category, description || "", date, Date.now()]
        );
        
        const newEntry = {
            entry_id: entryId,
            type,
            amount: parseFloat(amount),
            category,
            description: description || "",
            date,
            timestamp: Date.now()
        };
        
        res.json({ success: true, entry: newEntry, message: "Entry added successfully" });
    } catch (error) {
        console.error('Add entry error:', error);
        res.status(500).json({ success: false, message: "Error adding entry" });
    }
});

// Update entry
app.put('/api/entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, category, description, date } = req.body;
        
        const result = await pool.query(
            `UPDATE entries 
             SET type = $1, amount = $2, category = $3, description = $4, date = $5
             WHERE entry_id = $6
             RETURNING *`,
            [type, parseFloat(amount), category, description || "", date, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Entry not found" });
        }
        
        res.json({ success: true, entry: result.rows[0], message: "Entry updated successfully" });
    } catch (error) {
        console.error('Update entry error:', error);
        res.status(500).json({ success: false, message: "Error updating entry" });
    }
});

// Delete entry
app.delete('/api/entries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM entries WHERE entry_id = $1 RETURNING *',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Entry not found" });
        }
        
        res.json({ success: true, message: "Entry deleted successfully" });
    } catch (error) {
        console.error('Delete entry error:', error);
        res.status(500).json({ success: false, message: "Error deleting entry" });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});

// Initialize and start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Dashboard at http://localhost:${PORT}/dashboard`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
