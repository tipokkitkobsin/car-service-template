import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, Events, GatewayIntentBits, MessageFlags, ModalBuilder,
  SlashCommandBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { createGarage, StoreError } from '../../web/core/github-store.js';
import { MAIN_CAR } from '../../web/core/garage.js';
import { todayInBangkok } from '../../web/core/schedule.js';
import {
  isAllowed, pickCar, recordKm, statusAll, undoKm,
} from './handlers.mjs';
import { setLanguage, t, translateTo, tx } from '../../web/core/i18n.js';

// Button ids carry the car id, except for the first car, whose ids stay as they were before multi-car support.
const CAR_ID = '[a-z0-9]+(?:-[a-z0-9]+)*';
const OPEN_PATTERN = new RegExp(`^km:open(?::(${CAR_ID}))?$`);
const SUBMIT_PATTERN = new RegExp(`^km:submit(?::(${CAR_ID}))?$`);
const UNDO_PATTERN = new RegExp(`^km:undo:(?:(${CAR_ID}):)?(\\d{4}-\\d{2}-\\d{2}):(\\d{1,7})$`);
const MAX_CHOICES = 25;
const withCar = (prefix, id) => (id === MAIN_CAR ? prefix : `${prefix}:${id}`);

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
const garage = createGarage({
  owner: requireEnv('DATA_OWNER').trim(),
  repo: requireEnv('DATA_REPO').trim(),
  token: requireEnv('GITHUB_TOKEN'),
});

const carList = async () => Promise.all((await garage.listCars()).map(async (id) => ({
  id, name: (await garage.storeFor(id).load()).data.car.name,
})));
const ephemeral = { flags: MessageFlags.Ephemeral };

// Thai descriptions, with English shown to Discord users whose app is in English.
const inEnglish = (text) => ({ 'en-US': translateTo('en', text), 'en-GB': translateTo('en', text) });
const describe = (builder, text) => builder.setDescription(text).setDescriptionLocalizations(inEnglish(text));

const commands = [
  describe(new SlashCommandBuilder().setName('km'), tx('จดเลขไมล์วันนี้'))
    .addStringOption((option) => describe(option.setName('value'), tx('เลขไมล์ เช่น 115000')).setRequired(true))
    .addStringOption((option) => describe(option.setName('car'), tx('รถคันไหน (ถ้ามีหลายคัน)')).setAutocomplete(true)),
  describe(new SlashCommandBuilder().setName('status'), tx('ดูงานเช็คระยะที่ค้างหรือใกล้ถึง')),
].map((command) => command.toJSON());

const kmModal = (carId) => new ModalBuilder().setCustomId(withCar('km:submit', carId)).setTitle(t('กรอกเลขไมล์')).addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder()
    .setCustomId('km').setLabel(t('เลขไมล์วันนี้')).setStyle(TextInputStyle.Short)
    .setPlaceholder('115000').setMinLength(1).setMaxLength(9).setRequired(true)),
);

const kmReply = ({ text, reading }, carId) => {
  if (!reading) return { content: text, components: [] };
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(withCar('km:open', carId)).setLabel(t('แก้')).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${withCar('km:undo', carId)}:${reading.date}:${reading.km}`).setLabel(t('ลบรายการนี้')).setStyle(ButtonStyle.Danger),
  );
  return { content: text, components: [buttons] };
};

// Replies follow the language saved with the car data.
const useCarLanguage = async (carId) => {
  const { data } = await garage.storeFor(carId).load();
  setLanguage(data.car.language);
};

const answer = async (interaction, work, carId = MAIN_CAR) => {
  await interaction.deferReply(ephemeral);
  try {
    await useCarLanguage(carId);
    await interaction.editReply(await work());
  } catch (error) {
    console.error(`Request failed: ${error.code ?? error.name}`);
    await interaction.editReply(error instanceof StoreError ? error.message : t('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'));
  }
};

const recordFor = (interaction, carId, raw, today) => answer(interaction, async () => kmReply(await recordKm({
  raw, store: garage.storeFor(carId), today,
}), carId), carId);

const kmCommand = async (interaction, today) => {
  const cars = await carList();
  const carId = pickCar(cars, interaction.options.getString('car'));
  if (!carId) {
    const names = cars.map((car) => car.name).join(', ');
    return interaction.reply({ content: t('มีรถหลายคัน เลือกด้วยตัวเลือก car: {names}', { names }), ...ephemeral });
  }
  return recordFor(interaction, carId, interaction.options.getString('value', true), today);
};

const route = async (interaction) => {
  const today = todayInBangkok();
  if (interaction.isChatInputCommand() && interaction.commandName === 'km') return kmCommand(interaction, today);
  if (interaction.isChatInputCommand() && interaction.commandName === 'status') {
    return answer(interaction, () => statusAll({ garage, today }));
  }
  const open = interaction.isButton() ? OPEN_PATTERN.exec(interaction.customId) : null;
  if (open) return interaction.showModal(kmModal(open[1] ?? MAIN_CAR));
  const submit = interaction.isModalSubmit() ? SUBMIT_PATTERN.exec(interaction.customId) : null;
  if (submit) return recordFor(interaction, submit[1] ?? MAIN_CAR, interaction.fields.getTextInputValue('km'), today);
  const undo = interaction.isButton() ? UNDO_PATTERN.exec(interaction.customId) : null;
  if (undo) {
    const carId = undo[1] ?? MAIN_CAR;
    return answer(interaction, () => undoKm({ date: undo[2], km: Number(undo[3]), store: garage.storeFor(carId) }), carId);
  }
  return undefined;
};

// Suggests car names while typing the car option of /km.
const suggestCars = async (interaction) => {
  const typed = String(interaction.options.getFocused() ?? '').toLowerCase();
  const cars = await carList();
  await interaction.respond(cars
    .filter((car) => car.name.toLowerCase().includes(typed) || car.id.includes(typed))
    .slice(0, MAX_CHOICES)
    .map((car) => ({ name: car.name.slice(0, 100), value: car.id })));
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
    if (interaction.isAutocomplete()) {
      const isOwner = isAllowed({ userId: interaction.user.id, channelId: interaction.channelId }, config);
      await (isOwner ? suggestCars(interaction) : interaction.respond([]));
      return;
    }
    if (!interaction.isRepliable()) return;
    if (!isAllowed({ userId: interaction.user.id, channelId: interaction.channelId }, config)) {
      await interaction.reply({ content: t('คำสั่งนี้ใช้ได้เฉพาะเจ้าของรถในห้องที่กำหนด'), ...ephemeral });
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
