const Command = require('../../structures/Command');
const { MessageEmbed } = require('discord.js');
const request = require('node-superfetch');
const { stripIndents } = require('common-tags');
const { verify } = require('../../util/Util');

module.exports = class AkinatorCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'akinator',
			aliases: ['aki'],
			group: 'games',
			memberName: 'akinator',
			description: 'Think about a real or fictional character, I will try to guess who it is.',
			clientPermissions: ['EMBED_LINKS'],
			credit: [
				{
					name: 'Akinator',
					url: 'https://en.akinator.com/'
				}
			]
		});

		this.sessions = new Map();
	}

	async run(msg) {
		if (this.sessions.has(msg.channel.id)) return msg.reply('Only one game may be occuring per channel.');
		try {
			let ans = null;
			this.sessions.set(msg.channel.id, { progression: 0 });
			while (this.sessions.get(msg.channel.id).progression < 95) {
				const { data } = ans === null ? await this.createSession(msg.channel) : await this.progress(msg.channel, ans);
				if (!data || !data.answers || this.sessions.get(msg.channel.id).step >= 80) break;
				const answers = data.answers.map(answer => answer.answer.toLowerCase());
				answers.push('end');
				await msg.say(stripIndents`
					**${++data.step}.** ${data.question} (${Math.round(Number.parseInt(data.progression, 10))}%)
					${data.answers.map(answer => answer.answer).join(' | ')}
				`);
				const filter = res => res.author.id === msg.author.id && answers.includes(res.content.toLowerCase());
				const msgs = await msg.channel.awaitMessages(filter, {
					max: 1,
					time: 30000
				});
				if (!msgs.size) {
					await msg.say('Sorry, time is up!');
					break;
				}
				if (msgs.first().content.toLowerCase() === 'end') break;
				ans = answers.indexOf(msgs.first().content.toLowerCase());
			}
			const { data: guess } = await this.guess(msg.channel);
			if (!guess) {
				this.sessions.delete(msg.channel.id);
				if (guess === 0) return msg.say('I don\'t have any guesses. Bravo.');
				return msg.reply('Hmm... I seem to be having a bit of trouble. Check back soon!');
			}
			const embed = new MessageEmbed()
				.setColor(0xF78B26)
				.setTitle(`I'm ${Math.round(guess.proba * 100)}% sure it's...`)
				.setDescription(`${guess.name}${guess.description ? `\n_${guess.description}_` : ''}`)
				.setThumbnail(guess.absolute_picture_path || null);
			await msg.embed(embed);
			const verification = await verify(msg.channel, msg.author);
			this.sessions.delete(msg.channel.id);
			if (verification === 0) return msg.say('I guess your silence means I have won.');
			if (!verification) return msg.say('Bravo, you have defeated me.');
			return msg.say('Guessed right one more time! I love playing with you!');
		} catch (err) {
			this.sessions.delete(msg.channel.id);
			return msg.reply(`Oh no, an error occurred: \`${err.message}\`. Try again later!`);
		}
	}

	async createSession(channel) {
		const time = Date.now();
		const { body } = await request
			.get('https://srv13.akinator.com:9196/ws/new_session')
			.query({
				partner: '',
				player: 'website-desktop',
				uid_ext_session: '',
				frontaddr: 'NDYuMTA1LjExMC40NQ==',
				constraint: 'ETAT<>\'AV\'',
				soft_constraint: channel.nsfw ? '' : 'ETAT=\'EN\'',
				question_filter: channel.nsfw ? '' : 'cat=1',
				_: time
			});
		if (body.completion !== 'OK') return { data: null, raw: body };
		const data = body.parameters;
		this.sessions.set(channel.id, {
			id: data.identification.session,
			signature: data.identification.signature,
			step: 0,
			progression: Number.parseInt(data.step_information.progression, 10),
			time
		});
		return { data: data.step_information, raw: body };
	}

	async progress(channel, answer) {
		const session = this.sessions.get(channel.id);
		const { body } = await request
			.get('https://srv13.akinator.com:9196/ws/answer')
			.query({
				session: session.id,
				signature: session.signature,
				step: session.step,
				answer,
				question_filter: channel.nsfw ? '' : 'cat=1',
				_: session.time + 1
			});
		if (body.completion !== 'OK') return { data: null, raw: body };
		const data = body.parameters;
		this.sessions.set(channel.id, {
			id: session.id,
			signature: session.signature,
			step: Number.parseInt(data.step, 10),
			progression: Number.parseInt(data.progression, 10),
			time: session.time + 1
		});
		return { data, raw: body };
	}

	async guess(channel) {
		const session = this.sessions.get(channel.id);
		const { body } = await request
			.get('https://srv13.akinator.com:9196/ws/list')
			.query({
				session: session.id,
				signature: session.signature,
				step: session.step,
				size: 2,
				max_pic_width: 246,
				max_pic_height: 294,
				pref_photos: 'VO-OK',
				duel_allowed: 1,
				mode_question: 0
			});
		if (body.completion === 'KO - ELEM LIST IS EMPTY') return { data: 0, raw: body };
		if (body.completion !== 'OK') return { data: null, raw: body };
		return { data: body.parameters.elements[0].element, raw: body };
	}
};
