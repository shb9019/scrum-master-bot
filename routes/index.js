const express = require('express');
const router = express.Router();
const lwid = require('../db/models').lwid;
const admin = require('../db/models').admin;
const discussion = require('../db/models').discussion;
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
        const {callback_id} = payload;

        if (callback_id === 'lwid') {
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
        } else if (callback_id === 'discussion') {
            // Marking as discussion can only be done by scrum master
            if (!(await isAdmin(payload.user.id))) {
                request.post(payload.response_url, {
                    json: {
                        text: `Only scrum masters can mark as discussion! Sibi is the god!`,
                        replace_original: false
                    }
                });
                return;
            }

            // Search if there is already an entry with same timestamp
            const [discussions, err] = await discussion.findAll({
                where: {
                    message_ts: payload.message_ts,
                    channel_id: payload.channel.id
                }
            });

            if (discussions) {
                res.sendStatus(200);
                request.post(payload.response_url, {
                    json: {
                        text: `Already marked as Discussion`,
                        replace_original: false
                    }
                });
                return;
            }

            const [topic, content] = payload.message.text.split(/-(.+)/);

            // Insert discussion to db
            await discussion.create({
                topic,
                content,
                date: new Date(),
                message_ts: payload.message.ts,
                channel_id: payload.channel.id
            });

            res.sendStatus(200);
            request.post(payload.response_url, {
                json: {
                    text: `Added!`,
                    replace_original: false
                }
            });
        }
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
            const [startDate, endDate] = text.split(" ");
            TODAY_START = new Date(new Date(startDate).setHours(0, 0, 0, 0));
            NOW = new Date(new Date(endDate).setHours(23, 59, 59, 0));
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

        // Loop for grouping MoMs from same person
        let lwid_contents = [];
        lwids.forEach((lwid) => {
            let exists = false;
            for (let i in lwid_contents) {
                if (lwid_contents[i].name === lwid.name) {
                    lwid_contents[i].content += `, ${lwid.content}`;
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                lwid_contents.push({
                    name: lwid.name,
                    content: lwid.content
                });
            }
        });

        for (let i in lwid_contents) {
            lwid_text += `- ${lwid_contents[i].name} - ${lwid_contents[i].content}\n`;
        }

        // Leave content empty if no LWIDs
        if (lwid_text !== "") {
            lwid_text = "\n\n*Last Week I did*\n" + lwid_text;
        }

        const discussions = await discussion.findAll({
            where: {
                date: {
                    [Op.between]: [TODAY_START, NOW]
                },
                channel_id
            }
        });

        let discussion_text = "";

        // Loop for grouping MoMs from same person
        let discussion_contents = [];
        discussions.forEach((discussion) => {
            let exists = false;
            for (let i in discussion_contents) {
                if (discussion_contents[i].topic === discussion.topic) {
                    discussion_contents[i].content.push(`- ${discussion.content}\n`);
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                discussion_contents.push({
                    topic: discussion.topic,
                    content: [`- ${discussion.content}\n`]
                });
            }
        });

        for (let i in discussion_contents) {
            discussion_text += `\n*${discussion_contents[i].topic}*\n`;
            for (let j in discussion_contents[i].content) {
                discussion_text += discussion_contents[i].content[j];
            }
        }

        request.post(response_url, {
            json: {
                text: `*MINUTES OF THE MEETING* \n${lwid_text} \n${discussion_text}`,
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

// Slash Command - Fetch personal contributions
router.post('/my-mom', async (req, res) => {
    try {
        let {channel_id, response_url, user_name, user_id} = req.body;

        const profilePayload = await request(`https://slack.com/api/users.profile.get?user=${user_id}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.authToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const {ok, profile} = JSON.parse(profilePayload);

        if (!ok) {
            request.post(response_url, {
                json: {
                    text: `User does not exist`,
                    replace_original: false
                }
            });
            return;
        }

        res.status(200).json("Searching...");

        const lwids = await lwid.findAll({
            where: {
                name: profile.real_name,
                channel_id
            }
        });

        let lwid_text = "";
        for (let i in lwids) {
            lwid_text += `- ${new Date(lwids[i].date).toDateString()} - ${lwids[i].content}\n`;
        }

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

router.post("/get-attendance", async (req, res) => {
    try {
        let {channel_id, text, user_id, response_url} = req.body;

        // Only for admins
        if (!(await isAdmin(user_id))) {
            res.status(200).json("You are not a scrum master! Ask Sibi for attendance.");
            return;
        }

        res.status(200).json("Fetching...");

        // Getting the name of the requested person
        const profilePayload = await request(`https://slack.com/api/users.profile.get?user=${text}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.authToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const {ok, profile} = JSON.parse(profilePayload);

        if (!ok) {
            request.post(response_url, {
                json: {
                    text: `User does not exist!`,
                    replace_original: false
                }
            });
            return;
        }

        // Get LWIDs of person and calculate as present only if there is a LWID present on a day
        const lwids = await lwid.findAll({
            where: {
                name: profile.real_name,
                channel_id
            }
        });

        // Only have unique dates
        const present_dates = [];
        let attendance_text = `*Scrums ${profile.real_name} was present for:*\n`;
        lwids.forEach((lwid) => {
            const date = new Date(lwid.date).toDateString();

            if (present_dates.indexOf(date) === -1) {
                present_dates.push(date);
            }
        });

        for (let i in present_dates) {
            attendance_text += " - " + present_dates[i] + "\n";
        }

        request.post(response_url, {
            json: {
                text: attendance_text,
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

router.post("/my-attendance", async (req, res) => {
    try {
        let {channel_id, user_id, response_url} = req.body;

        res.status(200).json("Fetching...");

        // Getting the name of the requested person
        const profilePayload = await request(`https://slack.com/api/users.profile.get?user=${user_id}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${config.authToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        });

        const {ok, profile} = JSON.parse(profilePayload);

        // Get LWIDs of person and calculate as present only if there is a LWID present on a day
        const lwids = await lwid.findAll({
            where: {
                name: profile.real_name,
                channel_id
            }
        });

        // Only have unique dates
        const present_dates = [];
        let attendance_text = `*Scrums ${profile.real_name} was present for:*\n`;
        lwids.forEach((lwid) => {
            const date = new Date(lwid.date).toDateString();

            if (present_dates.indexOf(date) === -1) {
                present_dates.push(date);
            }
        });

        for (let i in present_dates) {
            attendance_text += " - " + present_dates[i] + "\n";
        }

        request.post(response_url, {
            json: {
                text: attendance_text,
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
