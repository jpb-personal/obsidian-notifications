const mongoose = require('mongoose');


const Schema = mongoose.Schema;
const MessageSchema = new Schema({
    text: {
        type: String,
        require: true,
    },
    scheduled_time: {
        type: Date,
        required: true,
    }
});

module.exports = mongoose.model('Message', MessageSchema);

