const { Command } = require('discord.js-commando');
const snekfetch = require('snekfetch');
const { promisifyAll } = require('tsubaki');
const xml = promisifyAll(require('xml2js'));

module.exports = class GelbooruCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'gelbooru',
            group: 'search',
            memberName: 'gelbooru',
            description: 'Sends an image from Gelbooru, with query.',
            args: [
                {
                    key: 'query',
                    prompt: 'What would you like to search for?',
                    type: 'string'
                }
            ]
        });
    }

    async run(msg, args) {
        if (!msg.channel.nsfw) return msg.say('This Command can only be used in NSFW Channels.');
        const { query } = args;
        try {
            const { text } = await snekfetch
                .get('https://gelbooru.com/index.php')
                .query({
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    tags: query,
                    limit: 1
                });
            const { posts } = await xml.parseStringAsync(text);
            if (posts.$.count === '0') throw new Error('No Results.');
            return msg.say(`Result for ${query}: https:${posts.post[0].$.file_url}`);
        } catch (err) {
            return msg.say(`${err.name}: ${err.message}`);
        }
    }
};