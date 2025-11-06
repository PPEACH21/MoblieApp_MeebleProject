import 'dotenv/config';

const ip   = process.env.API_IP;     // e.g. 192.168.1.23
const port = process.env.API_PORT;   // e.g. 8080

const apiBase = `http://${ip}:${port}`
console.log("🛠 app.config.js apiBase =", apiBase);   // <== ต้องเห็นในเทอร์มินัล

export default ({ config }) => ({
  ...config,
  extra: {
    apiBase,
    imgbbKey: process.env.IMGBB_API_KEY,
  },
});