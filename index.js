
// -----
// SETUP
// -----

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');


// Initailize app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to database
mongoose.set('strictQuery', false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB | MongoDB Connected: ' + conn.connection.host)
    } catch (error) {
        console.error("MongoDB | " + error);
        process.exit(1);
    }
}
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log('App | Listening on port ' + PORT);
    })
})

// Load database models
const Message = require('./models/message.js');

// Initailize telegram bot
const bot = new TelegramBot(process.env.BOT_TOKEN);


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


// -------------
// CONFIGURATION
// -------------


// PRE: -
// POST: returns all messages in database
app.get('/messages', async (_req,res) => {
    try {
        // get all messages
        const messages = await Message.find();

        // return messages if any were found
        if(messages) {
            console.log("/messages | Messages found");
            res.status(201).json({ message: "/messages | Messages found", messages: messages });
        } else {
            console.error("/messages | Messages could not be retrieved:", messages);
            res.status(500).json({ error: "/messages | Messages could not be retrieved" });
        }
    } catch (error) {
        console.error("/messages |", error);
        res.status(500).json({ error: "/messages | Internal Server Error: " + error });
    }
});


// PRE: -
// POST: will clear the entire database
app.put('/clear', async (_req, res) => {
    try {
        await Message.deleteMany({});

        console.log("/clear | Cleared all messages");
        res.status(201).json({ message: "/clear | Cleared all messages"});
    } catch(error){
        console.error("/clear | " + error);
        res.status(500).json({ error: "/clear | Internal Server Error: " + error });
    }
})


// PRE: body must include text, scheduled_time, type
//      scheduled_time must be a js date
//      type must be either 'event', 'task', or 'todo'
// POST: adds corresponding message to database
app.post('/add-message', async (req, res) => {
    try {
        // extract input and confirm it is complete
        const { text, scheduled_time, type } = req.body;
        if (!text || !scheduled_time || !type) {
            console.error("/add-messages | Body incomplete:", req.body);
            res.status(400).json({ error: "/add-messages | Body incomplete: " + req.body });
            return;
        }

        // save message
        const newMessage = new Message({
            text,
            scheduled_time: new Date(scheduled_time),
            type,
        });
        await newMessage.save().then(msg => {
            const id = msg.id;
            res.status(201).json({ message: "Message successfully added to the database", id: id });
        });
    } catch (error) {
        console.error("/add-message |", error);
        res.status(500).json({ error: "/add-message | Internal Server Error: " + error });
    }
});


// PRE: body must contain the message's id
//      id was provided by the API when the message was added to the database
// POST: removes the corresponding message from the database
app.put('/delete-message', async (req, res) => {
    try {
        // extract input and confirm it is complete
        const { id } = req.body;
        if (!id) {
            console.error("/delete-message | Body incomplete:", req.body);
            return res.status(400).json({ error: "/delete-message | Body incomplete: " + req.body });
        }

        // delete message
        await Message.findOneAndDelete({ _id: id }).then(() => {
            console.log("/delete-message | Message", id, "successfully deleted");
            res.status(201).json({ message: "/delete-message | Message " + id + " successfully deleted" });
        });

    } catch (error) {
        console.error("/delete-message |", error);
        res.status(500).json({ error: "/delete-message | Internal Server Error: " + error });
    }
})


// PRE: body must contain id, text, scheduled_time, type
//      id was provided by the API when the message was added to the database
//      scheduled_time must be a js date
//      type must be either 'event', 'task', or 'todo'
// POST: will alter the corresponding message's text, scheduled_time, and type
app.put('/modify-message', async (req,res) => {
    try {
        // extract input and confirm it is complete
        const { id, text, scheduled_time, type } = req.body;
        if (!id || !text || !scheduled_time || !type) {
            console.error("/modify-message | Body incomplete:", req.body);
            return res.status(400).json({ error: "/modify-message | Body incomplete: " + req.body });
        }

        // modify the corresponding message according to input values
        const options = {
            text: text,
            scheduled_time: new Date(scheduled_time),
            type: type,
        };
        await Message.findOneAndUpdate({ _id: id }, options).then(() => {
            console.log("/modify-message | Message", id, "was successfully modified");
            res.status(201).json({ message: "/modify-message | Message " + id + " was successfully modified" });
        });

    } catch (error) {
        console.error("/modify-message |", error);
        res.status(500).json({ error: "/modify-message | Internal Server Error: " + error });
    }
})


// PRE: -
// POST: will run through all messages in the database and send those that are scheduled within the next 35 min
app.post('/check-messages', async (_req, res) => {
    try {
        const now = new Date();
        const then = new Date(now.getTime() + 35*60000);

        // get all messages that are scheduled within the next 35 min
        const messages = await Message.find({
            scheduled_time: {
                $gte: now,
                $lte: then,
            }
        });

        // have the telegram bot send each message
        messages.forEach(async (entry) => {
            const remaining_time = timeDif(new Date(), entry.scheduled_time);
            const text = entry.text.replace("//time//", remaining_time + ' min');
            bot.sendMessage(process.env.CHAT_ID, text, { parse_mode: 'HTML'});
        })

        // delete all messages that should have been sent by now
        // except for todos
        await Message.deleteMany({
            scheduled_time: {
                $lte: then,
            }
        }, {
            type: "todo"
        })

        // reschedule todos
        let nextNotifDate = now;
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

        console.log("/check-messages | All messages checked");
        res.status(201).json({ message: "/check-messages | All messages checked" });

    } catch (error) {
        console.error("/check-messages | " + error);
        res.status(500).json({ error: "/check-messages | Internal Server Error: " + error });
    }
});
