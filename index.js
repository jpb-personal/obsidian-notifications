require('dotenv').config();
const express = require('express');
const cors = require('cors');

const mongoose = require('mongoose');
const Message = require('./models/message.js')
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, {polling: true});

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.options('/add-message', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'app://obsidian.md');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
});

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


app.get('/messages', async (req,res) => {
    const message = await Message.find();

    if (message) {
        console.log("Messages found");
        res.json(message);
    } else {
        res.send("Something went wrong.");
    }
});


app.post('/add-message', async (req, res) => {
    try {
        const { text, scheduled_time, type } = req.body;

        if (!text || !scheduled_time || !type) {
            return res.status(400).json({ error: 'Text, scheduled_time, and type are required' });
        }

        const newMessage = new Message({
            text,
            scheduled_time: new Date(scheduled_time),
            type,
        });

        await newMessage.save().then(msg => {
            const id = msg.id;
            res.status(201).json({ message: 'Message added to the database successfully', id });
        });

    } catch (error) {
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.put('/delete-message', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Id is required' });
        }

        await Message.findOneAndDelete({ _id: id }).then(() => {
            res.status(201).json({ message: 'Message successfully deleted'});
        });

    } catch (error) {
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


app.put('/modify-message', async (req,res) => {
    try {
        const { id, text, scheduled_time, type } = req.body;

        if (!id || !text || !scheduled_time || !type) {
            return res.status(400).json({ error: 'ID, text, scheduled_time, and type are required' });
        }

        const options = {
            text: text,
            scheduled_time: new Date(scheduled_time),
            type: type,
        };

        await Message.findOneAndUpdate({ _id: id }, options).then(() => {
            res.status(201).json({ message: 'Message successfully modified'});
        });

    } catch (error) {
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


app.put('/clear', async (req, res) => {
    try {
        await Message.deleteMany({});
        res.status(201).json({ message: 'All messages cleared'});
    } catch(error){
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
})


function timeDif(date1, date2) {
  // Convert both dates to milliseconds since Jan 1, 1970 00:00:00 UTC
  const time1 = date1.getTime();
  const time2 = date2.getTime();

  // Calculate the time difference in milliseconds
  const timeDifference = Math.abs(time2 - time1);

  // Convert milliseconds to minutes
  const minutesDifference = Math.floor(timeDifference / (1000 * 60));

  return minutesDifference;
}


app.post('/check-messages', async (req, res) => {
    try {
        console.log("Checking messages");
        const now = new Date();
        const then = new Date(now.getTime() + 30*60000);

        const messages = await Message.find({
            scheduled_time: {
                $gte: now,
                $lte: then,
            }
        });

        messages.forEach(async (entry) => {
            const remaining_time = timeDif(new Date(), entry.scheduled_time);
            const text = entry.text.replace("//time//", remaining_time + ' min');
            bot.sendMessage(process.env.CHAT_ID, text, { parse_mode: 'HTML'});
        })

        await Message.deleteMany({
            scheduled_time: {
                $lte: then,
            }
        }, {
            type: "todo"
        })

        let nextNotifDate = new Date();
        nextNotifDate.setDate(nextNotifDate.getDate() + 3);

        await Message.updateMany({
            type: "todo",
            scheduled_time: {
                $gte: now,
                $lte: then,
            }
        } , {
            scheduled_time: nextNotifDate, 
        })

        res.status(201).json({ message: 'All messages checked'});

    } catch (error) {
        console.error("ERROR | " + error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('Listening on port ' + PORT);
    })
})
