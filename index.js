const express = require("express");
const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "virtulabel2024";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const PRODUCT_DATA = [
  { product: "Woven Label", moq: "500 pcs", price: "2.50/pc", material: "Polyester", delivery: "7-10 days" },
  { product: "Hang Tag", moq: "200 pcs", price: "3.00/pc", material: "Art Card 350gsm", delivery: "5-7 days" },
  { product: "Leather Patch", moq: "100 pcs", price: "25.00/pc", material: "PU Leather", delivery: "10-14 days" },
  { product: "Care Label", moq: "1000 pcs", price: "1.20/pc", material: "Satin Ribbon", delivery: "5-7 days" },
  { product: "Printed Label", moq: "500 pcs", price: "1.80/pc", material: "Polyester", delivery: "7-10 days" },
];

const SYSTEM_PROMPT = `You are the WhatsApp customer service assistant for Virtu Label, a Bangladeshi clothing label supplier based in Dhaka.
Respond in Banglish (Bengali and English mixed) - friendly, concise, professional.
Keep replies short: 3-5 lines max.
Product Database: ${JSON.stringify(PRODUCT_DATA)}
Rules:
- Answer price, MOQ, material, delivery from the database above
- Sample: available for most products, customer must contact for details
- Custom design: yes, available for all products
- If info not in database say: "Aro details er jonno call korun: 01XXXXXXXXX"
- End with a helpful follow-up question
- Use emojis naturally`;

const conversations = {};

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") return;
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages || messages.length === 0) return;
    const message = messages[0];
    const from = message.from;
    if (message.type !== "text") {
      await sendWhatsAppMessage(from, "Sudhu text message support kori ekhon. Apnar product somporke jiggesh korun! 😊");
      return;
    }
    const userText = message.text.body;
    if (!conversations[from]) conversations[from] = [];
    conversations[from].push({ role: "user", content: userText });
    if (conversations[from].length > 10) conversations[from] = conversations[from].slice(-10);
    const aiReply = await getAIReply(conversations[from]);
    conversations[from].push({ role: "assistant", content: aiReply });
    await sendWhatsAppMessage(from, aiReply);
  } catch (err) {
    console.error("Error:", err.message);
  }
});

async function getAIReply(history) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: history,
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || "Dukkhito, ektu pore abar chesta korun.";
  } catch (err) {
    return "Dukkhito, system-e somossa hocche. Pore chesta korun.";
  }
}

async function sendWhatsAppMessage(to, text) {
  await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text },
    }),
  });
}

app.get("/", (req, res) => {
  res.json({ status: "Virtu Label Bot running!", products: PRODUCT_DATA.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
