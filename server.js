const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// --- API Endpoints ---

// 1. Entries
app.get('/api/entries', (req, res) => {
    db.all('SELECT * FROM entries ORDER BY date DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse details JSON string back to object
        const entries = rows.map(r => ({
            ...r,
            details: r.details ? JSON.parse(r.details) : {}
        }));
        res.json(entries);
    });
});

app.post('/api/entries', (req, res) => {
    const { date, description, category, income, expense, capital, withdrawal, net, details } = req.body;
    const detailsStr = details ? JSON.stringify(details) : '{}';

    // Check if entry for this date already exists for updating
    db.get('SELECT id FROM entries WHERE date = ?', [date], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Update
            const query = `UPDATE entries SET 
                description = ?, category = ?, income = ?, expense = ?, 
                capital = ?, withdrawal = ?, net = ?, details = ? 
                WHERE date = ?`;
            db.run(query, [description, category, income, expense, capital, withdrawal, net, detailsStr, date], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Entry updated successfully', id: row.id });
            });
        } else {
            // Insert
            const query = `INSERT INTO entries (date, description, category, income, expense, capital, withdrawal, net, details)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            db.run(query, [date, description, category, income, expense, capital, withdrawal, net, detailsStr], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Entry saved successfully', id: this.lastID });
            });
        }
    });
});

app.delete('/api/entries/:date', (req, res) => {
    db.run('DELETE FROM entries WHERE date = ?', [req.params.date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Entry deleted successfully', changes: this.changes });
    });
});

// 2. Credits
app.get('/api/credits', (req, res) => {
    db.all('SELECT * FROM credits ORDER BY date DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/credits', (req, res) => {
    const { customerId, amount, paid, date, description } = req.body;
    const query = `INSERT INTO credits (customerId, amount, paid, date, description) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [customerId, amount, paid, date, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Credit record saved successfully', id: this.lastID });
    });
});

app.delete('/api/credits/:id', (req, res) => {
    db.run('DELETE FROM credits WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Credit record deleted successfully', changes: this.changes });
    });
});

// Update/Update multiple credits (bulk update)
app.put('/api/credits', (req, res) => {
    const credits = req.body;
    if (!Array.isArray(credits)) return res.status(400).json({ error: 'Expected an array of credits' });

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare('UPDATE credits SET paid = ? WHERE id = ?');
        credits.forEach(c => {
            stmt.run(c.paid, c.id);
        });
        stmt.finalize();
        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Credits updated successfully' });
        });
    });
});

// 3. Customers
app.get('/api/customers', (req, res) => {
    db.all('SELECT * FROM customers ORDER BY name ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/customers', (req, res) => {
    const { name, phone, address } = req.body;
    const query = `INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`;
    db.run(query, [name, phone, address], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Customer added successfully', id: this.lastID });
    });
});

app.delete('/api/customers/:id', (req, res) => {
    const customerId = req.params.id;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM credits WHERE customerId = ?', [customerId]);
        db.run('DELETE FROM customers WHERE id = ?', [customerId], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Customer and related credits deleted successfully' });
            });
        });
    });
});

// Wipe All Data
app.delete('/api/all', (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM entries');
        db.run('DELETE FROM credits');
        db.run('DELETE FROM customers', function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'All data wiped successfully' });
            });
        });
    });
});

// Bulk Import Data
app.post('/api/bulk', (req, res) => {
    const { entries, credits, customers } = req.body;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Clear existing data (optional, but usually preferred for a full restore)
        db.run('DELETE FROM entries');
        db.run('DELETE FROM credits');
        db.run('DELETE FROM customers');

        if (Array.isArray(entries)) {
            const stmt = db.prepare('INSERT INTO entries (id, date, description, category, income, expense, net, capital, withdrawal, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            entries.forEach(e => {
                stmt.run(e.id, e.date, e.description, e.category, e.income, e.expense, e.net, e.capital, e.withdrawal, JSON.stringify(e.details));
            });
            stmt.finalize();
        }

        if (Array.isArray(credits)) {
            const stmt = db.prepare('INSERT INTO credits (id, customerId, amount, paid, date, note) VALUES (?, ?, ?, ?, ?, ?)');
            credits.forEach(c => {
                stmt.run(c.id, c.customerId, c.amount, c.paid, c.date, c.note || c.description);
            });
            stmt.finalize();
        }

        if (Array.isArray(customers)) {
            const stmt = db.prepare('INSERT INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)');
            customers.forEach(c => {
                stmt.run(c.id, c.name, c.phone, c.address);
            });
            stmt.finalize();
        }

        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Data imported successfully' });
        });
    });
});

// Root endpoint redirect to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
