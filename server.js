// ============================================================
// Serveur webhook : TradingView -> Claude (analyse) -> Discord
// ============================================================
// Ce serveur reçoit les alertes envoyées par ton indicateur Pine,
// demande une analyse rapide à Claude, puis poste le résultat
// dans un salon Discord via un webhook.
//
// LIMITE IMPORTANTE : ça n'affiche jamais rien DIRECTEMENT sur le
// graphique TradingView. Le résultat arrive sur Discord (ou par
// email/Telegram si tu adaptes le code), pas dans TradingView lui-même.
// ============================================================

import express from "express";

const app = express();
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY || !DISCORD_WEBHOOK_URL) {
  console.error("ERREUR : il manque ANTHROPIC_API_KEY ou DISCORD_WEBHOOK_URL dans les variables d'environnement.");
  process.exit(1);
}

app.post("/tradingview-webhook", async (req, res) => {
  try {
    const alert = req.body; // { symbol, tf, price, type, time }
    console.log("Alerte reçue :", alert);

    const prompt = `Voici une alerte de trading automatique venant de TradingView :
- Symbole : ${alert.symbol}
- Timeframe : ${alert.tf}
- Prix : ${alert.price}
- Type de cassure : ${alert.type === "bullish" ? "haussière (BOS/CHoCH)" : "baissière (BOS/CHoCH)"}
- Heure : ${alert.time}

Donne une analyse courte (5-6 lignes max) de ce que ça peut signifier techniquement,
sans donner de conseil financier direct, juste une lecture technique neutre.
Réponds en français.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const claudeData = await claudeResponse.json();
    const analysisText = claudeData?.content?.[0]?.text || "Pas de réponse générée.";

    // Envoi vers Discord
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📊 **${alert.symbol} (${alert.tf})** — Cassure ${alert.type === "bullish" ? "haussière 🟢" : "baissière 🔴"} à ${alert.price}\n\n${analysisText}`,
      }),
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("Erreur webhook :", err);
    res.status(500).send("Erreur serveur");
  }
});

app.get("/", (req, res) => res.send("Serveur webhook TradingView -> Claude -> Discord actif."));

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
