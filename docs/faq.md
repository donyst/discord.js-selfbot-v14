# Frequently Asked Questions (FAQ) & Safety Guide

---

## 1. Safety & Ban Prevention

### Why does Discord ban selfbots?
Discord's Terms of Service strictly forbid automated user accounts. Bans generally occur due to:
1. **Spamming / High-rate API requests**: Sending messages too rapidly or joining many servers quickly.
2. **Flagged IP Addresses**: Running selfbots on datacenter / VPN IPs that Discord monitors closely.
3. **Mismatched Client Properties**: Sending requests without realistic User-Agents, Super-Properties, or TLS signatures.
4. **Suspicious Activity**: Rapidly DMing non-friends, adding friends in bulk, or reacting too fast.

### Best practices to reduce risk:
- **Use residential proxies or your home connection**: Avoid cheap public VPNs or flagged VPS IPs.
- **Add realistic delays**: Insert random delays (`Math.random() * 2000 + 1000`) between automated actions.
- **Keep Super-Properties updated**: This fork regularly synchronizes properties with real Discord Desktop releases.
- **Never automate mass actions**: Avoid mass DMing or mass friending.

---

## 2. Common Errors & Troubleshooting

### `Error [TOKEN_INVALID]: An invalid token was provided.`
- Ensure your token is a **User Account Token**, not a Bot Token.
- Ensure the token is not expired (tokens change when you change your account password).
- Ensure there are no surrounding whitespace characters or quotes in the token string.

### `DiscordAPIError[40002]: You need to verify your account in order to perform this action.`
- Your account has been prompted for phone verification or email verification.
- Log into Discord in a desktop browser and complete the verification prompt.

### `DiscordAPIError[50035]: Invalid Form Body`
- Discord rejected your request payload. Verify the structure of the message, embed, or interaction arguments.

---

## 3. Maintenance & Fork Inquiries

### Who maintains this repository?
This fork is maintained by **[Phạm Minh Đồng (@donyst)](https://github.com/donyst)**.

### Where can I report issues or request features?
Please open an issue at [https://github.com/donyst/discord.js-selfbot-v13/issues](https://github.com/donyst/discord.js-selfbot-v13/issues).
