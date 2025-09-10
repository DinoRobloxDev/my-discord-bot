// Load environment variables from the .env file
require('dotenv').config();

// Import necessary classes from discord.js and Google's Generative AI SDK
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Configure the AI model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Load settings from the JSON file
let botSettings = {};
const settingsFile = path.join(__dirname, 'settings.json');
const dmsFile = path.join(__dirname, 'dms.json');

function loadSettings() {
    try {
        const data = fs.readFileSync(settingsFile, 'utf8');
        botSettings = JSON.parse(data);
    } catch (err) {
        console.error('Error loading settings file:', err);
        process.exit(1);
    }
}
loadSettings();

// Create a new Discord client instance with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers // Required for welcome messages and auto-roles
    ]
});

// Event listener for when the bot is ready
client.on('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    client.user.setPresence({
        status: botSettings.status,
        activities: [{ name: botSettings.activity, type: 0 }]
    });

    if (botSettings.avatarURL) {
        try {
            await client.user.setAvatar(botSettings.avatarURL);
        } catch (error) {
            console.error('Failed to set avatar:', error);
        }
    }
});

// Event listener for new members joining the server
client.on('guildMemberAdd', member => {
    // Send a welcome message if configured
    if (botSettings.welcomeMessage && member.guild.systemChannel) {
        const welcomeMessage = botSettings.welcomeMessage.replace('{user}', `<@${member.id}>`);
        member.guild.systemChannel.send(welcomeMessage);
    }

    // Assign an auto-role if configured
    if (botSettings.autoRoleId) {
        const role = member.guild.roles.cache.get(botSettings.autoRoleId);
        if (role) {
            member.roles.add(role).catch(console.error);
        }
    }
});

// Event listener for all incoming messages
client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Log DMs to the dms.json file
    if (msg.channel.type === 1) { // Type 1 is a DM channel
        const dmLog = {
            timestamp: new Date().toISOString(),
            author: msg.author.tag,
            content: msg.content
        };

        fs.readFile(dmsFile, 'utf8', (err, data) => {
            let dms = [];
            if (!err) {
                try {
                    dms = JSON.parse(data);
                } catch (e) {
                    console.error("Error parsing dms.json:", e);
                }
            }
            dms.push(dmLog);
            fs.writeFile(dmsFile, JSON.stringify(dms, null, 2), 'utf8', (err) => {
                if (err) console.error('Error writing DM to log file:', err);
            });
        });
        console.log(`[DM] ${msg.author.tag}: ${msg.content}`);
        msg.reply("Thanks for your message! Your DM has been logged.");
        return;
    }

    const messageContentLower = msg.content.toLowerCase();
    const args = msg.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- New Moderation Commands ---
    if (command === 'ban') {
        if (!msg.member.permissions.has('BAN_MEMBERS')) {
            return msg.reply('You do not have permission to use this command.');
        }
        const member = msg.mentions.members.first();
        if (!member) {
            return msg.reply('You need to mention a user to ban.');
        }
        const reason = args.slice(1).join(' ') || 'No reason provided';
        await member.ban({ reason }).catch(console.error);
        msg.reply(`Successfully banned ${member.user.tag}.`);
        return;
    }
    
    if (command === 'kick') {
        if (!msg.member.permissions.has('KICK_MEMBERS')) {
            return msg.reply('You do not have permission to use this command.');
        }
        const member = msg.mentions.members.first();
        if (!member) {
            return msg.reply('You need to mention a user to kick.');
        }
        const reason = args.slice(1).join(' ') || 'No reason provided';
        await member.kick(reason).catch(console.error);
        msg.reply(`Successfully kicked ${member.user.tag}.`);
        return;
    }

    // --- New Custom Commands ---
    const customCmd = botSettings.customCommands.find(c => c.command === command);
    if (customCmd) {
        msg.reply(customCmd.response);
        return;
    }
    
    // --- Existing Functionality ---
    if (messageContentLower.includes("discord link")) {
        const user = msg.author;
        msg.channel.send(`Hey, ${user}, here is the link: ${botSettings.discordLink}`);
        return;
    }

    if (msg.content.endsWith('?')) {
        let matchedChannelId = null;

        for (const keyword in botSettings.channelKeywords) {
            if (messageContentLower.includes(keyword)) {
                matchedChannelId = botSettings.channelKeywords[keyword];
                break;
            }
        }

        if (matchedChannelId) {
            const redirectEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('Channel Redirect')
                .setDescription(`I can't answer that here, but you can find more information in our dedicated channel: <#${matchedChannelId}>`);
            msg.reply({ embeds: [redirectEmbed] });
            return;
        }

        let aiResponse = '';
        try {
            const result = await model.generateContent(msg.content);
            const response = await result.response;
            aiResponse = response.text();
        } catch (error) {
            console.error('Error generating AI response:', error);
            aiResponse = 'I\'m sorry, I encountered an error and cannot respond right now.';
        }

        const responseEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Answering your question...')
            .setDescription(aiResponse)
            .setTimestamp()
            .setFooter({ text: 'Powered by Google\'s Gemini AI' });

        msg.reply({ embeds: [responseEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);