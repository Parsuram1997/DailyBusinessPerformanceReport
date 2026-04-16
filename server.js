const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');
const sharp = require('sharp');
const { writePsdBuffer } = require('ag-psd');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

// --- Image Compression Endpoint ---
app.post('/api/compress-image', async (req, res) => {
    try {
        const { imageBase64, width, height, maintainAspectRatio, format, targetSizeKb } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // 1. Initial Resizing
        let img = sharp(imageBuffer);
        const parsedWidth = width ? parseInt(width) : null;
        const parsedHeight = height ? parseInt(height) : null;
        
        if (parsedWidth || parsedHeight) {
            const resizeOpts = {
                fit: maintainAspectRatio ? 'inside' : 'fill'
            };
            if (parsedWidth) resizeOpts.width = parsedWidth;
            if (parsedHeight) resizeOpts.height = parsedHeight;
            img = img.resize(resizeOpts);
        }

        // We pre-render the resized image so we don't recalculate scaling repeatedly
        const resizedBuffer = await img.toBuffer();
        
        // 2. Compression Logic if targetSizeKb is provided
        const outFormat = (format && ['jpeg', 'png', 'webp'].includes(format.toLowerCase())) ? format.toLowerCase() : 'jpeg';
        
        if (!targetSizeKb || isNaN(targetSizeKb)) {
            // No compression target, just convert formats
            const finalBuf = await sharp(resizedBuffer).toFormat(outFormat).toBuffer();
            const finalMeta = await sharp(finalBuf).metadata();
            return res.json({
                base64: `data:image/${outFormat};base64,${finalBuf.toString('base64')}`,
                sizeKb: (finalBuf.length / 1024).toFixed(2),
                width: finalMeta.width,
                height: finalMeta.height
            });
        }

        const targetBytes = targetSizeKb * 1024;
        const tolerance = 2 * 1024; // +/- 2KB
        
        let minQ = 1;
        let maxQ = 100;
        let bestBuffer = null;
        let bestSize = Infinity;
        let attempts = 0;
        let bestQuality = 100;

        // Binary search for optimal quality
        while (minQ <= maxQ && attempts < 10) {
            let quality = Math.floor((minQ + maxQ) / 2);
            let currentBuffer;

            // Generate buffer with current quality
            if (outFormat === 'png') {
                currentBuffer = await sharp(resizedBuffer).png({ quality, effort: 1, palette: true }).toBuffer();
            } else if (outFormat === 'webp') {
                currentBuffer = await sharp(resizedBuffer).webp({ quality }).toBuffer();
            } else {
                currentBuffer = await sharp(resizedBuffer).jpeg({ quality }).toBuffer();
            }

            let size = currentBuffer.length;
            
            // Prefer tracking the best match so far
            if (Math.abs(size - targetBytes) < Math.abs(bestSize - targetBytes)) {
                bestBuffer = currentBuffer;
                bestSize = size;
                bestQuality = quality;
            }

            if (size > targetBytes) {
                maxQ = quality - 1; // Too large -> lower quality
            } else if (size < targetBytes - tolerance) {
                minQ = quality + 1; // Too small -> increase quality
            } else {
                // Hit the exact target within tolerance
                break;
            }
            attempts++;
        }

        // 3. Smart Handling: Resolving impossibly strict sizes by dynamic scaling
        let warning = null;
        if (bestSize > targetBytes + tolerance) {
            warning = "Target size too strict for given dimensions. Image dimensions were reduced automatically perfectly fit target KB limit.";
            let scale = 0.9;
            let fallbackAttempts = 0;
            const originalMeta = await sharp(bestBuffer).metadata();
            
            while (bestSize > targetBytes + tolerance && fallbackAttempts < 6 && scale > 0.1) {
                const newWidth = Math.max(10, Math.floor(originalMeta.width * scale));
                const currentBuffer = await sharp(bestBuffer)
                    .resize({ width: newWidth })
                    // retain the lowest possible quality
                    .toFormat(outFormat, outFormat === 'png' ? { quality: 1, palette: true } : { quality: 1 })
                    .toBuffer();
                
                let size = currentBuffer.length;
                if (Math.abs(size - targetBytes) < Math.abs(bestSize - targetBytes) || size < bestSize) {
                    bestBuffer = currentBuffer;
                    bestSize = size;
                }
                if (size <= targetBytes + tolerance) break;
                scale -= 0.15;
                fallbackAttempts++;
            }
        }

        const finalMeta = await sharp(bestBuffer).metadata();

        res.json({
            base64: `data:image/${outFormat};base64,${bestBuffer.toString('base64')}`,
            sizeKb: (bestBuffer.length / 1024).toFixed(2),
            width: finalMeta.width,
            height: finalMeta.height,
            qualityAchieved: bestQuality,
            warning: warning
        });
        
    } catch (err) {
        console.error("Compression Error:", err);
        res.status(500).json({ error: 'Failed to process image: ' + err.message });
    }
});

// PSD Generation Endpoint for Passport Maker
app.post('/api/generate-passport-psd', async (req, res) => {
    try {
        const { imageBase64, pageSize, count, cutLines } = req.body;
        
        if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

        // Remove data URI prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Resize to 413x531 px (standard passport at 300 DPI)
        const resizedImage = await sharp(imageBuffer)
            .resize(413, 531, { fit: 'fill' })
            .toBuffer();
            
        // Add a 3px black border (total 419x537 px)
        const borderedImageBuffer = await sharp(resizedImage)
            .extend({
                top: 3, bottom: 3, left: 3, right: 3,
                background: { r: 0, g: 0, b: 0, alpha: 1 } 
            })
            .toBuffer();

        // Get raw pixels for ag-psd
        const borderedImageObj = await sharp(borderedImageBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
            
        const photoWidth = 419;
        const photoHeight = 537;
        const rawPhotoData = new Uint8Array(borderedImageObj.data);

        // Dimensions
        let pageWidth = 1800; // Landscape 4x6 by default
        let pageHeight = 1200;
        let cols = 4;
        let rows = 2;
        
        let startX = 32;
        let startY = 53;
        
        if (pageSize === 'a4') {
            pageWidth = 2480;
            pageHeight = 3508;
            cols = Math.min(count, 5);
            rows = Math.ceil(count / 5) || 1;
            startX = 112; 
            startY = 43; 
        } else {
            // 4x6 inch (Landscape 1800x1200)
            rows = Math.min(count, 2);
            cols = Math.ceil(count / 2) || 1;
            startX = 32;
            startY = 53;
        }
        
        const gap = pageSize === 'a4' ? 40 : 20; 
        
        const totalContentWidth = (cols * photoWidth) + ((cols - 1) * gap);
        const totalContentHeight = (rows * photoHeight) + ((rows - 1) * gap);

        const psdData = {
             width: pageWidth,
             height: pageHeight,
             children: []
        };
        
        // Background layer
        const bgRawData = new Uint8Array(pageWidth * pageHeight * 4);
        bgRawData.fill(255); 
        psdData.children.push({
             name: 'Background',
             left: 0, top: 0, right: pageWidth, bottom: pageHeight,
             imageData: { width: pageWidth, height: pageHeight, data: bgRawData }
        });

        // Photo layers
        let currentPhoto = 0;
        if (pageSize === 'a4') {
            for (let r = 0; r < rows; r++) {
                 for (let c = 0; c < cols; c++) {
                     if (currentPhoto >= count) break;
                     const x = startX + c * (photoWidth + gap);
                     const y = startY + r * (photoHeight + gap);
                     psdData.children.push({
                         name: `Photo ${currentPhoto + 1}`,
                         left: x, top: y, right: x + photoWidth, bottom: y + photoHeight,
                         imageData: { width: photoWidth, height: photoHeight, data: rawPhotoData }
                     });
                     currentPhoto++;
                 }
            }
        } else {
            for (let c = 0; c < cols; c++) {
                 for (let r = 0; r < rows; r++) {
                     if (currentPhoto >= count) break;
                     const x = startX + c * (photoWidth + gap);
                     const y = startY + r * (photoHeight + gap);
                     psdData.children.push({
                         name: `Photo ${currentPhoto + 1}`,
                         left: x, top: y, right: x + photoWidth, bottom: y + photoHeight,
                         imageData: { width: photoWidth, height: photoHeight, data: rawPhotoData }
                     });
                     currentPhoto++;
                 }
            }
        }
        
        // Optional Cut Lines
        if (cutLines) {
             const linesRawData = new Uint8Array(pageWidth * pageHeight * 4); 
             linesRawData.fill(0);
             
             const drawHorizontalLine = (y, minX, maxX) => {
                 for(let x=minX; x<maxX; x++) {
                     const idx = (y * pageWidth + x) * 4;
                     linesRawData[idx] = 200; 
                     linesRawData[idx+1] = 200; 
                     linesRawData[idx+2] = 200; 
                     linesRawData[idx+3] = 255; 
                 }
             };
             const drawVerticalLine = (x, minY, maxY) => {
                 for(let y=minY; y<maxY; y++) {
                     const idx = (y * pageWidth + x) * 4;
                     linesRawData[idx] = 200; 
                     linesRawData[idx+1] = 200;
                     linesRawData[idx+2] = 200;
                     linesRawData[idx+3] = 255;
                 }
             };
             
             // Draw vertical lines in gaps
             for (let c = 1; c < cols; c++) {
                 const xGapCenter = startX + c * photoWidth + (c - 1) * gap + Math.floor(gap / 2);
                 drawVerticalLine(xGapCenter, startY, startY + totalContentHeight);
             }
             // Draw horizontal lines in gaps
             for (let r = 1; r < rows; r++) {
                 const yGapCenter = startY + r * photoHeight + (r - 1) * gap + Math.floor(gap / 2);
                 // If the last row is partially filled, the horizontal cut line should only go as far as needed
                 // But drawing it across the bounding 'cols' width is clean enough
                 drawHorizontalLine(yGapCenter, startX, startX + totalContentWidth);
             }
             
             psdData.children.push({
                  name: 'Cut Guides',
                  left: 0, top: 0, right: pageWidth, bottom: pageHeight,
                  imageData: { width: pageWidth, height: pageHeight, data: linesRawData }
             });
        }
        
        const buffer = writePsdBuffer(psdData);
        
        res.setHeader('Content-Type', 'image/vnd.adobe.photoshop');
        res.setHeader('Content-Disposition', 'attachment; filename="passport-layout.psd"');
        res.send(buffer);
        
    } catch (e) {
        console.error("Error generating PSD:", e);
        res.status(500).json({ error: e.message });
    }
});

// Root endpoint redirect to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
