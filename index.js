const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Hello world');
});

app.post('/gaction/fulfillment', (req, res) => {
    console.log(req.body);
    res.json({ success: true });
});

app.listen(port, () => {
    console.log(`Example app listening at port ${port}`);
});
