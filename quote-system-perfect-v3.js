const { AttachmentBuilder } = require('discord.js');
const Canvas = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const https = require('https');

const FONT_DIR = path.join(process.cwd(), 'fonts');
const FONT_FILE = path.join(FONT_DIR, 'Inter-Regular.ttf');
const FONT_ITALIC_FILE = path.join(FONT_DIR, 'Inter-Italic.ttf');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function download(url, dest) { return new Promise((resolve, reject) => { const f = fs.createWriteStream(dest); https.get(url, res => { if (res.statusCode >= 300 && res.headers.location) { f.close(); fs.unlink(dest, () => download(res.headers.location, dest).then(resolve).catch(reject)); return; } if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`)); res.pipe(f); f.on('finish', () => f.close(resolve)); }).on('error', e => { f.close(); fs.unlink(dest, () => reject(e)); }); }); }
async function ensureFonts() {
  ensureDir(FONT_DIR);
  if (!fs.existsSync(FONT_FILE)) await download('https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf', FONT_FILE).catch(() => null);
  if (!fs.existsSync(FONT_ITALIC_FILE)) await download('https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Italic.ttf', FONT_ITALIC_FILE).catch(() => null);
  try { if (fs.existsSync(FONT_FILE)) Canvas.GlobalFonts.registerFromPath(FONT_FILE, 'QuoteSans'); } catch {}
  try { if (fs.existsSync(FONT_ITALIC_FILE)) Canvas.GlobalFonts.registerFromPath(FONT_ITALIC_FILE, 'QuoteSansItalic'); } catch {}
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fitCrop(imgW, imgH, boxW, boxH) { const s = Math.max(boxW / imgW, boxH / imgH); const dw = imgW * s; const dh = imgH * s; return { dw, dh, dx: (boxW - dw) / 2, dy: (boxH - dh) / 2 }; }
function wrapText(ctx, text, maxWidth, maxLines) { const words = text.split(/\s+/).filter(Boolean); const lines = []; let current = ''; for (const word of words) { const trial = current ? `${current} ${word}` : word; if (ctx.measureText(trial).width <= maxWidth) current = trial; else { if (current) lines.push(current); current = word; if (lines.length === maxLines - 1) break; } } if (current) lines.push(current); if (lines.length && words.length > lines.join(' ').split(/\s+/).filter(Boolean).length) { let last = lines[lines.length - 1]; while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 0) last = last.slice(0, -1); lines[lines.length - 1] = `${last}…`; } return lines.slice(0, maxLines); }
async function loadImageSafe(src) { if (!src) return null; try { return await Canvas.loadImage(src); } catch { return null; } }
function pickImageAttachment(message) { return message.attachments.find(a => a.contentType?.startsWith('image/')) || null; }
async function resolveQuotedMessage(message, args) { if (message.reference?.messageId) return await message.fetchReference().catch(() => null); const possibleId = args[0]; if (possibleId && /^\d{17,20}$/.test(possibleId)) return message.channel.messages.fetch(possibleId).catch(() => null); return null; }
function containsBlockedSlur(text) { return /\b(nigger|faggot|kike|chink|spic)\b/i.test(text || ''); }
async function buildQuoteCard(target) {
  await ensureFonts();
  const width = 1200, height = 630;
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#090909'; ctx.fillRect(0, 0, width, height);
  const cardX = 28, cardY = 28, cardW = width - 56, cardH = height - 56, radius = 36;
  ctx.save(); roundRect(ctx, cardX, cardY, cardW, cardH, radius); ctx.clip();
  ctx.fillStyle = '#050505'; ctx.fillRect(cardX, cardY, cardW, cardH);
  const leftW = 470;
  const bg = await loadImageSafe(pickImageAttachment(target)?.url || target.author.displayAvatarURL({ extension: 'png', size: 512 }));
  if (bg) { const fit = fitCrop(bg.width, bg.height, leftW, cardH); ctx.drawImage(bg, cardX + fit.dx, cardY + fit.dy, fit.dw, fit.dh); const shade = ctx.createLinearGradient(0, cardY, 0, cardY + cardH); shade.addColorStop(0, 'rgba(255,255,255,0.03)'); shade.addColorStop(1, 'rgba(0,0,0,0.2)'); ctx.fillStyle = shade; ctx.fillRect(cardX, cardY, leftW, cardH); }
  const fade = ctx.createLinearGradient(cardX + leftW - 150, 0, cardX + leftW + 95, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.38, 'rgba(0,0,0,0.34)'); fade.addColorStop(0.72, 'rgba(0,0,0,0.88)'); fade.addColorStop(1, 'rgba(0,0,0,1)'); ctx.fillStyle = fade; ctx.fillRect(cardX + leftW - 150, cardY, 270, cardH);
  const fade2 = ctx.createLinearGradient(cardX + leftW - 30, 0, cardX + leftW + 120, 0); fade2.addColorStop(0, 'rgba(0,0,0,0)'); fade2.addColorStop(0.55, 'rgba(0,0,0,0.4)'); fade2.addColorStop(1, 'rgba(0,0,0,0.95)'); ctx.fillStyle = fade2; ctx.fillRect(cardX + leftW - 30, cardY, 160, cardH);
  ctx.fillStyle = '#050505'; ctx.fillRect(cardX + 560, cardY, cardW - 560, cardH); ctx.restore();
  const content = (target.content || '').trim();
  const displayName = target.member?.displayName || target.author.globalName || target.author.username;
  const username = target.author.username;
  const textX = 720, textMaxW = 330;
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff';
  let fontSize = 53;
  const candidate = () => `${fontSize}px "QuoteSans", "Inter", sans-serif`;
  ctx.font = candidate();
  let lines = wrapText(ctx, content, textMaxW, 4);
  while ((lines.length > 4 || lines.some(line => ctx.measureText(line).width > textMaxW)) && fontSize > 34) { fontSize -= 1; ctx.font = candidate(); lines = wrapText(ctx, content, textMaxW, 4); }
  const lineHeight = Math.round(fontSize * 1.18);
  const textBlockH = lines.length * lineHeight;
  const startY = Math.round((height - textBlockH) / 2) - 8;
  lines.forEach((line, i) => ctx.fillText(line, textX, startY + i * lineHeight));
  ctx.fillStyle = '#f0f0f0'; ctx.font = 'italic 32px "QuoteSansItalic", "QuoteSans", "Inter", sans-serif'; ctx.fillText(`- ${displayName}`, textX + 12, startY + textBlockH + 42);
  ctx.fillStyle = '#6e6e6e'; ctx.font = '24px "QuoteSans", "Inter", sans-serif'; ctx.fillText(`@${username}`, textX + 12, startY + textBlockH + 80);
  return await canvas.encode('png');
}
async function handleQuoteCommand(message, args, prefix) { const target = await resolveQuotedMessage(message, args); if (!target) return message.reply(`reply to a message with \`${prefix}quote\` or use \`${prefix}quote MESSAGE_ID\`.`); const content = (target.content || '').trim(); if (!content) return message.reply('that message has no text to quote.'); if (containsBlockedSlur(content)) return message.reply('that message cannot be turned into a quote card.'); const png = await buildQuoteCard(target); return message.channel.send({ files: [new AttachmentBuilder(png, { name: `quote-${target.id}.png` })] }); }
module.exports = { handleQuoteCommand };
