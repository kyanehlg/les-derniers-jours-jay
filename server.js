'use strict';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true, mode: 'jay-desert-campaign' }));
app.listen(PORT, () => console.log(`Cellule prête sur http://localhost:${PORT}`));
