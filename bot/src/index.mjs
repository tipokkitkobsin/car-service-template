import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Events, GatewayIntentBits, MessageFlags, ModalBuilder,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { createStore, StoreError } from '../../web/core/github-store.js';
import { todayInBangkok } from '../../web/core/schedule.js';
import { isAllowed, recordKm, statusText, undoKm } from './handlers.mjs';

const UNDO_PATTERN = /^km:undo:(\d{4}-\d{2}-\d{2}):(\d{1,7})$/;

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing environment variable ${name}`);
    process.exit(2);
  }
  return value;
};

const config = {
  token: requireEnv('DISCORD_BOT_TOKEN'),
  guildId: requireEnv('DISCORD_GUILD_ID'),
  channelId: requireEnv('DISCORD_CHANNEL_ID'),
  ownerId: requireEnv('DISCORD_OWNER_ID'),
};
const store = createStore({
  owner: requireEnv('DATA_OWNER').trim(),
  repo: requireEnv('DATA_REPO').trim(),
  path: 'data/car.json',
  token: requireEnv('GITHUB_TOKEN'),
});
const ephemeral = { flags: MessageFlags.Ephemeral };

const commands = [
  new SlashCommandBuilder().setName('km').setDescription('จดเลขไมล์วันนี้')
    .addStringOption((option) => option.setName('value').setDescription('เลขไมล์ เช่น 115000').setRequired(true)),
  new SlashCommandBuilder().setName('status').setDescription('ดูงานเช็คระยะที่ค้างหรือใกล้ถึง'),
].map((command) => command.toJSON());

const kmModal = () => new ModalBuilder().setCustomId('km:submit').setTitle('กรอกเลขไมล์').addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder()
    .setCustomId('km').setLabel('เลขไมล์วันนี้').setStyle(TextInputStyle.Short)
    .setPlaceholder('115000').setMinLength(1).setMaxLength(9).setRequired(true)),
);

const kmReply = ({ text, reading }) => {
  if (!reading) return { content: text, components: [] };
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('km:open').setLabel('แก้').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`km:undo:${reading.date}:${reading.km}`).setLabel('ลบรายการนี้').setStyle(ButtonStyle.Danger),
  );
  return { content: text, components: [buttons] };
};

const answer = async (interaction, work) => {
  await interaction.deferReply(ephemeral);
  try {
    await interaction.editReply(await work());
  } catch (error) {
    console.error(`Request failed: ${error.code ?? error.name}`);
    await interaction.editReply(error instanceof StoreError ? error.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
  }
};

const route = async (interaction) => {
  const today = todayInBangkok();
  if (interaction.isChatInputCommand() && interaction.commandName === 'km') {
    return answer(interaction, async () => kmReply(await recordKm({
      raw: interaction.options.getString('value', true), store, today,
    })));
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
    return answer(interaction, () => statusText({ store, today }));
  }
  if (interaction.isButton() && interaction.customId === 'km:open') return interaction.showModal(kmModal());
  if (interaction.isModalSubmit() && interaction.customId === 'km:submit') {
    return answer(interaction, async () => kmReply(await recordKm({
      raw: interaction.fields.getTextInputValue('km'), store, today,
    })));
  }
  const undo = interaction.isButton() ? UNDO_PATTERN.exec(interaction.customId) : null;
  if (undo) return answer(interaction, () => undoKm({ date: undo[1], km: Number(undo[2]), store }));
  return undefined;
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (ready) => {
  try {
    const guild = await ready.guilds.fetch(config.guildId);
    await guild.commands.set(commands);
    console.log('Bot ready');
  } catch (error) {
    console.error(`Could not register commands: ${error.code ?? error.name}`);
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isRepliable()) return;
    if (!isAllowed({ userId: interaction.user.id, channelId: interaction.channelId }, config)) {
      await interaction.reply({ content: 'คำสั่งนี้ใช้ได้เฉพาะเจ้าของรถในห้องที่กำหนด', ...ephemeral });
      return;
    }
    await route(interaction);
  } catch (error) {
    console.error(`Interaction failed: ${error.code ?? error.name}`);
  }
});

client.on(Events.Error, (error) => console.error(`Discord client error: ${error.name}`));

const stop = async () => {
  await client.destroy();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

client.login(config.token).catch((error) => {
  console.error(`Login failed: ${error.code ?? error.name}`);
  process.exit(1);
});
