require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Message = require('./models/message.js')

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

mongoose.set('strictQuery', false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected: ' + conn.connection.host)
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}


app.get('/', (req, res) => {
    res.send({text: 'test'});
});


app.post('/add-message', async (req, res) => {
    try {
        const { text, scheduled_time } = req.body;

        if (!text || !scheduled_time) {
            return res.status(400).json({ error: 'Text and scheduled_time are required' });
        }

        const newMessage = new Message({
            text,
            scheduled_time: new Date(scheduled_time),
        });

        await newMessage.save();

        res.status(201).json({ message: 'Message added to the database successfully' });
    } catch (error) {
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/messages', async (req,res) => {
    const message = await Message.find();

    if (message) {
        res.json(message);
    } else {
        res.send("Something went wrong.");
    }
});


connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('Listening on port ' + PORT);
    })
})
