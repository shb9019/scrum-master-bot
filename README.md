# Scrum Master Bot

## Installation

```
    git clone https://github.com/shb9019/scrum-master-bot.git
    npm install
    npm start
```

## Usage in slack

Currently, the app is available only on the Delta Force slack group.
Contact any of the admins to add the app to a channel

### Slash commands
`/mom` - Get the minutes of the meeting (Returns only for that day)

`/lwid-topic-search` - Search for a specific regex in all people's `Last Week I did`

`/attendance` - List of all people not present and the attendance count

### App Actions

Click on the options on any message, you should find all message actions

`Add to LWID` - Add this message to the person's "Last Week I Did"

## TODO

- [ ] Getting Weekly MoM
- [ ] Get personal MoM i.e., /my-mom returns all things I've done over past weeks
- [ ] Somehow distinguish passed outs
- [ ] Keep track of how many and which scrums a member is not present for
- [ ] Allow members to cite reasons before scrum for not being present
- [ ] Create custom topic discussions e.g., DWOC, Hackertalks to be included in MoM
- [ ] Measure interactivity of a person based on the group conversations (Future plan)
- [ ] Implement some sort of NLP to create Minutes from the conversation itself (Future plan)
