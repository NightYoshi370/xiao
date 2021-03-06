const Command = require('../../structures/Command');
const path = require('path');

module.exports = class WynautCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'wynaut',
			aliases: ['why-not'],
			group: 'single',
			memberName: 'wynaut',
			description: 'Why not? Wynaut?',
			clientPermissions: ['ATTACH_FILES'],
			credit: [
				{
					name: 'Pokémon TV',
					url: 'https://www.pokemon.com/us/pokemon-episodes/'
				}
			]
		});
	}

	run(msg) {
		return msg.say({ files: [path.join(__dirname, '..', '..', 'assets', 'images', 'wynaut.png')] });
	}
};
