const express = require('express');
const router = express.Router();
const lwid = require('../db/models').lwid;
const admin = require('../db/models').admin;
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const request = require("request-promise");
const config = require("../config/config");

// Check if a userId is admin
const isAdmin = async (userId) => {
    const [admins, err] = await admin.findAll({
        where: {
            userId
        }
    });

    return (!!admins);
};

// Last week I did
// App Action - Adds a message to LWID
router.post('/lwid', async (req, res) => {
    try {
        let {payload} = req.body;
        payload = JSON.parse(payload);

        // Search if there is already an entry with same timestamp
        const [lwids, err] = await lwid.findAll({
            where: {
                message_ts: payload.message_ts,
                channel_id: payload.channel.id
            }
        });

        if (lwids) {
            res.status(200).json("Already marked as LWID!");
            return;
        }

        if (!payload.message.user) {
            request.post(payload.response_url, {
                json: {
                    text: `User cannot be a bot`,
                    replace_original: false
                }
            });
            return;
        }

        const profilePayload = await request(`https://slack.com/api/users.profile.get?user=${payload.message.user}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.authToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const {ok, profile} = JSON.parse(profilePayload);

        if (!ok) {
            request.post(payload.response_url, {
                json: {
                    text: `User does not exist`,
                    replace_original: false
                }
            });
            return;
        }

        // Insert lwid to db
        await lwid.create({
            name: profile.real_name,
            content: payload.message.text,
            date: new Date(),
            message_ts: payload.message_ts,
            channel_id: payload.channel.id
        });

        res.sendStatus(200);

        // Send app response
        request.post(payload.response_url, {
            json: {
                text: `Great work ${payload.user.name}!`,
                response_type: "in_channel",
                replace_original: false
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'Error',
            error: err.toString(),
        });
    }
});

// Slash Command - Fetch Minutes of the meeting (Collection of LWIDs)
router.post('/mom', async (req, res) => {
    try {
        const {response_url, text, channel_id} = req.body;

        res.status(200).json("Fetching Minutes...");

        let TODAY_START, NOW;
        if (text === "") {
            TODAY_START = new Date(new Date().setHours(0, 0, 0, 0));
            NOW = new Date();
        } else {
            TODAY_START = new Date(new Date(text).setHours(0, 0, 0, 0));
            NOW = new Date(new Date(text).setHours(23, 59, 59, 0));
        }

        const lwids = await lwid.findAll({
            where: {
                date: {
                    [Op.between]: [TODAY_START, NOW]
                },
                channel_id
            }
        });

        let lwid_text = "";

        lwids.forEach((lwid) => {
            lwid_text += `- ${lwid.name} - ${lwid.content}\n`;
        });

        // Leave content empty if no LWIDs
        if (lwid_text !== "") {
            lwid_text = "\n\n*Last Week I did*\n" + lwid_text;
        }

        request.post(response_url, {
            json: {
                text: `*MINUTES OF THE MEETING* \n${lwid_text}`,
                response_type: "in_channel",
                replace_original: false
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'Error',
            error: err.toString(),
        });
    }
});

// Slash Command - Fetch LWIDs of users
router.post('/get-lwids-topic', async (req, res) => {
    try {
        let {text, response_url} = req.body;

        const lwids = await lwid.findAll({
            where: {
                content: {
                    [Op.like]: text
                },
            }
        });

        let lwid_text = "";

        if (lwids.length !== 0) {
            lwid_text += `*LWIDs matching regex ${text}:*\n`;
            lwids.forEach((lwid) => {
                lwid_text += `- ${lwid.date.toDateString()}: ${lwid.name} - ${lwid.content}\n`;
            });
        } else {
            lwid_text = "No results found!";
        }

        res.status(200).json("Searching...");

        request.post(response_url, {
            json: {
                text: lwid_text,
                replace_original: false
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'Error',
            error: err.toString(),
        });
    }
});

// Get list of all people not present and count
router.post('/attendance', async (req, res) => {
    try {
        const {response_url, user_id} = req.body;

        if (!(await isAdmin(user_id))) {
            res.status(200).json("You are not a scrum master! Ask Sibi for attendance.");
            return;
        }

        res.status(200).json("Fetching all users and calculating attendance... (Might take a minute or two)");

        const usersPayload = await request(`https://slack.com/api/users.list`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.authToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        let members = JSON.parse(usersPayload).members;
        members = members.filter((user) => !(user.deleted || user.is_bot || user.real_name === "Slackbot" || user.real_name === "deltaforce"));

        let attendance_text = "*People not active*:\n";
        let total_count = members.length;
        let active_count = 0;

        for (let index in members) {
            const presencePayload = await request(`https://slack.com/api/users.getPresence?user=${members[index].id}`, {
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${config.authToken}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            });

            const presence = JSON.parse(presencePayload);

            if (presence.presence !== "active") {
                attendance_text += `- ${members[index].real_name}\n`;
            } else {
                active_count++;
            }

            console.log(index);
        }

        attendance_text += "\n";
        attendance_text += `*Total Members*: ${total_count}\n`;
        attendance_text += `*Present Members*: ${active_count}`;

        request.post(response_url, {
            json: {
                text: attendance_text,
                response_type: "in_channel",
                replace_original: false
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'Error',
            error: err.toString(),
        });
    }
});

module.exports = router;
