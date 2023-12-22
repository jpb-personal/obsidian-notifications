require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Message = require('./models/message.js')

const app  = express();
const PORT = process.env.PORT || 3000;

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


app.get('/add-message', async (req, res) => {
    try {
        await Message.insertMany([
            {
                text: "This is a test",
                scheduled_time: new Date(),
            },
            {
                text: "This is another test",
                scheduled_time: new Date(),
            }
        ])
    } catch (error) {
        console.log("err" + error);
    }
})

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
