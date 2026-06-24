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

const SYSTEM_PROMPT = `You are WhatsApp assistant for Virtu Label, a Bangladeshi clothing label supplier.
Reply in Banglish (Bengali+English mixed). Keep it short: 3-4 lines max.
Products: ${JSON.stringify(PRODUCT_DATA)}
Rules:
- Use product data to answer price, MOQ, delivery questions
- Custom design available for all products
- Sample available, contact for details
- Unknown info: "Details er jonno call korun: 01XXXXXXXXX"
- End with a question
- Use emojis`;

const conversations = {};

app.get("/webhook", (req, res) => {
  console.log("Webhook verification request received");
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("Mode:", mode, "Token:", token);
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.log("Webhook verification failed");
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  console.log("POST webhook received:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== "whatsapp_business_account") {
      console.log("Not whatsapp_business_account:", body.object);
      return;
    }
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    console.log("Messages:", JSON.stringify(messages));
    if (!messages || messages.length === 0) return;
    const message = messages[0];
    const from = message.from;
    if (message.type !== "text") {
      await sendWhatsAppMessage(from, "Sudhu text message support kori. Apnar product somporkhe jiggesh korun!");
      return;
    }
    const userText = message.text.body;
    console.log(`Message from ${from}: ${userText}`);
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
    console.log("AI response:", JSON.stringify(data));
    return data.content?.[0]?.text || "Dukkhito, ektu pore try korun.";
  } catch (err) {
    console.error("AI Error:", err);
    return "Dukkhito, somossa hocche. Pore try korun.";
  }
}

async function sendWhatsAppMessage(to, text) {
  try {
    console.log(`Sending to ${to}: ${text}`);
    const response = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
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
    const data = await response.json();
    console.log("Send response:", JSON.stringify(data));
  } catch (err) {
    console.error("Send error:", err);
  }
}

app.get("/", (req, res) => {
  res.json({ status: "Virtu Label Bot running!", products: PRODUCT_DATA.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
