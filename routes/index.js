const express = require('express');
const router = express.Router();
const lwid = require('../db/models').lwid;
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const request = require("request-promise");

// Last week I did
router.post('/lwid', async (req, res) => {
    try {
        let {payload} = req.body;
        payload = JSON.parse(payload);

        // Search if there is already an entry with same timestamp
        const [lwids, err] = await lwid.findAll({
            where: {
                message_ts: payload.message_ts
            }
        });

        if (lwids) {
            res.sendStatus(200);
            request.post(payload.response_url,
                {
                    json: {
                        text: `Already marked as LWID!`,
                        replace_original: false
                    }
                },
                function (error, response, body) {
                    if (!error && response.statusCode === 200) {
                        console.log(body);
                    }
                }
            );
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
                "Authorization": `Bearer xoxb-10288252704-1003424213152-SPWkz3QQbGQOZ2UrgHLdxGO1`,
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
            message_ts: payload.message_ts
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

router.post('/mom', async (req, res) => {
    try {
        const {response_url} = req.body;

        res.status(200).json("Fetching MoM...");

        const TODAY_START = new Date(new Date().setHours(0, 0, 0, 0));
        const NOW = new Date();

        const lwids = await lwid.findAll({
            where: {
                date: {
                    [Op.between]: [TODAY_START, NOW]
                },
            }
        });

        let lwid_text = "\n\n*Last Week I did*\n";

        lwids.forEach((lwid) => {
            lwid_text += `- ${lwid.name} - ${lwid.content}\n`;
        });

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

module.exports = router;
